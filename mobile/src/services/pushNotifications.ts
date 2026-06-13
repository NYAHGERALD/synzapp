import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

type PushPlatform = 'android' | 'ios' | 'unknown';
type PushProvider = 'expo' | 'fcm';
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
let notificationHandlerConfigured = false;
let notificationsModulePromise: Promise<ExpoNotificationsModule> | null = null;

export interface ChatPushNotificationData {
  contactId: string;
  conversationId: string;
  envelopeId: string;
  sentAt: string;
  type: 'chat.message';
}

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

  return Notifications;
}

export async function registerDevicePushNotifications(idToken: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const Notifications = await configureSynzappNotificationHandling();

  if (!Notifications) {
    return false;
  }

  await ensureChatNotificationChannel(Notifications);

  const permission = await ensureNotificationPermission(Notifications);

  if (!permission) {
    return false;
  }

  const pushToken = await getPushToken(Notifications);
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken);
  const deviceId = deviceHeaders['X-Synzapp-Device-Id'];

  if (!deviceId) {
    throw new Error('Secure device identity is not ready.');
  }

  const response = await fetch(`${getSynzappApiBaseUrl()}/api/profile/me/push-token`, {
    body: JSON.stringify({
      deviceId,
      platform: getPushPlatform(),
      provider: pushToken.provider,
      token: pushToken.token
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

  return true;
}

export function addChatPushNotificationListeners(handlers: {
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
        const data = parseChatPushNotificationData(notification.request.content.data);

        if (data) {
          handlers.onReceived?.(data);
        }
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = parseChatPushNotificationData(response.notification.request.content.data);

        if (data) {
          handlers.onResponse?.(data);
        }
      });

      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          const data = response
            ? parseChatPushNotificationData(response.notification.request.content.data)
            : null;

          if (data) {
            handlers.onResponse?.(data);
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
    name: 'Chat messages',
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250]
  });
}

async function ensureNotificationPermission(Notifications: ExpoNotificationsModule): Promise<boolean> {
  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.status === 'granted') {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();

  return requestedPermission.status === 'granted';
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
    contactId: payload.contactId,
    conversationId: payload.conversationId,
    envelopeId: payload.envelopeId,
    sentAt: payload.sentAt,
    type: 'chat.message'
  };
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
