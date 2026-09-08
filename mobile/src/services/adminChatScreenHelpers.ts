import type { ChatMediaUploadRecoveryState } from '../services/chatMediaApi';
import type { PendingChatMessage } from '../services/localChatStore';
import type { SynzappCallEndReason, SynzappCallMode, SynzappCallRecord } from '../services/callApi';
import { Alert, Platform } from 'react-native';
import { CallPushNotificationData } from '../services/pushNotifications';
import { LocalChatMediaInput } from '../services/chatMediaApi';
import { endSynzappNativeVoipCall } from '../services/voipCalls';
import { getMessageMedia, getMessageMediaItems } from '../services/chatMessageReconciliation';
import { getNativeCallKeepEndReason, getOptionalCallKeepRuntime, getOptionalInCallManagerRuntime } from '../services/chatCallSupport';

/**
 * Chat screen helpers that never touched the screen.
 *
 * Each of these was declared inside the `AdminChatScreen` function but closes
 * over nothing in it — no state, no ref, no prop. They were inner functions only
 * by where they happened to be typed, and being inner made every one of them
 * unreachable from a test.
 */

export function isCompleteRecoverableUpload(
  uploadRecovery: ChatMediaUploadRecoveryState | null | undefined
): uploadRecovery is ChatMediaUploadRecoveryState {
  if (!uploadRecovery?.mediaId || !uploadRecovery.media?.mediaId) {
    return false;
  }

  if (uploadRecovery.uploadMode !== 'chunked') {
    return Boolean(uploadRecovery.media.key && uploadRecovery.media.nonce);
  }

  return Boolean(
    uploadRecovery.media.key &&
    uploadRecovery.media.chunkSizeBytes &&
    uploadRecovery.media.partCount &&
    Array.isArray(uploadRecovery.media.partNonces) &&
    uploadRecovery.media.partNonces.length === uploadRecovery.media.partCount
  );
}

export function parseIncomingCallDeepLink(url: string | null): CallPushNotificationData | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'synzapp:' || parsedUrl.hostname !== 'call' || parsedUrl.pathname !== '/incoming') {
      return null;
    }

    const callId = parsedUrl.searchParams.get('callId') || '';
    const callerUid = parsedUrl.searchParams.get('callerUid') || '';
    const contactId = parsedUrl.searchParams.get('contactId') || '';
    const createdAt = parsedUrl.searchParams.get('createdAt') || '';

    if (!callId || !callerUid || !contactId || !createdAt) {
      return null;
    }

    const mode = parsedUrl.searchParams.get('mode') === 'video' ? 'video' : 'voice';
    const chatType = parsedUrl.searchParams.get('chatType') === 'GROUP' ? 'GROUP' : 'DIRECT';
    const callerName = parsedUrl.searchParams.get('callerName') || 'Synzapp user';
    const title = parsedUrl.searchParams.get('title') || callerName || 'Synzapp call';

    return {
      callId,
      callerName,
      callerUid,
      chatType,
      contactId,
      createdAt,
      mode,
      participantUids: parseIncomingCallDeepLinkParticipantUids(parsedUrl.searchParams.get('participantUids')),
      tenantId: parsedUrl.searchParams.get('tenantId') || '',
      title,
      type: 'call.incoming'
    };
  } catch {
    return null;
  }
}

export function parseIncomingCallDeepLinkParticipantUids(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((uid): uid is string => typeof uid === 'string' && Boolean(uid.trim()));
    }
  } catch {
    return value
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean);
  }

  return [];
}

export function showNativeIncomingSynzappCall(call: SynzappCallRecord) {
  const RNCallKeep = getOptionalCallKeepRuntime();

  RNCallKeep?.displayIncomingCall?.(
    call.callId,
    call.title,
    call.callerName || call.title,
    'generic',
    call.mode === 'video'
  );
}

export function showNativeOutgoingSynzappCall(call: SynzappCallRecord) {
  const RNCallKeep = getOptionalCallKeepRuntime();

  RNCallKeep?.startCall?.(
    call.callId,
    call.title,
    call.title,
    'generic',
    call.mode === 'video'
  );
}

export function finishNativeSynzappCall(callId: string, reason: SynzappCallEndReason) {
  const RNCallKeep = getOptionalCallKeepRuntime();

  void endSynzappNativeVoipCall(callId, reason).catch(() => undefined);

  if (!RNCallKeep) {
    return;
  }

  const endReason = getNativeCallKeepEndReason(RNCallKeep, reason);

  RNCallKeep.reportEndCallWithUUID?.(callId, endReason);
  RNCallKeep.endCall?.(callId);
}

export function startIncomingCallAudio(mode: SynzappCallMode) {
  const inCallManager = getOptionalInCallManagerRuntime();

  inCallManager?.startRingtone?.('_BUNDLE_');
}

export function stopIncomingCallAudio() {
  const inCallManager = getOptionalInCallManagerRuntime();

  inCallManager?.stopRingtone?.();
  inCallManager?.stop?.({ busytone: '' });
}

export function startOutgoingCallAudio(mode: SynzappCallMode) {
  const inCallManager = getOptionalInCallManagerRuntime();

  inCallManager?.start?.({ media: mode === 'video' ? 'video' : 'audio' });
  inCallManager?.setSpeakerphoneOn?.(mode === 'video');
}

export function stopOutgoingCallAudio() {
  getOptionalInCallManagerRuntime()?.stop?.();
}

export function handleGroupInfoUnavailableAction(title: string) {
  Alert.alert(title, 'This group action is ready in the group profile and will connect to the group management service when that service is enabled.');
}

export function handleContactInfoUnavailableAction(title: string) {
  Alert.alert(title, 'This contact action is ready in the contact profile and will connect to the contact management service when that service is enabled.');
}

export function handleChatsSectionUnavailableAction(title: string) {
  Alert.alert(title, 'This chats section is ready in the Chats tab and will connect to the chat management service when that service is enabled.');
}

export function hasPendingMedia(pendingMessage: PendingChatMessage): boolean {
  return Boolean(getMessageMedia(pendingMessage.message)) ||
    getMessageMediaItems(pendingMessage.message).length > 0;
}

export function shouldSendSelectedMediaImmediately(mediaItems: LocalChatMediaInput[]): boolean {
  return mediaItems.length > 0 && mediaItems.every((media) => media.kind === 'image' || media.kind === 'video');
}

export function promptNativeTextInput(input: {
  defaultValue: string;
  message: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
  submitLabel: string;
  title: string;
}) {
  if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
    Alert.prompt(
      input.title,
      input.message,
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          onPress: (value?: string) => input.onSubmit((value || '').trim()),
          text: input.submitLabel
        }
      ],
      'plain-text',
      input.defaultValue,
      'default'
    );
    return;
  }

  Alert.alert(
    input.title,
    input.message,
    [
      {
        style: 'cancel',
        text: 'Cancel'
      },
      {
        onPress: () => input.onSubmit(input.defaultValue.trim()),
        text: input.submitLabel
      }
    ]
  );
}

export function confirmTenantAiToggle(input: {
  enabled: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
}) {
  if (input.enabled) {
    input.onConfirm();
    return;
  }

  Alert.alert(input.title, input.message, [
    { style: 'cancel', text: 'Cancel' },
    {
      onPress: input.onConfirm,
      style: 'destructive',
      text: 'Disable'
    }
  ]);
}
