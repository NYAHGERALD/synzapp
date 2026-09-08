import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSynzappApiBaseUrl } from './apiConfig';
import type { ChatContact } from './chatApi';
import * as TaskManager from 'expo-task-manager';
import { CHAT_DELIVERY_RECEIPT_TASK } from './chatDeliveryReceiptTask';
import { getRegisteredDeviceHeaders } from './deviceIdentity';
import {
  addSynzappVoipTokenListener,
  getSynzappVoipToken
} from './voipCalls';

type PushPlatform = 'android' | 'ios' | 'unknown';
type PushProvider = 'apnsVoip' | 'expo' | 'fcm';
type ExpoNotificationsModule = typeof import('expo-notifications');
type NotificationSubscription = {
  remove: () => void;
};

interface ExpoProjectConfig {
  appOwnership?: string | null;
  easConfig?: {
    projectId?: string;
  };
  expoConfig?: {
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
  };
}

const CHAT_MESSAGES_CHANNEL_ID = 'chat-messages';
const CALLS_CHANNEL_ID = 'synzapp-calls';
const INTERPRETER_CHANNEL_ID = 'interpreter-reminders';
const MAX_APP_BADGE_COUNT = 9999;
let notificationHandlerConfigured = false;
let notificationsModulePromise: Promise<ExpoNotificationsModule> | null = null;
let activeVoipIdToken: string | null = null;
let lastRegisteredVoipTokenKey: string | null = null;
let pendingVoipToken: string | null = null;
let voipRetryTimer: ReturnType<typeof setTimeout> | null = null;
let voipTokenSubscription: NotificationSubscription | null = null;

export interface ChatPushNotificationData {
  chatType?: 'DIRECT' | 'GROUP';
  contactId: string;
  conversationId: string;
  envelopeId: string;
  sentAt: string;
  type: 'chat.message';
}

export interface CallPushNotificationData {
  callId: string;
  callerName: string;
  callerUid: string;
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  createdAt: string;
  mode: 'voice' | 'video';
  participantUids: string[];
  tenantId: string;
  title: string;
  type: 'call.incoming';
}

export interface InterpreterPushNotificationData {
  artifactId?: string;
  endedAtIso?: string;
  languageCode?: string;
  languageCodes?: string;
  meetingId: string;
  notificationId: string;
  scheduledAtIso?: string;
  segmentId?: string;
  summaryId?: string;
  title?: string;
  type:
    | 'INTERPRETER_MEETING_REMINDER'
    | 'INTERPRETER_SESSION_ENDED'
    | 'INTERPRETER_SESSION_SCHEDULED'
    | 'INTERPRETER_SUMMARY_AUDIO_READY'
    | 'INTERPRETER_TRANSCRIPT_AUDIO_READY';
}

type SynzappPushNotificationData =
  | ChatPushNotificationData
  | CallPushNotificationData
  | InterpreterPushNotificationData;

export async function configureSynzappNotificationHandling(): Promise<ExpoNotificationsModule | null> {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return null;
  }

  if (notificationHandlerConfigured) {
    return Notifications;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
  notificationHandlerConfigured = true;

  // Routes pushes that arrive with the app shut to the background task, which
  // is the only way a closed app can confirm it has a message. Registering is
  // separate from defining the task: the definition has to exist in the bare
  // JavaScript context the platform starts, and this tells the notification
  // system to hand that context the push.
  //
  // Not fatal if it fails. Delivery is still recorded when the app is next
  // opened, so the worst case is a tick that arrives late.
  // Reported rather than swallowed. Registering is the step everything else
  // depends on, and a failure here shows up only as a notification that never
  // reveals itself — the same symptom as a dozen unrelated faults.
  try {
    await Notifications.registerTaskAsync(CHAT_DELIVERY_RECEIPT_TASK);
    console.log('[SynzappPreview] task registered', JSON.stringify({
      defined: TaskManager.isTaskDefined(CHAT_DELIVERY_RECEIPT_TASK),
      registered: await TaskManager.isTaskRegisteredAsync(CHAT_DELIVERY_RECEIPT_TASK),
      task: CHAT_DELIVERY_RECEIPT_TASK
    }));
  } catch (error) {
    console.log('[SynzappPreview] task registration FAILED', JSON.stringify({
      defined: TaskManager.isTaskDefined(CHAT_DELIVERY_RECEIPT_TASK),
      message: error instanceof Error ? error.message : String(error)
    }));
  }

  return Notifications;
}

export async function registerDevicePushNotifications(idToken: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const didRegisterVoipToken = await registerDeviceVoipPushNotifications(idToken);
  const Notifications = await configureSynzappNotificationHandling();

  if (!Notifications) {
    return didRegisterVoipToken;
  }

  await Promise.all([
    ensureChatNotificationChannel(Notifications),
    ensureCallNotificationChannel(Notifications),
    ensureInterpreterNotificationChannel(Notifications)
  ]);

  const permission = await ensureNotificationPermission(Notifications);

  if (!permission) {
    // Logged rather than returned quietly: a device that never asks for a token
    // looks identical, from the outside, to one whose pushes are being dropped.
    console.log('[SynzappPush]', JSON.stringify({ permission: false, platform: Platform.OS }));

    return didRegisterVoipToken;
  }

  const pushToken = await getPushToken(Notifications);

  await registerPushTokenWithBackend(idToken, {
    platform: getPushPlatform(),
    provider: pushToken.provider,
    token: pushToken.token
  });

  // Every stage of push registration succeeds silently, so when notifications do
  // not arrive there is no way to tell whether the token was never obtained,
  // never sent, or sent and ignored. The token itself is not logged; its length
  // and provider are enough to tell those apart.
  console.log('[SynzappPush]', JSON.stringify({
    permission: true,
    platform: getPushPlatform(),
    provider: pushToken.provider,
    registered: true,
    tokenLength: pushToken.token.length
  }));

  return true;
}

async function registerDeviceVoipPushNotifications(idToken: string): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  activeVoipIdToken = idToken;
  ensureVoipTokenListener();

  if (pendingVoipToken) {
    return registerCurrentVoipToken(pendingVoipToken);
  }

  try {
    const voipToken = await getSynzappVoipToken();

    if (voipToken) {
      pendingVoipToken = voipToken;

      return registerCurrentVoipToken(voipToken);
    }
  } catch {
    return false;
  }

  return false;
}

function ensureVoipTokenListener(): void {
  if (voipTokenSubscription) {
    return;
  }

  voipTokenSubscription = addSynzappVoipTokenListener((token) => {
    pendingVoipToken = token;
    void registerCurrentVoipToken(token);
  });
}

async function registerCurrentVoipToken(token: string): Promise<boolean> {
  const idToken = activeVoipIdToken;

  if (!idToken || !token) {
    return false;
  }

  const registrationKey = `${idToken}:${token}`;

  if (registrationKey === lastRegisteredVoipTokenKey) {
    return true;
  }

  try {
    await registerPushTokenWithBackend(idToken, {
      platform: 'ios',
      provider: 'apnsVoip',
      token
    });
    lastRegisteredVoipTokenKey = registrationKey;
    clearVoipRegistrationRetry();

    return true;
  } catch {
    scheduleVoipRegistrationRetry(token);

    return false;
  }
}

function scheduleVoipRegistrationRetry(token: string): void {
  clearVoipRegistrationRetry();
  voipRetryTimer = setTimeout(() => {
    voipRetryTimer = null;
    void registerCurrentVoipToken(token);
  }, 3000);
}

function clearVoipRegistrationRetry(): void {
  if (!voipRetryTimer) {
    return;
  }

  clearTimeout(voipRetryTimer);
  voipRetryTimer = null;
}

async function registerPushTokenWithBackend(
  idToken: string,
  input: {
    platform: PushPlatform;
    provider: PushProvider;
    token: string;
  }
): Promise<void> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const deviceId = deviceHeaders['X-Synzapp-Device-Id'];

  if (!deviceId) {
    throw new Error('Secure device identity is not ready.');
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/push-token`, {
    body: JSON.stringify({
      deviceId,
      platform: input.platform,
      provider: input.provider,
      token: input.token
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function syncSynzappUnreadBadgeCount(
  contacts: Array<Pick<ChatContact, 'unreadCount'>>
): Promise<void> {
  await setSynzappAppBadgeCount(getSynzappUnreadBadgeCount(contacts));
}

export async function setSynzappAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const Notifications = await getNotificationsModule();

  if (!Notifications || typeof Notifications.setBadgeCountAsync !== 'function') {
    return;
  }

  await Notifications.setBadgeCountAsync(normalizeBadgeCount(count));
}

export function getSynzappUnreadBadgeCount(
  contacts: Array<Pick<ChatContact, 'unreadCount'>>
): number {
  const count = contacts.reduce((total, contact) => total + normalizeUnreadCount(contact.unreadCount), 0);

  return normalizeBadgeCount(count);
}

export function addChatPushNotificationListeners(handlers: {
  /**
   * Called for every notification that arrives, whatever it is.
   *
   * Used to refresh things that a push implies have changed but which carry no
   * payload of their own, such as announcements.
   */
  onAnyReceived?: () => void;
  onCallReceived?: (data: CallPushNotificationData) => void;
  onCallResponse?: (data: CallPushNotificationData) => void;
  onInterpreterReceived?: (data: InterpreterPushNotificationData) => void;
  onInterpreterResponse?: (data: InterpreterPushNotificationData) => void;
  onReceived?: (data: ChatPushNotificationData) => void;
  onResponse?: (data: ChatPushNotificationData) => void;
}): () => void {
  let isActive = true;
  let receivedSubscription: NotificationSubscription | null = null;
  let responseSubscription: NotificationSubscription | null = null;

  void configureSynzappNotificationHandling()
    .then((Notifications) => {
      if (!Notifications || !isActive) {
        return;
      }

      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = parseSynzappPushNotificationData(notification.request.content.data);

        handlers.onAnyReceived?.();

        if (data?.type === 'chat.message') {
          handlers.onReceived?.(data);
        } else if (data?.type === 'call.incoming') {
          handlers.onCallReceived?.(data);
        } else if (isInterpreterPushNotificationData(data)) {
          handlers.onInterpreterReceived?.(data);
        }
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = parseSynzappPushNotificationData(response.notification.request.content.data);

        handlers.onAnyReceived?.();

        if (data?.type === 'chat.message') {
          handlers.onResponse?.(data);
        } else if (data?.type === 'call.incoming') {
          handlers.onCallResponse?.(data);
        } else if (isInterpreterPushNotificationData(data)) {
          handlers.onInterpreterResponse?.(data);
        }
      });

      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          const data = response
            ? parseSynzappPushNotificationData(response.notification.request.content.data)
            : null;

          if (data?.type === 'chat.message') {
            handlers.onResponse?.(data);
          } else if (data?.type === 'call.incoming') {
            handlers.onCallResponse?.(data);
          } else if (isInterpreterPushNotificationData(data)) {
            handlers.onInterpreterResponse?.(data);
          }
        })
        .catch(() => undefined);
    })
    .catch(() => undefined);

  return () => {
    isActive = false;
    receivedSubscription?.remove();
    responseSubscription?.remove();
  };
}

function normalizeUnreadCount(count: number | null | undefined): number {
  return typeof count === 'number' && Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
}

function normalizeBadgeCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_APP_BADGE_COUNT, Math.floor(count)));
}

async function getNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (isAndroidExpoGo()) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications');

  return notificationsModulePromise;
}

function isAndroidExpoGo(): boolean {
  const constants = Constants as ExpoProjectConfig;

  return Platform.OS === 'android' && constants.appOwnership === 'expo';
}

async function ensureChatNotificationChannel(Notifications: ExpoNotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CHAT_MESSAGES_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.HIGH,
    // The message itself is shown, and Android decides who may read it: in
    // full while the phone is unlocked, hidden behind "contents hidden" while
    // it is locked. Letting the system draw that line is better than a setting
    // of ours, because it already knows whether the person is present and it
    // cannot be got wrong on one screen and right on another.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    name: 'Chat messages',
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250]
  });
}

async function ensureCallNotificationChannel(Notifications: ExpoNotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CALLS_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    name: 'Synzapp calls',
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500, 250, 500]
  });
}

async function ensureInterpreterNotificationChannel(Notifications: ExpoNotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(INTERPRETER_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.HIGH,
    name: 'Interpreter',
    sound: 'default',
    vibrationPattern: [0, 250, 120, 250]
  });
}

async function ensureNotificationPermission(Notifications: ExpoNotificationsModule): Promise<boolean> {
  const currentPermission = await Notifications.getPermissionsAsync();

  if (
    currentPermission.status === 'granted' &&
    (Platform.OS !== 'ios' || currentPermission.ios?.allowsBadge !== false)
  ) {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true
    }
  });

  return requestedPermission.status === 'granted' &&
    (Platform.OS !== 'ios' || requestedPermission.ios?.allowsBadge !== false);
}

async function getPushToken(Notifications: ExpoNotificationsModule): Promise<{
  provider: PushProvider;
  token: string;
}> {
  if (Platform.OS === 'android') {
    const tokenResponse = await Notifications.getDevicePushTokenAsync();

    return {
      provider: 'fcm',
      token: String(tokenResponse.data)
    };
  }

  const projectId = getExpoProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return {
    provider: 'expo',
    token: tokenResponse.data
  };
}

function getExpoProjectId(): string | undefined {
  const constants = Constants as ExpoProjectConfig;

  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    constants.easConfig?.projectId ||
    constants.expoConfig?.extra?.eas?.projectId;
}

function getPushPlatform(): PushPlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS;
  }

  return 'unknown';
}

function parseSynzappPushNotificationData(data: unknown): SynzappPushNotificationData | null {
  return parseChatPushNotificationData(data) ||
    parseCallPushNotificationData(data) ||
    parseInterpreterPushNotificationData(data);
}

function parseChatPushNotificationData(data: unknown): ChatPushNotificationData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (
    payload.type !== 'chat.message' ||
    typeof payload.contactId !== 'string' ||
    typeof payload.conversationId !== 'string' ||
    typeof payload.envelopeId !== 'string' ||
    typeof payload.sentAt !== 'string'
  ) {
    return null;
  }

  return {
    chatType: payload.chatType === 'GROUP' ? 'GROUP' : payload.chatType === 'DIRECT' ? 'DIRECT' : undefined,
    contactId: payload.contactId,
    conversationId: payload.conversationId,
    envelopeId: payload.envelopeId,
    sentAt: payload.sentAt,
    type: 'chat.message'
  };
}

function parseCallPushNotificationData(data: unknown): CallPushNotificationData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (
    payload.type !== 'call.incoming' ||
    typeof payload.callId !== 'string' ||
    typeof payload.callerUid !== 'string' ||
    typeof payload.contactId !== 'string' ||
    typeof payload.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    callId: payload.callId,
    callerName: typeof payload.callerName === 'string' && payload.callerName.trim()
      ? payload.callerName
      : 'Synzapp user',
    callerUid: payload.callerUid,
    chatType: payload.chatType === 'GROUP' ? 'GROUP' : 'DIRECT',
    contactId: payload.contactId,
    createdAt: payload.createdAt,
    mode: payload.mode === 'video' ? 'video' : 'voice',
    participantUids: parseParticipantUids(payload.participantUids),
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : '',
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'Synzapp call',
    type: 'call.incoming'
  };
}

function parseInterpreterPushNotificationData(data: unknown): InterpreterPushNotificationData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const type = typeof payload.type === 'string' ? payload.type : '';

  if (!isInterpreterPushNotificationType(type) || typeof payload.meetingId !== 'string') {
    return null;
  }

  return {
    artifactId: typeof payload.artifactId === 'string' ? payload.artifactId : undefined,
    endedAtIso: typeof payload.endedAtIso === 'string' ? payload.endedAtIso : undefined,
    languageCode: typeof payload.languageCode === 'string' ? payload.languageCode : undefined,
    languageCodes: typeof payload.languageCodes === 'string' ? payload.languageCodes : undefined,
    meetingId: payload.meetingId,
    notificationId: typeof payload.notificationId === 'string' ? payload.notificationId : '',
    scheduledAtIso: typeof payload.scheduledAtIso === 'string' ? payload.scheduledAtIso : undefined,
    segmentId: typeof payload.segmentId === 'string' ? payload.segmentId : undefined,
    summaryId: typeof payload.summaryId === 'string' ? payload.summaryId : undefined,
    title: typeof payload.title === 'string' ? payload.title : undefined,
    type
  };
}

function isInterpreterPushNotificationData(
  data: SynzappPushNotificationData | null
): data is InterpreterPushNotificationData {
  return Boolean(data && isInterpreterPushNotificationType(data.type));
}

function isInterpreterPushNotificationType(type: string): type is InterpreterPushNotificationData['type'] {
  return type === 'INTERPRETER_MEETING_REMINDER' ||
    type === 'INTERPRETER_SESSION_ENDED' ||
    type === 'INTERPRETER_SESSION_SCHEDULED' ||
    type === 'INTERPRETER_SUMMARY_AUDIO_READY' ||
    type === 'INTERPRETER_TRANSCRIPT_AUDIO_READY';
}

function parseParticipantUids(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((uid): uid is string => typeof uid === 'string' && Boolean(uid.trim()));
  }

  if (typeof value !== 'string' || !value.trim()) {
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

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Unable to register push notifications.';
  }

  return 'Unable to register push notifications.';
}
