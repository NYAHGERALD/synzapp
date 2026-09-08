import { AudioModule } from 'expo-audio';

type RtcPeerConnection = {
  addEventListener?: (eventName: string, listener: (...args: any[]) => void) => void;
  addIceCandidate?: (candidate: unknown) => Promise<void>;
  addTrack?: (track: unknown, stream: unknown) => void;
  addTransceiver?: (
    trackOrKind: MediaStreamTrackLike | 'audio',
    init?: { direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive'; streams?: MediaStreamLike[] }
  ) => unknown;
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
  onopen?: (() => void) | null;
  readyState?: string;
  send?: (data: string) => void;
};

type MediaStreamTrackLike = {
  enabled?: boolean;
  kind?: string;
  stop?: () => void;
  _setVolume?: (volume: number) => void;
};

type MediaStreamLike = {
  addTrack?: (track: MediaStreamTrackLike) => void;
  getAudioTracks?: () => MediaStreamTrackLike[];
  getTracks?: () => MediaStreamTrackLike[];
  release?: (releaseTracks?: boolean) => void;
  toURL?: () => string;
};

export interface InterpreterRealtimeMediaDevice {
  deviceId: string;
  groupId?: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput' | string;
  label: string;
}

type WebRtcRuntime = {
  MediaStream?: new (tracks?: MediaStreamTrackLike[] | MediaStreamLike) => MediaStreamLike;
  mediaDevices?: {
    enumerateDevices?: () => Promise<InterpreterRealtimeMediaDevice[]>;
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
  /**
   * Something the person should know that is not a fault.
   *
   * Kept apart from onError so guidance ("speak first, then tap Respond") is
   * not presented with the weight of a failure. A live interpreter that cries
   * wolf gets switched off before the meeting that needed it.
   */
  onNotice?: (message: string) => void;
  onAudioLevel?: (level: number) => void;
  onDetectedLanguage?: (languageCode: string) => void;
  onError?: (message: string) => void;
  onEvent?: (event: InterpreterRealtimeEvent) => void;
  onKnowledgeToolCall?: (input: InterpreterRealtimeKnowledgeToolInput) => Promise<unknown>;
  onRemoteAudioActivity?: (activity: InterpreterRemoteAudioActivity) => void;
  onRemoteStreamUrl?: (streamUrl: string | null) => void;
  onResponseComplete?: (kind: InterpreterRealtimeResponseKind) => void;
  onStatus?: (status: InterpreterRealtimeStatus) => void;
  onTranscript?: (text: string) => void;
  onTranslation?: (text: string) => void;
}

export interface InterpreterRemoteAudioActivity {
  audioLevel?: number;
  bytesReceived?: number;
  hasRemoteTrack: boolean;
  packetsReceived?: number;
  timestampIso: string;
}

export interface InterpreterRealtimeEvent {
  detectedLanguageCode?: string;
  raw: unknown;
  text?: string;
  type: string;
}

export interface InterpreterRealtimeKnowledgeToolInput {
  callId: string;
  name: string;
  query: string;
  targetLanguageCode?: string | null;
}

export interface InterpreterRealtimeResponseInput {
  allowLatestAudioFallback?: boolean;
  meetingName?: string;
  sourceText: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
}

export type InterpreterRealtimeResponseKind = 'interpretation' | 'readiness';

export interface InterpreterRealtimeReadinessInput {
  languageLabel: string;
  meetingName?: string;
}

export interface InterpreterRealtimeSession {
  cancelResponse: () => void;
  close: () => void;
  commitLatestAudio: () => boolean;
  pauseListening: () => void;
  respond: (input: InterpreterRealtimeResponseInput) => boolean;
  resumeListening: () => void;
  setRemoteAudioVolume: (volume: number) => void;
  speakReadinessCue: (input: InterpreterRealtimeReadinessInput) => boolean;
}

export interface InterpreterRealtimeSessionInput {
  audioInputDeviceId?: string | null;
  createAnswerSdp: (offerSdp: string) => Promise<string>;
  initialRemoteAudioVolume?: number;
  sessionMode?: 'controlled_voice' | 'translation' | 'voice_agent';
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


/**
 * The audio session used while the interpreter is listening.
 *
 * Recording is on, because the microphone is capturing the speaker.
 */
const INTERPRETER_LISTENING_AUDIO_MODE = {
  allowsBackgroundRecording: true,
  allowsRecording: true,
  interruptionMode: 'duckOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};

/**
 * The audio session used while the interpreter is speaking.
 *
 * Recording is off, and that is the whole point. A Bluetooth device connected
 * to an app that holds the microphone open switches to the hands-free profile:
 * mono, narrow-band, and noticeably quieter. Releasing the microphone lets it
 * switch to the music profile, which is what makes saved recordings sound loud
 * and clear through the same speaker.
 *
 * Safe to do here because the microphone is already disabled for the duration
 * of a response — the interpreter is push-to-talk, so it never needs to listen
 * and speak at the same time. A full-duplex interpreter could not do this, and
 * would be stuck with the quieter profile.
 */
const INTERPRETER_SPEAKING_AUDIO_MODE = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'duckOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};

/**
 * Switches the audio session between listening and speaking.
 *
 * Failures are swallowed on purpose. A device that refuses the change still
 * plays the response — just at the quieter volume — and losing the meeting to
 * an audio-routing error would be a far worse outcome than quiet audio.
 */
async function applyInterpreterAudioMode(isSpeaking: boolean): Promise<void> {
  await AudioModule.setAudioModeAsync(
    isSpeaking ? INTERPRETER_SPEAKING_AUDIO_MODE : INTERPRETER_LISTENING_AUDIO_MODE
  ).catch(() => undefined);
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
  await applyInterpreterAudioMode(false);

  const localStream = await runtime.mediaDevices.getUserMedia({
    audio: buildAudioInputConstraints(session.audioInputDeviceId),
    video: false
  });
  const peerConnection = new runtime.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  const eventsChannel = peerConnection.createDataChannel?.('oai-events') || null;
  const remoteTracks: MediaStreamTrackLike[] = [];
  const remoteStreams: MediaStreamLike[] = [];
  const audioTracks = getAudioTracks(localStream);
  let audioLevelPollingCleanup: (() => void) | null = null;
  let remoteAudioPollingCleanup: (() => void) | null = null;
  let responseCompletionTimer: ReturnType<typeof setTimeout> | null = null;
  let sourceTranscriptBuffer = '';
  let translationTranscriptBuffer = '';
  const pendingRealtimeEvents: Array<Record<string, unknown>> = [];
  let currentRemoteStreamUrl: string | null = null;
  let currentRemoteAudioVolume = normalizeRealtimeVolume(session.initialRemoteAudioVolume ?? 1);
  const isTranslationSession = session.sessionMode === 'translation';
  const isVoiceAgentSession = session.sessionMode === 'voice_agent';
  const handledToolCallIds = new Set<string>();
  let lastRemoteAudioActivity: InterpreterRemoteAudioActivity = {
    hasRemoteTrack: false,
    timestampIso: new Date().toISOString()
  };
  let isSpeakingResponse = false;
  let activeResponseKind: InterpreterRealtimeResponseKind | null = null;
  let closed = false;
  let realtimeConversationGeneration = 0;
  let pendingAudioCommitResponseTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingAudioCommitResponseEvent: Record<string, unknown> | null = null;
  let currentResponseRemoteAudioBaseline: InterpreterRemoteAudioActivity | null = null;
  let currentResponseHadAudioSignal = false;
  let currentResponseLastAudioSignalAtMs = 0;
  let currentResponseStartedAtMs = 0;
  let isResponseCompleting = false;

  function publishRemoteAudioActivity(activity: Partial<InterpreterRemoteAudioActivity>) {
    const previousActivity = lastRemoteAudioActivity;
    const nextActivity: InterpreterRemoteAudioActivity = {
      ...lastRemoteAudioActivity,
      ...activity,
      hasRemoteTrack: activity.hasRemoteTrack ?? lastRemoteAudioActivity.hasRemoteTrack,
      timestampIso: new Date().toISOString()
    };

    lastRemoteAudioActivity = nextActivity;

    if (
      isSpeakingResponse &&
      activeResponseKind === 'interpretation' &&
      hasInterpreterRealtimeRemoteAudioActivity(nextActivity, previousActivity)
    ) {
      currentResponseHadAudioSignal = true;
      currentResponseLastAudioSignalAtMs = Date.now();
    }

    callbacks.onRemoteAudioActivity?.(nextActivity);
  }

  function clearResponseCompletionTimer() {
    if (responseCompletionTimer) {
      clearTimeout(responseCompletionTimer);
      responseCompletionTimer = null;
    }
  }

  function clearPendingAudioCommitResponse() {
    if (pendingAudioCommitResponseTimer) {
      clearTimeout(pendingAudioCommitResponseTimer);
      pendingAudioCommitResponseTimer = null;
    }

    pendingAudioCommitResponseEvent = null;
  }

  function resetResponseAudioTracking() {
    currentResponseRemoteAudioBaseline = null;
    currentResponseHadAudioSignal = false;
    currentResponseLastAudioSignalAtMs = 0;
    currentResponseStartedAtMs = 0;
    isResponseCompleting = false;
  }

  function flushPendingAudioCommitResponse() {
    if (!pendingAudioCommitResponseEvent) {
      return true;
    }

    const responseEvent = pendingAudioCommitResponseEvent;

    clearPendingAudioCommitResponse();
    const responseQueued = queueOrSendRealtimeEvent(eventsChannel, responseEvent, pendingRealtimeEvents);

    if (!responseQueued) {
      isSpeakingResponse = false;
      activeResponseKind = null;
      resetResponseAudioTracking();
      callbacks.onStatus?.('ready');
      callbacks.onError?.('The live interpreter connection closed before the response could be sent.');
      return false;
    }

    return true;
  }

  function finishRealtimeResponseWithAudioDrain(completedKind: InterpreterRealtimeResponseKind) {
    clearResponseCompletionTimer();

    const responseCompletedAtMs = Date.now();
    const minimumDrainMs = completedKind === 'readiness'
      ? 2600
      : getRealtimeResponseMinimumAudioDrainMs({
          completedAtMs: responseCompletedAtMs,
          responseStartedAtMs: currentResponseStartedAtMs,
          text: translationTranscriptBuffer || sourceTranscriptBuffer
        });
    const maximumDrainMs = completedKind === 'readiness'
      ? 2600
      : Math.max(5200, Math.min(14000, minimumDrainMs + 3600));

    const finalizeResponse = () => {
      if (closed) {
        return;
      }

      isSpeakingResponse = false;
      activeResponseKind = null;
      isResponseCompleting = false;

      if (
        completedKind === 'interpretation' &&
        currentResponseStartedAtMs > 0 &&
        !currentResponseHadAudioSignal
      ) {
        callbacks.onError?.(
          'Synzapp created the interpreter response, but the iPhone did not receive playable audio. Check the selected audio output route, then tap Listen and try again.'
        );
      }

      resetResponseAudioTracking();
      callbacks.onResponseComplete?.(completedKind);

      if (completedKind === 'readiness' || isVoiceAgentSession) {
        setStreamTracksEnabled(localStream, true);
        callbacks.onStatus?.('listening');
      } else {
        setStreamTracksEnabled(localStream, false);
        callbacks.onAudioLevel?.(0);
        callbacks.onStatus?.('ready');
      }
    };

    const waitForAudioDrain = () => {
      if (closed) {
        return;
      }

      const nowMs = Date.now();
      const drainElapsedMs = nowMs - responseCompletedAtMs;
      const lastAudioSignalAgeMs = currentResponseLastAudioSignalAtMs > 0
        ? nowMs - currentResponseLastAudioSignalAtMs
        : Number.POSITIVE_INFINITY;
      const missingAudioTimedOut =
        completedKind === 'interpretation' && !currentResponseHadAudioSignal && drainElapsedMs >= 3200;
      const hasStableAudioTail =
        completedKind !== 'interpretation'
          ? drainElapsedMs >= minimumDrainMs
          : (
              currentResponseHadAudioSignal &&
              drainElapsedMs >= minimumDrainMs &&
              lastAudioSignalAgeMs >= 1200
            );
      const hasReachedHardLimit = drainElapsedMs >= maximumDrainMs;

      if (missingAudioTimedOut || hasStableAudioTail || hasReachedHardLimit) {
        finalizeResponse();
        return;
      }

      responseCompletionTimer = setTimeout(waitForAudioDrain, 260);
    };

    responseCompletionTimer = setTimeout(waitForAudioDrain, 260);
  }

  async function handleRealtimeKnowledgeToolCall(
    toolCall: InterpreterRealtimeKnowledgeToolInput,
    conversationGeneration: number
  ) {
    if (handledToolCallIds.has(toolCall.callId)) {
      return;
    }

    handledToolCallIds.add(toolCall.callId);

    let output: unknown;

    try {
      output = callbacks.onKnowledgeToolCall
        ? await callbacks.onKnowledgeToolCall(toolCall)
        : {
            answer: 'No backend-approved knowledge resolver is available on this device session.',
            confidence: 'not_available',
            facts: [],
            policy: 'Do not guess.'
          };
    } catch (error) {
      output = {
        answer: error instanceof Error ? error.message : 'The backend-approved knowledge lookup failed.',
        confidence: 'not_available',
        facts: [],
        policy: 'Do not guess.'
      };
    }

    if (closed || conversationGeneration !== realtimeConversationGeneration) {
      return;
    }

    const didSendOutput = queueOrSendRealtimeEvent(
      eventsChannel,
      buildRealtimeToolOutputEvent(toolCall.callId, output),
      pendingRealtimeEvents
    );

    if (didSendOutput) {
      queueOrSendRealtimeEvent(
        eventsChannel,
        {
          response: {
            output_modalities: ['audio']
          },
          type: 'response.create'
        },
        pendingRealtimeEvents
      );
    }
  }

  if (!audioTracks.length) {
    closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
    throw new Error('Microphone started, but the device did not provide an audio track for the interpreter.');
  }

  audioTracks.forEach((track) => {
    track.enabled = true;

    if (peerConnection.addTransceiver) {
      peerConnection.addTransceiver(track, {
        direction: 'sendrecv',
        streams: [localStream]
      });
      return;
    }

    peerConnection.addTrack?.(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    const track = event.track && typeof event.track === 'object'
      ? event.track as MediaStreamTrackLike
      : null;

    if (track) {
      // Keep the remote OpenAI audio track mounted and enabled for the life of the
      // session. iOS can fail to wake playback reliably when a WebRTC receiver
      // track is created disabled and toggled later.
      track.enabled = true;
      setRemoteTrackVolume(track, currentRemoteAudioVolume);
      remoteTracks.push(track);
      publishRemoteAudioActivity({ hasRemoteTrack: true });
    }

    const resolvedRemoteStream = resolveRemoteAudioStream(runtime, event.streams, track);

    if (resolvedRemoteStream.stream && !remoteStreams.includes(resolvedRemoteStream.stream)) {
      remoteStreams.push(resolvedRemoteStream.stream);
    }

    if (resolvedRemoteStream.streamUrl && resolvedRemoteStream.streamUrl !== currentRemoteStreamUrl) {
      currentRemoteStreamUrl = resolvedRemoteStream.streamUrl;
      callbacks.onRemoteStreamUrl?.(resolvedRemoteStream.streamUrl);
    }
  };

  if (eventsChannel) {
    eventsChannel.onopen = () => {
      flushRealtimeEvents(eventsChannel, pendingRealtimeEvents);
    };

    eventsChannel.onmessage = (event) => {
      const parsed = parseRealtimeEvent(event.data);

      if (!parsed) {
        return;
      }

      callbacks.onEvent?.(parsed);

      const toolCall = extractRealtimeKnowledgeToolCall(parsed);

      if (toolCall) {
        void handleRealtimeKnowledgeToolCall(toolCall, realtimeConversationGeneration);
      }

      if (parsed.text && isSourceTranscriptEvent(parsed.type)) {
        sourceTranscriptBuffer = mergeRealtimeText(sourceTranscriptBuffer, parsed.text, parsed.type);
        callbacks.onTranscript?.(sourceTranscriptBuffer);
        if (parsed.detectedLanguageCode) {
          callbacks.onDetectedLanguage?.(parsed.detectedLanguageCode);
        }

      }

      if (parsed.text && isTranslationTranscriptEvent(parsed.type) && (isTranslationSession || isVoiceAgentSession || activeResponseKind === 'interpretation')) {
        translationTranscriptBuffer = mergeRealtimeText(translationTranscriptBuffer, parsed.text, parsed.type);
        callbacks.onTranslation?.(translationTranscriptBuffer);
      }

      if (isRealtimeResponseAudioStartEvent(parsed.type) && isSpeakingResponse) {
        currentResponseHadAudioSignal = true;
        currentResponseLastAudioSignalAtMs = Date.now();
      }

      if (isVoiceAgentSession && isRealtimeResponseAudioStartEvent(parsed.type)) {
        // This is the local microphone gate. Once the realtime agent starts
        // speaking, the device microphone is muted so room noise cannot become a
        // new user turn or interrupt the response.
        setStreamTracksEnabled(localStream, false);
        callbacks.onAudioLevel?.(0);
        isSpeakingResponse = true;
        activeResponseKind = 'interpretation';
        callbacks.onStatus?.('speaking');
      }

      if (isRealtimeResponseCompleteEvent(parsed.type) && isSpeakingResponse) {
        const completedKind = activeResponseKind || 'interpretation';

        if (!isResponseCompleting) {
          isResponseCompleting = true;
          realtimeConversationGeneration += 1;
          finishRealtimeResponseWithAudioDrain(completedKind);
        }
      }

      if (isRealtimeInputAudioCommittedEvent(parsed.type)) {
        flushPendingAudioCommitResponse();
      }

      if (isRealtimeErrorEvent(parsed)) {
        const message = extractRealtimeErrorMessage(parsed) || 'Interpreter realtime session reported an error.';

        if (isRecoverableRealtimeToolCallProtocolError(message)) {
          return;
        }

        if (isRecoverableRealtimeInputAudioCommitError(message)) {
          return;
        }

        if (isRecoverableRealtimeTurnError(message)) {
          // Logged, never shown. The session carries on, and interrupting a
          // live meeting with a message the user cannot act on is worse than
          // the problem it describes.
          console.warn('[SynzappInterpreter] recovered from a realtime turn error', message);

          return;
        }

        callbacks.onError?.(message);
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
    remoteAudioPollingCleanup = startRemoteAudioActivityPolling(
      peerConnection,
      () => remoteTracks.length > 0,
      publishRemoteAudioActivity
    );
    callbacks.onStatus?.('listening');
  } catch (error) {
    audioLevelPollingCleanup?.();
    remoteAudioPollingCleanup?.();
    closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
    callbacks.onStatus?.('error');
    callbacks.onError?.(error instanceof Error ? error.message : 'Live interpreter could not start.');
    throw error;
  }

  return {
    cancelResponse: () => {
      clearResponseCompletionTimer();
      clearPendingAudioCommitResponse();
      setStreamTracksEnabled(localStream, true);
      if (isSpeakingResponse) {
        queueOrSendRealtimeEvent(eventsChannel, { type: 'response.cancel' }, pendingRealtimeEvents);
        queueOrSendRealtimeEvent(eventsChannel, { type: 'output_audio_buffer.clear' }, pendingRealtimeEvents);
      }
      queueOrSendRealtimeEvent(eventsChannel, { type: 'input_audio_buffer.clear' }, pendingRealtimeEvents);
      realtimeConversationGeneration += 1;
      isSpeakingResponse = false;
      activeResponseKind = null;
      resetResponseAudioTracking();
      callbacks.onStatus?.('listening');
    },
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      realtimeConversationGeneration += 1;
      clearResponseCompletionTimer();
      clearPendingAudioCommitResponse();
      audioLevelPollingCleanup?.();
      remoteAudioPollingCleanup?.();
      resetResponseAudioTracking();
      callbacks.onAudioLevel?.(0);
      callbacks.onRemoteAudioActivity?.({
        hasRemoteTrack: false,
        timestampIso: new Date().toISOString()
      });
      callbacks.onRemoteStreamUrl?.(null);
      closeInterpreterRealtimeSession(peerConnection, localStream, eventsChannel);
      releaseRemoteInterpreterStreams(remoteStreams);
      callbacks.onStatus?.('closed');
    },
    commitLatestAudio: () => {
      if (!canQueueRealtimeEvent(eventsChannel)) {
        callbacks.onError?.('The live interpreter connection is not ready to commit captured speech yet. Tap Listen again and try once more.');
        return false;
      }

      return queueOrSendRealtimeEvent(eventsChannel, { type: 'input_audio_buffer.commit' }, pendingRealtimeEvents);
    },
    pauseListening: () => {
      clearPendingAudioCommitResponse();
      resetResponseAudioTracking();
      setStreamTracksEnabled(localStream, false);
      callbacks.onAudioLevel?.(0);
      callbacks.onStatus?.('ready');
    },
    respond: (input) => {
      const sourceText = input.sourceText.trim();
      const shouldRespondFromLatestAudio = !sourceText && Boolean(input.allowLatestAudioFallback);

      if (!sourceText && !shouldRespondFromLatestAudio) {
        // Nobody has spoken yet. Reported as guidance rather than as a fault,
        // because the person simply tapped early.
        callbacks.onNotice?.('Nothing captured yet — speak, then tap Respond.');

        return false;
      }

      if (!canQueueRealtimeEvent(eventsChannel)) {
        callbacks.onError?.('The live interpreter connection is not ready for a response yet. Tap Listen again and try once more.');
        return false;
      }

      // Manual interpretation is push-to-listen / push-to-respond. Keep the
      // PeerConnection alive, but stop sending microphone audio while the model
      // speaks so the next listening turn only starts when the user taps Listen.
      setStreamTracksEnabled(localStream, false);
      // Note: the audio *session* is switched by the screen, through the native
      // module, not here. WebRTC owns the session on iOS and overrides Expo's
      // audio mode, so changing it from this layer has no effect on Bluetooth
      // routing — a fix attempted here first, and measured to do nothing.
      void applyInterpreterAudioMode(true);
      callbacks.onAudioLevel?.(0);
      currentRemoteAudioVolume = 1;
      setRemoteTrackVolumes(remoteTracks, currentRemoteAudioVolume);
      translationTranscriptBuffer = '';
      clearResponseCompletionTimer();
      clearPendingAudioCommitResponse();
      isResponseCompleting = false;
      if (isSpeakingResponse) {
        queueOrSendRealtimeEvent(eventsChannel, { type: 'response.cancel' }, pendingRealtimeEvents);
        queueOrSendRealtimeEvent(eventsChannel, { type: 'output_audio_buffer.clear' }, pendingRealtimeEvents);
      }
      realtimeConversationGeneration += 1;
      isSpeakingResponse = true;
      activeResponseKind = 'interpretation';
      currentResponseRemoteAudioBaseline = lastRemoteAudioActivity;
      currentResponseHadAudioSignal = false;
      currentResponseLastAudioSignalAtMs = 0;
      currentResponseStartedAtMs = Date.now();
      const responseEvent = buildRealtimeInterpreterResponseEvent(input);

      if (shouldRespondFromLatestAudio) {
        pendingAudioCommitResponseEvent = responseEvent;
        pendingAudioCommitResponseTimer = setTimeout(() => {
          flushPendingAudioCommitResponse();
        }, 900);
        const commitQueued = queueOrSendRealtimeEvent(eventsChannel, { type: 'input_audio_buffer.commit' }, pendingRealtimeEvents);

        if (!commitQueued) {
          clearPendingAudioCommitResponse();
          isSpeakingResponse = false;
          activeResponseKind = null;
          resetResponseAudioTracking();
          callbacks.onStatus?.('ready');
          callbacks.onError?.('The live interpreter connection closed before the captured audio could be committed.');
          return false;
        }

        callbacks.onStatus?.('speaking');

        return true;
      }

      const responseQueued = queueOrSendRealtimeEvent(eventsChannel, responseEvent, pendingRealtimeEvents);

      if (!responseQueued) {
        isSpeakingResponse = false;
        activeResponseKind = null;
        resetResponseAudioTracking();
        callbacks.onStatus?.('ready');
        callbacks.onError?.('The live interpreter connection closed before the response could be sent.');
        return false;
      }

      callbacks.onStatus?.('speaking');

      return true;
    },
    resumeListening: () => {
      // Back to the recording session before the microphone is re-enabled,
      // otherwise the first moment of speech is captured on the wrong route.
      void applyInterpreterAudioMode(false);
      clearPendingAudioCommitResponse();
      resetResponseAudioTracking();
      sourceTranscriptBuffer = '';
      translationTranscriptBuffer = '';
      if (canQueueRealtimeEvent(eventsChannel)) {
        queueOrSendRealtimeEvent(eventsChannel, { type: 'input_audio_buffer.clear' }, pendingRealtimeEvents);
      }
      setStreamTracksEnabled(localStream, true);
      callbacks.onStatus?.('listening');
    },
    setRemoteAudioVolume: (volume) => {
      currentRemoteAudioVolume = normalizeRealtimeVolume(volume);
      setRemoteTrackVolumes(remoteTracks, currentRemoteAudioVolume);
    },
    speakReadinessCue: (input) => {
      if (!canQueueRealtimeEvent(eventsChannel)) {
        callbacks.onError?.('The live interpreter connection is not ready to confirm audio yet. Tap Listen again and try once more.');
        return false;
      }

      // The readiness cue uses the same live remote audio path as interpretation.
      // Keep the WebRTC capture sender active so native audio routing stays warm.
      setStreamTracksEnabled(localStream, true);
      currentRemoteAudioVolume = 1;
      setRemoteTrackVolumes(remoteTracks, currentRemoteAudioVolume);
      translationTranscriptBuffer = '';
      clearResponseCompletionTimer();
      clearPendingAudioCommitResponse();
      isResponseCompleting = false;

      if (isSpeakingResponse) {
        queueOrSendRealtimeEvent(eventsChannel, { type: 'response.cancel' }, pendingRealtimeEvents);
      }

      realtimeConversationGeneration += 1;
      isSpeakingResponse = true;
      activeResponseKind = 'readiness';
      currentResponseRemoteAudioBaseline = lastRemoteAudioActivity;
      currentResponseHadAudioSignal = false;
      currentResponseLastAudioSignalAtMs = 0;
      currentResponseStartedAtMs = Date.now();
      const responseQueued = queueOrSendRealtimeEvent(
        eventsChannel,
        buildRealtimeReadinessCueEvent(input),
        pendingRealtimeEvents
      );

      if (!responseQueued) {
        isSpeakingResponse = false;
        activeResponseKind = null;
        resetResponseAudioTracking();
        callbacks.onStatus?.('listening');
        callbacks.onError?.('The live interpreter connection closed before the readiness cue could play.');
        return false;
      }

      callbacks.onStatus?.('speaking');

      return true;
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

export async function listInterpreterRealtimeAudioDevices(): Promise<InterpreterRealtimeMediaDevice[]> {
  const runtime = loadWebRtcRuntime();

  if (!runtime.mediaDevices?.enumerateDevices) {
    return [];
  }

  await ensureInterpreterAudioPermission();

  try {
    const devices = await runtime.mediaDevices.enumerateDevices();

    return devices
      .filter((device) => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map((device, index) => ({
        deviceId: String(device.deviceId || `audio-device-${index}`),
        groupId: device.groupId ? String(device.groupId) : undefined,
        kind: device.kind,
        label: device.label || formatUnnamedAudioDevice(device.kind, index)
      }));
  } catch {
    return [];
  }
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

function getRemoteStreamUrl(stream: unknown): string | null {
  if (!stream || typeof stream !== 'object') {
    return null;
  }

  const candidate = stream as MediaStreamLike;

  if (typeof candidate.toURL !== 'function') {
    return null;
  }

  try {
    return candidate.toURL();
  } catch {
    return null;
  }
}

function resolveRemoteAudioStream(
  runtime: WebRtcRuntime,
  eventStreams: unknown[] | undefined,
  track: MediaStreamTrackLike | null
): { stream: MediaStreamLike | null; streamUrl: string | null } {
  const streamFromEvent = (eventStreams || [])
    .map((stream) => stream && typeof stream === 'object' ? stream as MediaStreamLike : null)
    .find((stream): stream is MediaStreamLike => Boolean(stream && getRemoteStreamUrl(stream)));

  if (streamFromEvent) {
    return {
      stream: streamFromEvent,
      streamUrl: getRemoteStreamUrl(streamFromEvent)
    };
  }

  if (!track || !runtime.MediaStream) {
    return { stream: null, streamUrl: null };
  }

  try {
    const stream = new runtime.MediaStream([track]);

    return {
      stream,
      streamUrl: getRemoteStreamUrl(stream)
    };
  } catch {
    try {
      const stream = new runtime.MediaStream();

      stream.addTrack?.(track);

      return {
        stream,
        streamUrl: getRemoteStreamUrl(stream)
      };
    } catch {
      return { stream: null, streamUrl: null };
    }
  }
}

function releaseRemoteInterpreterStreams(streams: MediaStreamLike[]) {
  streams.forEach((stream) => {
    try {
      stream.release?.(false);
    } catch {
      // Remote stream cleanup should not block the interpreter room from closing.
    }
  });
}

function setStreamTracksEnabled(stream: MediaStreamLike, enabled: boolean) {
  getAudioTracks(stream).forEach((track) => {
    track.enabled = enabled;
  });
}

function setTracksEnabled(tracks: MediaStreamTrackLike[], enabled: boolean) {
  tracks.forEach((track) => {
    track.enabled = enabled;
  });
}

function setRemoteTrackVolumes(tracks: MediaStreamTrackLike[], volume: number) {
  tracks.forEach((track) => setRemoteTrackVolume(track, volume));
}

function setRemoteTrackVolume(track: MediaStreamTrackLike, volume: number) {
  try {
    track._setVolume?.(volume);
  } catch {
    // Some native builds do not expose per-track volume. Track enablement still controls playback.
  }
}

function hasInterpreterRealtimeRemoteAudioActivity(
  activity: InterpreterRemoteAudioActivity | null,
  previousActivity: InterpreterRemoteAudioActivity | null
): boolean {
  if (!activity?.hasRemoteTrack) {
    return false;
  }

  if (typeof activity.audioLevel === 'number' && activity.audioLevel > 0.004) {
    return true;
  }

  const packetsReceived = typeof activity.packetsReceived === 'number' ? activity.packetsReceived : null;
  const previousPackets = typeof previousActivity?.packetsReceived === 'number' ? previousActivity.packetsReceived : null;

  if (packetsReceived !== null && previousPackets !== null && packetsReceived > previousPackets) {
    return true;
  }

  const bytesReceived = typeof activity.bytesReceived === 'number' ? activity.bytesReceived : null;
  const previousBytes = typeof previousActivity?.bytesReceived === 'number' ? previousActivity.bytesReceived : null;

  return bytesReceived !== null && previousBytes !== null && bytesReceived > previousBytes;
}

function getRealtimeResponseMinimumAudioDrainMs(input: {
  completedAtMs: number;
  responseStartedAtMs: number;
  text: string;
}): number {
  const elapsedResponseMs = input.responseStartedAtMs > 0
    ? Math.max(0, input.completedAtMs - input.responseStartedAtMs)
    : 0;
  const estimatedSpokenMs = estimateRealtimeSpokenAudioMs(input.text);
  const estimatedRemainingMs = estimatedSpokenMs > 0
    ? Math.max(0, estimatedSpokenMs - elapsedResponseMs)
    : 0;

  return clampRealtimeNumber(estimatedRemainingMs + 1400, 1900, 10000);
}

function estimateRealtimeSpokenAudioMs(text: string): number {
  const cleanText = text.trim();

  if (!cleanText) {
    return 0;
  }

  const words = cleanText.match(/[\p{L}\p{N}'’]+/gu)?.length || 0;
  const punctuationPauses = cleanText.match(/[.!?;:]/g)?.length || 0;

  if (!words) {
    return 0;
  }

  // About 180-190 spoken words/minute, plus short punctuation breath room.
  return Math.round(words * 325 + punctuationPauses * 160);
}

function clampRealtimeNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hasInterpreterRealtimeRemoteAudioSignal(
  activity: InterpreterRemoteAudioActivity | null,
  baseline: InterpreterRemoteAudioActivity | null
): boolean {
  if (!activity?.hasRemoteTrack) {
    return false;
  }

  if (typeof activity.audioLevel === 'number' && activity.audioLevel > 0.004) {
    return true;
  }

  const packetsReceived = typeof activity.packetsReceived === 'number' ? activity.packetsReceived : null;
  const baselinePackets = typeof baseline?.packetsReceived === 'number' ? baseline.packetsReceived : null;
  const packetDelta = packetsReceived !== null
    ? Math.max(0, packetsReceived - (baselinePackets ?? 0))
    : 0;

  if (packetDelta >= 4) {
    return true;
  }

  const bytesReceived = typeof activity.bytesReceived === 'number' ? activity.bytesReceived : null;
  const baselineBytes = typeof baseline?.bytesReceived === 'number' ? baseline.bytesReceived : null;
  const byteDelta = bytesReceived !== null
    ? Math.max(0, bytesReceived - (baselineBytes ?? 0))
    : 0;

  return byteDelta >= 2048;
}

function normalizeRealtimeVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }

  return Math.max(0, Math.min(1, volume));
}

function loadWebRtcRuntime(): WebRtcRuntime {
  try {
    return require('react-native-webrtc') as WebRtcRuntime;
  } catch {
    return {};
  }
}

function buildAudioInputConstraints(audioInputDeviceId?: string | null): boolean | Record<string, unknown> {
  const constraints: Record<string, unknown> = {
    advanced: [
      {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true
      }
    ],
    echoCancellation: true,
    googAutoGainControl: true,
    googEchoCancellation: true,
    googHighpassFilter: true,
    googNoiseSuppression: true,
    googTypingNoiseDetection: true,
    noiseSuppression: true,
    optional: [
      { googEchoCancellation: true },
      { googAutoGainControl: true },
      { googNoiseSuppression: true },
      { googHighpassFilter: true },
      { googTypingNoiseDetection: true }
    ],
    sampleRate: 48000,
    sampleSize: 16,
    voiceIsolation: true,
    channelCount: 1,
    autoGainControl: true
  };

  if (audioInputDeviceId) {
    constraints.deviceId = {
      exact: audioInputDeviceId
    };
  }

  return constraints;
}

function formatUnnamedAudioDevice(kind: string, index: number): string {
  if (kind === 'audioinput') {
    return `Microphone ${index + 1}`;
  }

  if (kind === 'audiooutput') {
    return `Audio output ${index + 1}`;
  }

  return `Audio device ${index + 1}`;
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

function canQueueRealtimeEvent(channel: RtcDataChannel | null): boolean {
  if (!channel?.send) {
    return false;
  }

  return !channel.readyState || channel.readyState === 'connecting' || channel.readyState === 'open';
}

function queueOrSendRealtimeEvent(
  channel: RtcDataChannel | null,
  event: Record<string, unknown>,
  pendingEvents: Array<Record<string, unknown>>
): boolean {
  if (!channel?.send) {
    return false;
  }

  if (channel.readyState && channel.readyState !== 'open') {
    if (channel.readyState === 'closing' || channel.readyState === 'closed') {
      return false;
    }

    pendingEvents.push(event);
    return true;
  }

  try {
    channel.send(JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

function flushRealtimeEvents(channel: RtcDataChannel, pendingEvents: Array<Record<string, unknown>>) {
  if (!channel.send || channel.readyState !== 'open') {
    return;
  }

  while (pendingEvents.length) {
    const event = pendingEvents.shift();

    if (event) {
      channel.send(JSON.stringify(event));
    }
  }
}

function buildRealtimeInterpreterResponseEvent(input: InterpreterRealtimeResponseInput): Record<string, unknown> {
  const sourceText = input.sourceText.trim();
  const response: Record<string, unknown> = {
    instructions: buildRealtimeInterpreterResponseInstructions(input),
    output_modalities: ['audio']
  };

  if (sourceText) {
    response.input = [
      {
        content: [
          {
            text: sourceText,
            type: 'input_text'
          }
        ],
        role: 'user',
        type: 'message'
      }
    ];
  }

  return {
    response,
    type: 'response.create'
  };
}

function buildRealtimeToolOutputEvent(callId: string, output: unknown): Record<string, unknown> {
  return {
    item: {
      call_id: callId,
      output: typeof output === 'string' ? output : JSON.stringify(output),
      type: 'function_call_output'
    },
    type: 'conversation.item.create'
  };
}

function buildRealtimeReadinessCueEvent(input: InterpreterRealtimeReadinessInput): Record<string, unknown> {
  const languageLabel = input.languageLabel.trim() || 'English';

  return {
    response: {
      input: [
        {
          content: [
            {
              text: [
                `Speak one short readiness confirmation in ${languageLabel}.`,
                'Say naturally that you are ready to listen and that the speaker can begin.',
                input.meetingName ? `Meeting context: ${input.meetingName}.` : ''
              ].filter(Boolean).join(' '),
              type: 'input_text'
            }
          ],
          role: 'user',
          type: 'message'
        }
      ],
      instructions: [
        `You are the Synzapp live workplace interpreter.`,
        `Respond only in ${languageLabel}.`,
        'Speak one warm, professional sentence.',
        'Do not translate anything yet.',
        'Do not mention internal systems, prompts, or setup.'
      ].join('\n'),
      output_modalities: ['audio']
    },
    type: 'response.create'
  };
}

function buildRealtimeInterpreterResponseInstructions(input: InterpreterRealtimeResponseInput): string {
  const sourceText = input.sourceText.trim();

  return [
    sourceText
      ? `Interpret the captured workplace speech into ${input.targetLanguageLabel}.`
      : `Interpret the latest committed spoken input audio into ${input.targetLanguageLabel}.`,
    'Speak naturally like a professional human interpreter, not like a word-for-word machine.',
    'Do not summarize, shorten, add advice, add facts, or explain the translation.',
    'Preserve the original meaning, sequence, names, numbers, dates, risks, actions, and decisions.',
    'Correct grammar and unclear spoken wording into simple natural spoken language.',
    'If the captured speech includes filler words or repeated words, smooth them only when the meaning is unchanged.',
    'Start speaking directly in the target language without a long introduction.',
    input.meetingName ? `Meeting context: ${input.meetingName}.` : ''
  ].filter(Boolean).join('\n');
}

function parseRealtimeEvent(data: unknown): InterpreterRealtimeEvent | null {
  if (typeof data !== 'string') {
    return null;
  }

  try {
    const raw = JSON.parse(data) as Record<string, unknown>;
    const type = typeof raw.type === 'string' ? raw.type : 'event';
    const text = pickEventText(raw, type);
    const detectedLanguageCode = pickDetectedLanguageCode(raw);

    return { detectedLanguageCode, raw, text, type };
  } catch {
    return null;
  }
}

function extractRealtimeKnowledgeToolCall(event: InterpreterRealtimeEvent): InterpreterRealtimeKnowledgeToolInput | null {
  if (!isRealtimeKnowledgeToolCallReadyEvent(event.type)) {
    return null;
  }

  const raw = event.raw;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const item = record.item && typeof record.item === 'object'
    ? record.item as Record<string, unknown>
    : record;
  const name = readString(item.name) || readString(record.name);

  if (name !== 'lookup_backend_approved_knowledge') {
    return null;
  }

  const callId = readString(item.call_id) || readString(record.call_id) || readString(item.id) || readString(record.id);
  const argumentsText = readString(item.arguments) || readString(record.arguments);

  if (!callId || !argumentsText) {
    return null;
  }

  const args = parseRealtimeToolArguments(argumentsText);
  const query = readString(args.query);

  if (!query?.trim()) {
    return null;
  }

  return {
    callId,
    name,
    query: query.trim(),
    targetLanguageCode: readString(args.targetLanguageCode) || null
  };
}

function isRealtimeKnowledgeToolCallReadyEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower === 'response.function_call_arguments.done' ||
    typeLower === 'response.output_item.done' ||
    typeLower === 'conversation.item.created';
}

function parseRealtimeToolArguments(argumentsText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(argumentsText);

    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRealtimeResponseCompleteEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower === 'response.done' ||
    typeLower === 'response.output_audio.done' ||
    typeLower === 'response.audio.done' ||
    typeLower.endsWith('.output_audio.done');
}

function isRealtimeResponseAudioStartEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower === 'response.output_audio.delta' ||
    typeLower === 'response.audio.delta' ||
    typeLower.endsWith('.output_audio.delta');
}

function isRealtimeInputAudioCommittedEvent(type: string): boolean {
  const typeLower = type.toLowerCase();

  return typeLower === 'input_audio_buffer.committed' ||
    typeLower === 'conversation.item.input_audio_transcription.completed';
}

function isRealtimeErrorEvent(event: InterpreterRealtimeEvent): boolean {
  return event.type.toLowerCase() === 'error';
}

function extractRealtimeErrorMessage(event: InterpreterRealtimeEvent): string | null {
  const raw = event.raw;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const error = (raw as Record<string, unknown>).error;

  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = (error as Record<string, unknown>).message;

  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

function isRecoverableRealtimeToolCallProtocolError(message: string): boolean {
  return /tool call id ['"`]?call_[^'"`\s]+['"`]? not found in conversation/i.test(message);
}

/**
 * Problems the session recovers from on its own.
 *
 * These arrive during ordinary use of a push-to-talk interpreter: a response is
 * cancelled when the speaker taps the gate, a turn is asked for while the last
 * one is still finishing, an active response is interrupted. None of them stop
 * the session or need anything from the person using it.
 *
 * Showing them was the problem. An interpreter that reports a fault in the
 * middle of a live meeting makes the user stop and doubt it — and in an
 * enterprise setting they stop using the feature rather than risk it in front
 * of a customer. Errors shown to a person should be ones they can act on.
 *
 * Everything filtered here is still reported to the console, so a real fault is
 * never silently lost.
 */
function isRecoverableRealtimeTurnError(message: string): boolean {
  return (
    // A response was cancelled or interrupted — normal for push-to-talk.
    /cancel|cancelled|canceled|interrupt/i.test(message) ||
    // A turn was requested while the previous one was still active.
    /active response|response already|already in progress|conversation_already_has_active_response/i.test(message) ||
    // Nothing to work with yet, because the speaker had not begun.
    /no active response|response not found|not found in conversation/i.test(message)
  );
}

function isRecoverableRealtimeInputAudioCommitError(message: string): boolean {
  return /input_audio_buffer|input audio buffer|audio buffer/i.test(message) &&
    /empty|too small|already committed|nothing to commit|commit|clear/i.test(message);
}

function pickEventText(raw: Record<string, unknown>, type: string): string | undefined {
  const typeLower = type.toLowerCase();
  const candidates = collectRealtimeTextCandidates(raw, ['text', 'transcript', 'output_text', 'translation']);
  const shouldPreserveSpacing = isTextDeltaEvent(typeLower);

  if (isTextDeltaEvent(typeLower)) {
    candidates.push(...collectRealtimeTextCandidates(raw, ['delta']));
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return shouldPreserveSpacing ? candidate : candidate.trim();
    }
  }

  return undefined;
}

function pickDetectedLanguageCode(raw: Record<string, unknown>): string | undefined {
  const candidates = collectRealtimeTextCandidates(raw, [
    'detectedLanguage',
    'detectedLanguageCode',
    'detected_language',
    'detected_language_code',
    'language',
    'language_code',
    'sourceLanguage',
    'sourceLanguageCode',
    'source_language',
    'source_language_code'
  ]);

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const normalizedCode = normalizeDetectedLanguageCode(candidate);

    if (normalizedCode) {
      return normalizedCode;
    }
  }

  return undefined;
}

function normalizeDetectedLanguageCode(value: string): string | undefined {
  const cleanValue = value.trim().replace('_', '-');

  if (!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,4})?$/.test(cleanValue)) {
    return undefined;
  }

  const [languageCode, regionOrScript] = cleanValue.split('-');

  return regionOrScript
    ? `${languageCode.toLowerCase()}-${regionOrScript.toUpperCase()}`
    : languageCode.toLowerCase();
}

function collectRealtimeTextCandidates(value: unknown, keys: string[], depth = 0): unknown[] {
  if (!value || typeof value !== 'object' || depth > 4) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRealtimeTextCandidates(item, keys, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const directCandidates = keys.map((key) => record[key]).filter((candidate) => typeof candidate === 'string');
  const nestedCandidates = ['item', 'content', 'message', 'part', 'response', 'output']
    .flatMap((key) => collectRealtimeTextCandidates(record[key], keys, depth + 1));

  return [...directCandidates, ...nestedCandidates];
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
  const isDeltaEvent = type.toLowerCase().includes('delta');

  if (isDeltaEvent) {
    return appendRealtimeTextDelta(currentText, nextText);
  }

  const cleanText = nextText.trim();

  if (!cleanText) {
    return currentText;
  }

  const cleanCurrentText = currentText.trim();

  if (!cleanCurrentText) {
    return cleanText;
  }

  const normalizedCurrentText = normalizeRealtimeTextForCompare(cleanCurrentText);
  const normalizedNextText = normalizeRealtimeTextForCompare(cleanText);

  if (
    normalizedCurrentText === normalizedNextText ||
    normalizedCurrentText.includes(normalizedNextText)
  ) {
    return cleanCurrentText;
  }

  if (normalizedNextText.includes(normalizedCurrentText)) {
    return cleanText;
  }

  return `${cleanCurrentText}\n${cleanText}`.replace(/[ \t]{2,}/g, ' ').trim();
}

function appendRealtimeTextDelta(currentText: string, nextText: string): string {
  const deltaText = nextText.replace(/[ \t\r\n]+/g, ' ');

  if (!deltaText.trim()) {
    return currentText;
  }

  if (!currentText.trim()) {
    return deltaText.trimStart();
  }

  const currentEndsWithSpace = /\s$/.test(currentText);
  const deltaStartsWithSpace = /^\s/.test(deltaText);
  const deltaStartsWithPunctuation = /^[,.;:!?)]/.test(deltaText.trimStart());
  const needsPunctuationSpace =
    /[,.;:!?]$/.test(currentText.trimEnd()) &&
    /^[\p{L}\p{N}]/u.test(deltaText.trimStart());
  const separator = currentEndsWithSpace || deltaStartsWithSpace || deltaStartsWithPunctuation
    ? ''
    : needsPunctuationSpace
      ? ' '
      : '';

  return `${currentText}${separator}${deltaText}`
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s,.;:!?])/g, '$1 ')
    .trimStart();
}

function normalizeRealtimeTextForCompare(value: string): string {
  return value
    .replace(/[.,!?;:"'`()[\]{}<>/\\|_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function startRemoteAudioActivityPolling(
  peerConnection: RtcPeerConnection,
  hasRemoteTrack: () => boolean,
  onRemoteAudioActivity: (activity: Partial<InterpreterRemoteAudioActivity>) => void
): (() => void) | null {
  if (!peerConnection.getStats) {
    return null;
  }

  let isPolling = false;
  const timer = setInterval(() => {
    if (isPolling) {
      return;
    }

    isPolling = true;
    peerConnection.getStats?.()
      .then((stats) => {
        const activity = extractRemoteAudioActivity(stats, hasRemoteTrack());

        if (activity) {
          onRemoteAudioActivity(activity);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        isPolling = false;
      });
  }, 420);

  return () => clearInterval(timer);
}

function extractRemoteAudioActivity(
  stats: unknown,
  hasRemoteTrack: boolean
): Partial<InterpreterRemoteAudioActivity> | null {
  const reports = stats instanceof Map
    ? Array.from(stats.values())
    : Array.isArray(stats)
      ? stats
      : stats && typeof stats === 'object'
        ? Object.values(stats as Record<string, unknown>)
        : [];

  let bestActivity: Partial<InterpreterRemoteAudioActivity> | null = hasRemoteTrack
    ? { hasRemoteTrack }
    : null;

  for (const report of reports) {
    if (!report || typeof report !== 'object') {
      continue;
    }

    const record = report as Record<string, unknown>;
    const type = String(record.type || '').toLowerCase();
    const kind = String(record.kind || record.mediaType || '').toLowerCase();

    if (type !== 'inbound-rtp' || kind !== 'audio') {
      continue;
    }

    bestActivity = {
      audioLevel: readNumber(record.audioLevel),
      bytesReceived: readNumber(record.bytesReceived),
      hasRemoteTrack: true,
      packetsReceived: readNumber(record.packetsReceived)
    };
  }

  return bestActivity;
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
