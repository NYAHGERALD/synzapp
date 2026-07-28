import { AudioModule } from 'expo-audio';

type RtcPeerConnection = {
  addEventListener?: (eventName: string, listener: (...args: any[]) => void) => void;
  addIceCandidate?: (candidate: unknown) => Promise<void>;
  addTrack?: (track: unknown, stream: unknown) => void;
  close: () => void;
  createDataChannel?: (label: string) => RtcDataChannel;
  createOffer: () => Promise<{ sdp?: string; type: string }>;
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
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    },
    video: false
  });
  const peerConnection = new runtime.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  const eventsChannel = peerConnection.createDataChannel?.('oai-events') || null;
  const remoteTracks: Array<{ enabled?: boolean }> = [];
  let closed = false;

  localStream.getTracks?.().forEach((track) => {
    track.enabled = true;
    peerConnection.addTrack?.(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    if (event.track && typeof event.track === 'object') {
      const track = event.track as { enabled?: boolean };

      track.enabled = false;
      remoteTracks.push(track);
    }

    callbacks.onStatus?.('speaking');
  };

  if (eventsChannel) {
    eventsChannel.onmessage = (event) => {
      const parsed = parseRealtimeEvent(event.data);

      if (!parsed) {
        return;
      }

      callbacks.onEvent?.(parsed);

      if (parsed.type.includes('transcript') && parsed.text) {
        callbacks.onTranscript?.(parsed.text);
      }

      if ((parsed.type.includes('translation') || parsed.type.includes('audio')) && parsed.text) {
        callbacks.onTranslation?.(parsed.text);
      }
    };
  }

  try {
    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering(peerConnection);

    const localSdp = peerConnection.localDescription?.sdp || offer.sdp;

    if (!localSdp) {
      throw new Error('Live interpreter could not prepare the microphone session.');
    }

    const answerSdp = await session.createAnswerSdp(localSdp);

    await peerConnection.setRemoteDescription({ sdp: answerSdp, type: 'answer' });
    callbacks.onStatus?.('listening');
  } catch (error) {
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
      closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
      callbacks.onStatus?.('closed');
    },
    pauseListening: () => {
      setStreamTracksEnabled(localStream, false);
      callbacks.onStatus?.('ready');
    },
    respond: () => {
      setStreamTracksEnabled(localStream, false);
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
  stream.getTracks?.().forEach((track) => {
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
    const text = pickEventText(raw);

    return { raw, text, type };
  } catch {
    return null;
  }
}

function pickEventText(raw: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.text,
    raw.transcript,
    raw.delta,
    raw.output_text,
    raw.translation
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}
