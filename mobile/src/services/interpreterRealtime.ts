import { AudioModule } from 'expo-audio';

type RtcPeerConnection = {
  addEventListener?: (eventName: string, listener: (...args: any[]) => void) => void;
  addIceCandidate?: (candidate: unknown) => Promise<void>;
  addTrack?: (track: unknown, stream: unknown) => void;
  close: () => void;
  createDataChannel?: (label: string) => RtcDataChannel;
  createOffer: (options?: Record<string, unknown>) => Promise<{ sdp?: string; type: string }>;
  getStats?: (selector?: unknown) => Promise<unknown>;
  iceGatheringState?: string;
  localDescription?: { sdp?: string; type: string } | null;
  onicecandidate?: ((event: { candidate?: unknown | null }) => void) | null;
  onicegatheringstatechange?: (() => void) | null;
  ontrack?: ((event: { streams?: unknown[]; track?: unknown }) => void) | null;
  setLocalDescription: (description: { sdp?: string; type: string }) => Promise<void>;
  setRemoteDescription: (description: { sdp: string; type: string }) => Promise<void>;
};

type RtcDataChannel = {
  close?: () => void;
  onmessage?: ((event: { data?: unknown }) => void) | null;
  readyState?: string;
  send?: (data: string) => void;
};

type MediaStreamLike = {
  getAudioTracks?: () => Array<{ enabled?: boolean; kind?: string; stop?: () => void }>;
  getTracks?: () => Array<{ enabled?: boolean; stop?: () => void }>;
};

type WebRtcRuntime = {
  mediaDevices?: {
    getUserMedia?: (constraints: Record<string, unknown>) => Promise<MediaStreamLike>;
  };
  RTCPeerConnection?: new (configuration: Record<string, unknown>) => RtcPeerConnection;
};

export type InterpreterRealtimeStatus =
  | 'closed'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'ready'
  | 'error';

export interface InterpreterRealtimeCallbacks {
  onAudioLevel?: (level: number) => void;
  onError?: (message: string) => void;
  onEvent?: (event: InterpreterRealtimeEvent) => void;
  onStatus?: (status: InterpreterRealtimeStatus) => void;
  onTranscript?: (text: string) => void;
  onTranslation?: (text: string) => void;
}

export interface InterpreterRealtimeEvent {
  raw: unknown;
  text?: string;
  type: string;
}

export interface InterpreterRealtimeSession {
  cancelResponse: () => void;
  close: () => void;
  pauseListening: () => void;
  respond: () => void;
  resumeListening: () => void;
}

export interface InterpreterRealtimeSessionInput {
  createAnswerSdp: (offerSdp: string) => Promise<string>;
}

export interface InterpreterAudioReadiness {
  canAskAgain?: boolean;
  granted: boolean;
  status: string;
}

export interface InterpreterRealtimeRuntimeReadiness {
  audio: InterpreterAudioReadiness;
  canStart: boolean;
  dataChannelSupported: boolean;
  getUserMediaSupported: boolean;
  message: string;
  peerConnectionSupported: boolean;
  webRtcRuntimeAvailable: boolean;
}

export async function startInterpreterRealtimeSession(
  session: InterpreterRealtimeSessionInput,
  callbacks: InterpreterRealtimeCallbacks = {}
): Promise<InterpreterRealtimeSession> {
  const runtime = loadWebRtcRuntime();

  if (!runtime.RTCPeerConnection || !runtime.mediaDevices?.getUserMedia) {
    throw new Error('Live interpreter audio is not available in this mobile build.');
  }

  callbacks.onStatus?.('connecting');

  await ensureInterpreterAudioPermission();
  await AudioModule.setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true
  }).catch(() => undefined);

  const localStream = await runtime.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
  const peerConnection = new runtime.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  const eventsChannel = peerConnection.createDataChannel?.('oai-events') || null;
  const remoteTracks: Array<{ enabled?: boolean }> = [];
  const audioTracks = getAudioTracks(localStream);
  let audioLevelPollingCleanup: (() => void) | null = null;
  let sourceTranscriptBuffer = '';
  let translationTranscriptBuffer = '';
  let closed = false;

  if (!audioTracks.length) {
    closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
    throw new Error('Microphone started, but the device did not provide an audio track for the interpreter.');
  }

  audioTracks.forEach((track) => {
    track.enabled = true;
    peerConnection.addTrack?.(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    if (event.track && typeof event.track === 'object') {
      const track = event.track as { enabled?: boolean };

      track.enabled = false;
      remoteTracks.push(track);
    }
  };

  if (eventsChannel) {
    eventsChannel.onmessage = (event) => {
      const parsed = parseRealtimeEvent(event.data);

      if (!parsed) {
        return;
      }

      callbacks.onEvent?.(parsed);

      if (parsed.text && isSourceTranscriptEvent(parsed.type)) {
        sourceTranscriptBuffer = mergeRealtimeText(sourceTranscriptBuffer, parsed.text, parsed.type);
        callbacks.onTranscript?.(sourceTranscriptBuffer);
      }

      if (parsed.text && isTranslationTranscriptEvent(parsed.type)) {
        translationTranscriptBuffer = mergeRealtimeText(translationTranscriptBuffer, parsed.text, parsed.type);
        callbacks.onTranslation?.(translationTranscriptBuffer);
      }
    };
  }

  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });

    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering(peerConnection);

    const localSdp = peerConnection.localDescription?.sdp || offer.sdp;

    if (!localSdp) {
      throw new Error('Live interpreter could not prepare the microphone session.');
    }

    if (!containsAudioMediaSection(localSdp)) {
      throw new Error('The device created an invalid interpreter audio offer. Please restart the app and try again.');
    }

    const answerSdp = await session.createAnswerSdp(localSdp);

    await peerConnection.setRemoteDescription({ sdp: answerSdp, type: 'answer' });
    audioLevelPollingCleanup = startAudioLevelPolling(peerConnection, audioTracks[0], callbacks.onAudioLevel);
    callbacks.onStatus?.('listening');
  } catch (error) {
    audioLevelPollingCleanup?.();
    closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
    callbacks.onStatus?.('error');
    callbacks.onError?.(error instanceof Error ? error.message : 'Live interpreter could not start.');
    throw error;
  }

  return {
    cancelResponse: () => {
      setTracksEnabled(remoteTracks, false);
      setStreamTracksEnabled(localStream, true);
      sendRealtimeEvent(eventsChannel, { type: 'response.cancel' });
      callbacks.onStatus?.('listening');
    },
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      audioLevelPollingCleanup?.();
      callbacks.onAudioLevel?.(0);
      closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
      callbacks.onStatus?.('closed');
    },
    pauseListening: () => {
      setStreamTracksEnabled(localStream, false);
      callbacks.onAudioLevel?.(0);
      callbacks.onStatus?.('ready');
    },
    respond: () => {
      setStreamTracksEnabled(localStream, false);
      callbacks.onAudioLevel?.(0);
      setTracksEnabled(remoteTracks, true);
      callbacks.onStatus?.('speaking');
    },
    resumeListening: () => {
      setTracksEnabled(remoteTracks, false);
      setStreamTracksEnabled(localStream, true);
      callbacks.onStatus?.('listening');
    }
  };
}

export async function getInterpreterAudioReadiness(): Promise<InterpreterAudioReadiness> {
  try {
    const permission = await AudioModule.getRecordingPermissionsAsync();

    return {
      canAskAgain: permission.canAskAgain,
      granted: permission.granted,
      status: permission.status
    };
  } catch {
    return {
      granted: false,
      status: 'unavailable'
    };
  }
}

export async function requestInterpreterAudioReadiness(): Promise<InterpreterAudioReadiness> {
  try {
    const permission = await AudioModule.requestRecordingPermissionsAsync();

    return {
      canAskAgain: permission.canAskAgain,
      granted: permission.granted,
      status: permission.status
    };
  } catch {
    return {
      granted: false,
      status: 'unavailable'
    };
  }
}

export async function getInterpreterRealtimeRuntimeReadiness(): Promise<InterpreterRealtimeRuntimeReadiness> {
  const runtime = loadWebRtcRuntime();
  const audio = await getInterpreterAudioReadiness();
  const peerConnectionSupported = Boolean(runtime.RTCPeerConnection);
  const getUserMediaSupported = Boolean(runtime.mediaDevices?.getUserMedia);
  const dataChannelSupported = Boolean(runtime.RTCPeerConnection?.prototype?.createDataChannel);
  const webRtcRuntimeAvailable = peerConnectionSupported && getUserMediaSupported;
  const canStart = audio.granted && webRtcRuntimeAvailable;

  return {
    audio,
    canStart,
    dataChannelSupported,
    getUserMediaSupported,
    message: getRuntimeReadinessMessage({
      audio,
      getUserMediaSupported,
      peerConnectionSupported,
      webRtcRuntimeAvailable
    }),
    peerConnectionSupported,
    webRtcRuntimeAvailable
  };
}

async function ensureInterpreterAudioPermission() {
  const currentPermission = await getInterpreterAudioReadiness();

  if (currentPermission.granted) {
    return;
  }

  const requestedPermission = await requestInterpreterAudioReadiness();

  if (!requestedPermission.granted) {
    throw new Error('Microphone permission is required before the live interpreter can listen.');
  }
}

function closeInterpreterRealtimeSession(
  peerConnection: RtcPeerConnection,
  localStream: MediaStreamLike,
  eventsChannel: RtcDataChannel | null
) {
  eventsChannel?.close?.();
  localStream.getTracks?.().forEach((track) => track.stop?.());
  peerConnection.close();
}

function setStreamTracksEnabled(stream: MediaStreamLike, enabled: boolean) {
  getAudioTracks(stream).forEach((track) => {
    track.enabled = enabled;
  });
}

function setTracksEnabled(tracks: Array<{ enabled?: boolean }>, enabled: boolean) {
  tracks.forEach((track) => {
    track.enabled = enabled;
  });
}

function loadWebRtcRuntime(): WebRtcRuntime {
  try {
    return require('react-native-webrtc') as WebRtcRuntime;
  } catch {
    return {};
  }
}

function getAudioTracks(stream: MediaStreamLike): Array<{ enabled?: boolean; kind?: string; stop?: () => void }> {
  const explicitAudioTracks = stream.getAudioTracks?.();

  if (explicitAudioTracks?.length) {
    return explicitAudioTracks;
  }

  return (stream.getTracks?.() || []).filter((track) =>
    !('kind' in track) || (track as { kind?: string }).kind === 'audio'
  );
}

function containsAudioMediaSection(sdp: string): boolean {
  return /(^|\r?\n)m=audio\s+/i.test(sdp);
}

function getRuntimeReadinessMessage(input: {
  audio: InterpreterAudioReadiness;
  getUserMediaSupported: boolean;
  peerConnectionSupported: boolean;
  webRtcRuntimeAvailable: boolean;
}): string {
  if (!input.peerConnectionSupported || !input.getUserMediaSupported || !input.webRtcRuntimeAvailable) {
    return 'This installed mobile build does not include the live audio runtime required for interpreter testing.';
  }

  if (!input.audio.granted) {
    return 'Microphone permission is not granted yet. Allow microphone access before the live test.';
  }

  return 'This device is ready for a live interpreter test.';
}

function waitForIceGathering(peerConnection: RtcPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1800);

    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    };
  });
}

function sendRealtimeEvent(channel: RtcDataChannel | null, event: Record<string, unknown>) {
  if (!channel?.send || channel.readyState !== 'open') {
    return;
  }

  channel.send(JSON.stringify(event));
}

function parseRealtimeEvent(data: unknown): InterpreterRealtimeEvent | null {
  if (typeof data !== 'string') {
    return null;
  }

  try {
    const raw = JSON.parse(data) as Record<string, unknown>;
    const type = typeof raw.type === 'string' ? raw.type : 'event';
    const text = pickEventText(raw, type);

    return { raw, text, type };
  } catch {
    return null;
  }
}

function pickEventText(raw: Record<string, unknown>, type: string): string | undefined {
  const typeLower = type.toLowerCase();
  const candidates = [
    raw.text,
    raw.transcript,
    raw.output_text,
    raw.translation
  ];

  if (isTextDeltaEvent(typeLower)) {
    candidates.push(raw.delta);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate === raw.delta ? candidate : candidate.trim();
    }
  }

  return undefined;
}

function isTextDeltaEvent(type: string): boolean {
  return type.includes('transcript') || type.includes('translation') || type.includes('text');
}

function isSourceTranscriptEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower.includes('input_transcript') || typeLower.includes('input_audio_transcription');
}

function isTranslationTranscriptEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower.includes('output_transcript') ||
    typeLower.includes('translation') ||
    (typeLower.includes('audio_transcript') && !isSourceTranscriptEvent(typeLower));
}

function mergeRealtimeText(currentText: string, nextText: string, type: string): string {
  const cleanText = nextText;

  if (!cleanText.trim()) {
    return currentText;
  }

  if (!type.toLowerCase().includes('delta')) {
    return cleanText.trim();
  }

  return `${currentText}${cleanText}`.replace(/[ \t]{2,}/g, ' ').trim();
}

function startAudioLevelPolling(
  peerConnection: RtcPeerConnection,
  audioTrack: unknown,
  onAudioLevel?: (level: number) => void
): (() => void) | null {
  if (!onAudioLevel || !peerConnection.getStats) {
    return null;
  }

  let isPolling = false;
  let previousEnergy: number | null = null;
  let previousDuration: number | null = null;
  const timer = setInterval(() => {
    if (isPolling) {
      return;
    }

    isPolling = true;
    peerConnection.getStats?.(audioTrack)
      .then((stats) => {
        const result = extractAudioLevel(stats, previousEnergy, previousDuration);

        previousEnergy = result.totalAudioEnergy ?? previousEnergy;
        previousDuration = result.totalSamplesDuration ?? previousDuration;

        if (typeof result.level === 'number') {
          onAudioLevel(Math.max(0, Math.min(1, result.level)));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        isPolling = false;
      });
  }, 160);

  return () => clearInterval(timer);
}

function extractAudioLevel(
  stats: unknown,
  previousEnergy: number | null,
  previousDuration: number | null
): { level?: number; totalAudioEnergy?: number; totalSamplesDuration?: number } {
  const reports = stats instanceof Map
    ? Array.from(stats.values())
    : Array.isArray(stats)
      ? stats
      : stats && typeof stats === 'object'
        ? Object.values(stats as Record<string, unknown>)
        : [];

  let totalAudioEnergy: number | undefined;
  let totalSamplesDuration: number | undefined;

  for (const report of reports) {
    if (!report || typeof report !== 'object') {
      continue;
    }

    const record = report as Record<string, unknown>;
    const directAudioLevel = readNumber(record.audioLevel);

    if (typeof directAudioLevel === 'number') {
      return { level: directAudioLevel };
    }

    const energy = readNumber(record.totalAudioEnergy);
    const duration = readNumber(record.totalSamplesDuration);

    if (typeof energy === 'number' && typeof duration === 'number') {
      totalAudioEnergy = energy;
      totalSamplesDuration = duration;
    }
  }

  if (
    typeof totalAudioEnergy === 'number' &&
    typeof totalSamplesDuration === 'number' &&
    typeof previousEnergy === 'number' &&
    typeof previousDuration === 'number' &&
    totalSamplesDuration > previousDuration
  ) {
    const energyDelta = Math.max(0, totalAudioEnergy - previousEnergy);
    const durationDelta = Math.max(0.001, totalSamplesDuration - previousDuration);
    const rms = Math.sqrt(energyDelta / durationDelta);

    return {
      level: Math.max(0, Math.min(1, rms * 3.2)),
      totalAudioEnergy,
      totalSamplesDuration
    };
  }

  return {
    totalAudioEnergy,
    totalSamplesDuration
  };
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
