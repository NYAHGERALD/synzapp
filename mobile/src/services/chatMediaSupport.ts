import type { NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ChatMediaQualityMode } from '../services/chatMediaApi';
import type { ChatOfflinePolicySettings } from '../services/chatOfflineSettings';
import type { LocalCachedChatMediaRecord } from '../services/localChatStore';
import { ChatGroupMember, ChatImageAttachment, ChatMediaAttachment, ChatMessage } from '../services/chatApi';
import { ChatItem } from '../components/groups/GroupInfoModal';
import { ChatMediaNetworkPolicy } from '../components/offlineSettings/OfflineChatSettings';
import { CurrentUserProfile } from '../services/profileApi';
import { DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS } from '../services/chatOfflineSettings';
import { LocalChatMediaInput } from '../services/chatMediaApi';
import { getCachedProfilePhotoUri } from '../services/profilePhotoCache';
import { getMediaLocalUri, getMessageMediaItems, toChatImageAttachment, uniqueChatMessages } from '../services/chatMessageReconciliation';
import { getMediaPreviewUri } from '../services/chatDisplayFormatting';

/**
 * Chat media policy and local-file bookkeeping.
 *
 * Decides what may download on the current network, how a local file is
 * recorded against a message, and how an edited photo becomes an attachment.
 * Lifted out of the chat screen unchanged.
 */

export interface ChatMediaHydrationCandidate {
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  media: ChatMediaAttachment;
  mediaIndex: number;
  messageId: string;
  priority: number;
  sentAt: string;
}

export interface SentPhotoEditorState {
  displayUri: string;
  fileName: string;
  height?: number;
  message: ChatMessage;
  sourceUri: string;
  width?: number;
}

const CHAT_SMALL_FILE_AUTO_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;

const CHAT_SMALL_IMAGE_PRIORITY_BYTES = 2 * 1024 * 1024;

const CHAT_CELLULAR_IMAGE_AUTO_DOWNLOAD_MAX_BYTES = 1.5 * 1024 * 1024;

const CHAT_WIFI_VIDEO_AUTO_DOWNLOAD_MAX_BYTES = 80 * 1024 * 1024;

export const CHAT_AUTO_MEDIA_DOWNLOAD_RECENT_WINDOW = 18;

export const CHAT_AUTO_MEDIA_DOWNLOAD_MAX_PER_PASS = 6;

export function applyMediaReviewQualityMode(
  media: LocalChatMediaInput,
  qualityMode: ChatMediaQualityMode
): LocalChatMediaInput {
  return {
    ...media,
    qualityMode
  };
}

export function buildLocalChatMediaAttachment(media: LocalChatMediaInput): ChatMediaAttachment {
  return {
    contentType: media.contentType,
    durationMs: media.durationMs,
    fileName: media.fileName,
    height: media.height,
    kind: media.kind,
    localUri: media.uri,
    nativeAssetIdentifier: media.nativeAssetIdentifier,
    qualityMode: media.qualityMode,
    sizeBytes: media.sizeBytes,
    thumbnailContentType: media.thumbnailContentType,
    thumbnailDataUrl: media.thumbnailDataUrl,
    thumbnailHeight: media.thumbnailHeight,
    thumbnailWidth: media.thumbnailWidth,
    transferProgress: 0,
    transferStatus: 'queued',
    width: media.width
  };
}

export function getPhotoEditorDisplayUri(media: ChatMediaAttachment | null): string {
  if (!media || media.kind !== 'image') {
    return '';
  }

  const localUri = getMediaLocalUri(media);
  const previewUri = getMediaPreviewUri(media);

  if (isRenderSafePhotoUri(localUri)) {
    return localUri;
  }

  if (isRenderSafePhotoUri(previewUri)) {
    return previewUri;
  }

  return previewUri || localUri || '';
}

export function isRenderSafePhotoUri(uri: string): boolean {
  if (!uri) {
    return false;
  }

  return /^file:\/\//i.test(uri) ||
    /^https?:\/\//i.test(uri) ||
    /^data:image\//i.test(uri) ||
    /^content:\/\//i.test(uri);
}

export function getSafePhotoDimension(value: unknown): number | undefined {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : NaN;

  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return undefined;
  }

  return Math.round(numericValue);
}

export function canDownloadChatMedia(media: ChatMediaAttachment | null | undefined): media is ChatMediaAttachment {
  if (!media?.mediaId || !media.key) {
    return false;
  }

  if (media.encryptionMode === 'chunked-secretbox-v1' || media.encryptionMode === 'native-chacha20poly1305-chunked-v1') {
    return Boolean(media.chunkSizeBytes && media.chunkSizeBytes > 0 && media.partCount && media.partCount > 0) &&
      Array.isArray(media.partNonces) &&
      media.partNonces.length === media.partCount;
  }

  return Boolean(media.nonce);
}

export function shouldSkipAutomaticMediaDownload(
  media: ChatMediaAttachment,
  networkPolicy = buildChatMediaNetworkPolicy(null, DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS)
): boolean {
  if (!networkPolicy.offlineMediaCacheAllowed) {
    return true;
  }

  const sizeBytes = Math.max(media.sizeBytes || 0, 0);

  if (media.kind === 'video') {
    return !networkPolicy.canAutoDownloadVideos ||
      sizeBytes <= 0 ||
      sizeBytes > CHAT_WIFI_VIDEO_AUTO_DOWNLOAD_MAX_BYTES ||
      sizeBytes > networkPolicy.mediaLimitBytes.video;
  }

  if (media.kind === 'image') {
    if (!networkPolicy.canAutoDownloadImages) {
      return true;
    }

    if (sizeBytes > networkPolicy.mediaLimitBytes.image) {
      return true;
    }

    return networkPolicy.isConnectionExpensive &&
      sizeBytes > CHAT_CELLULAR_IMAGE_AUTO_DOWNLOAD_MAX_BYTES;
  }

  if (media.kind !== 'file') {
    return false;
  }

  return !networkPolicy.canAutoDownloadFiles ||
    sizeBytes <= 0 ||
    sizeBytes > CHAT_SMALL_FILE_AUTO_DOWNLOAD_MAX_BYTES ||
    sizeBytes > networkPolicy.mediaLimitBytes.file;
}

export function getChatMediaHydrationPriority(
  media: ChatMediaAttachment,
  networkPolicy = buildChatMediaNetworkPolicy(null, DEFAULT_CHAT_OFFLINE_POLICY_SETTINGS)
): number {
  const sizeBytes = Math.max(media.sizeBytes || 0, 0);

  if (media.thumbnailDataUrl && media.kind === 'video') {
    return 25;
  }

  if (media.kind === 'image') {
    if (sizeBytes > 0 && sizeBytes <= CHAT_SMALL_IMAGE_PRIORITY_BYTES) {
      return 10;
    }

    return networkPolicy.isConnectionExpensive ? 45 : 20;
  }

  if (media.kind === 'audio') {
    return networkPolicy.isConnectionExpensive ? 55 : 30;
  }

  if (media.kind === 'file') {
    return networkPolicy.isConnectionExpensive ? 80 : 40;
  }

  if (media.kind === 'video') {
    return 70;
  }

  return 90;
}

export function compareChatMediaHydrationCandidates(
  first: ChatMediaHydrationCandidate,
  second: ChatMediaHydrationCandidate
): number {
  if (first.priority !== second.priority) {
    return first.priority - second.priority;
  }

  const firstTime = Date.parse(first.sentAt);
  const secondTime = Date.parse(second.sentAt);
  const firstSafeTime = Number.isFinite(firstTime) ? firstTime : 0;
  const secondSafeTime = Number.isFinite(secondTime) ? secondTime : 0;

  return secondSafeTime - firstSafeTime;
}

export function buildChatMediaNetworkPolicy(
  state: NetInfoState | null,
  settings: ChatOfflinePolicySettings
): ChatMediaNetworkPolicy {
  const isConnected = state?.isConnected !== false && state?.isInternetReachable !== false;
  const isConnectionExpensive = Boolean(state?.details?.isConnectionExpensive);
  const type = state?.type || 'unknown';
  const isCellular = type === 'cellular';
  const isWifiOnlyBlocked = settings.wifiOnlyMediaPrefetch && type !== 'wifi';
  const canAutoDownloadImages = isConnected && settings.offlineMediaCacheAllowed && !isWifiOnlyBlocked;
  const canAutoDownloadFiles = isConnected && settings.offlineMediaCacheAllowed && !isWifiOnlyBlocked && !isCellular && !isConnectionExpensive;
  const canAutoDownloadVideos = canAutoDownloadFiles;

  return {
    cacheRetentionDays: settings.cacheRetentionDays,
    canAutoDownloadFiles,
    canAutoDownloadImages,
    canAutoDownloadVideos,
    fullMediaCacheBudgetBytes: settings.fullMediaCacheBudgetBytes,
    isConnectionExpensive: isCellular || isConnectionExpensive,
    mediaLimitBytes: settings.mediaLimitBytes,
    networkLabel: type,
    offlineMediaCacheAllowed: settings.offlineMediaCacheAllowed,
    wifiOnlyMediaPrefetch: settings.wifiOnlyMediaPrefetch
  };
}

export function getMediaItemsSize(mediaItems: ChatMediaAttachment[]): number {
  return mediaItems.reduce((total, media) => total + Math.max(media.sizeBytes || 0, 0), 0);
}

export async function clearDownloadedMediaFilesFromMessages(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const uniqueMessagesForCleanup = uniqueChatMessages(messages);
  const deletableLocalUris = new Set<string>();

  uniqueMessagesForCleanup.forEach((message) => {
    getMessageMediaItems(message).forEach((media) => {
      const localUri = getDeletableLocalMediaUri(media);

      if (localUri) {
        deletableLocalUris.add(localUri);
      }
    });
  });

  await Promise.all([...deletableLocalUris].map((localUri) =>
    FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined)
  ));

  return uniqueMessagesForCleanup.map(clearLocalMediaReferencesFromMessage);
}

export function clearLocalMediaReferencesFromMessage(message: ChatMessage): ChatMessage {
  const mediaItems = getMessageMediaItems(message).map(clearLocalMediaReference);
  const primaryMedia = mediaItems[0] || null;

  return {
    ...message,
    image: primaryMedia?.kind === 'image' ? toChatImageAttachment(primaryMedia) : null,
    media: primaryMedia,
    mediaItems: Array.isArray(message.mediaItems) && message.mediaItems.length ? mediaItems : []
  };
}

export function clearLocalMediaReference(media: ChatMediaAttachment): ChatMediaAttachment {
  const nextMedia: ChatMediaAttachment = {
    ...media,
    localUri: undefined,
    transferProgress: undefined,
    transferStatus: undefined
  };

  if (nextMedia.kind === 'image') {
    const imageAttachment: ChatImageAttachment = {
      ...toChatImageAttachment(nextMedia),
      dataUrl: undefined
    };

    return imageAttachment;
  }

  return nextMedia;
}

export function getDeletableLocalMediaUri(media: ChatMediaAttachment): string {
  const localUri = typeof media.localUri === 'string' ? media.localUri.trim() : '';

  if (!localUri || localUri.startsWith('data:')) {
    return '';
  }

  const allowedPrefixes = [FileSystem.documentDirectory, FileSystem.cacheDirectory]
    .filter((prefix): prefix is string => Boolean(prefix));

  return allowedPrefixes.some((prefix) => localUri.startsWith(prefix))
    ? localUri
    : '';
}

export function hasClearableLocalMedia(media: ChatMediaAttachment): boolean {
  return Boolean(getDeletableLocalMediaUri(media));
}

export function toLocalChatMediaInput(media: ChatMediaAttachment): LocalChatMediaInput {
  if (!media.localUri || media.localUri.startsWith('data:')) {
    throw new Error('This media is not available on this device yet.');
  }

  return {
    contentType: media.contentType,
    durationMs: media.durationMs,
    fileName: media.fileName,
    height: media.height,
    kind: media.kind,
    thumbnailContentType: media.thumbnailContentType,
    thumbnailDataUrl: media.thumbnailDataUrl,
    thumbnailHeight: media.thumbnailHeight,
    thumbnailWidth: media.thumbnailWidth,
    sizeBytes: media.sizeBytes,
    uri: media.localUri,
    width: media.width
  };
}

export async function createLocalMediaFromEditedPhoto(input: {
  fileName: string;
  height?: number;
  uri: string;
  width?: number;
}): Promise<LocalChatMediaInput> {
  const fileName = getEditedPhotoFileName(input.fileName);
  const info = await FileSystem.getInfoAsync(input.uri);
  const sizeBytes = info.exists && typeof info.size === 'number'
    ? info.size
    : 1;
  const thumbnail = await ImageManipulator.manipulateAsync(
    input.uri,
    [{ resize: { width: 360 } }],
    {
      base64: true,
      compress: 0.54,
      format: ImageManipulator.SaveFormat.JPEG
    }
  ).catch(() => null);

  return {
    contentType: 'image/jpeg',
    fileName,
    height: input.height,
    kind: 'image',
    originalContentType: 'image/jpeg',
    originalHeight: input.height,
    originalSizeBytes: sizeBytes,
    originalUri: input.uri,
    originalWidth: input.width,
    qualityMode: 'standard',
    sizeBytes,
    thumbnailContentType: thumbnail?.base64 ? 'image/jpeg' : undefined,
    thumbnailDataUrl: thumbnail?.base64 ? `data:image/jpeg;base64,${thumbnail.base64}` : undefined,
    thumbnailHeight: thumbnail?.height,
    thumbnailWidth: thumbnail?.width,
    uri: input.uri,
    width: input.width
  };
}

export function getEditedPhotoFileName(fileName: string): string {
  const baseName = (fileName || 'photo.jpg')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'photo';

  return `${baseName}_edited.jpg`;
}

export async function cacheCurrentUserProfilePhoto(
  profile: CurrentUserProfile,
  idToken: string
): Promise<CurrentUserProfile> {
  const cachedPhotoUri = await getCachedProfilePhotoUri({
    cacheKey: profile.profilePhotoCacheKey,
    idToken,
    profilePhotoUrl: profile.profilePhotoUrl
  });

  return {
    ...profile,
    profilePhotoUrl: cachedPhotoUri
  };
}

export async function cacheChatGroupMemberPhotos(
  members: ChatGroupMember[],
  idToken: string
): Promise<ChatGroupMember[]> {
  return mapWithLimitedConcurrency(members, 4, async (member) => ({
    ...member,
    profilePhotoUrl: await getCachedProfilePhotoUri({
      cacheKey: member.profilePhotoCacheKey,
      idToken,
      profilePhotoUrl: member.profilePhotoUrl
    }) || member.profilePhotoUrl
  }));
}

export async function mapWithLimitedConcurrency<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;

      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      await yieldToChatUi();
    }
  }));

  return results;
}

export function yieldToChatUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

export function canCurrentUserChangeGroupPhoto(
  chat: ChatItem | null,
  profile: CurrentUserProfile | null
): boolean {
  if (!chat || chat.chatType !== 'GROUP' || !profile) {
    return false;
  }

  const isDepartmentGroup = chat.isDepartmentDefault === true ||
    chat.memberPolicy === 'DEPARTMENT_PLUS_EXPLICIT';

  if (isDepartmentGroup) {
    return profile.role === 'ORG_ADMIN' || profile.role === 'DEPT_ADMIN';
  }

  return true;
}

export function applyMediaUpdateToMessage(
  message: ChatMessage,
  media: ChatMediaAttachment,
  mediaIndex?: number
): ChatMessage {
  const currentMediaItems = getMessageMediaItems(message);

  if (typeof mediaIndex === 'number' && currentMediaItems.length > 1) {
    const nextMediaItems = currentMediaItems.map((mediaItem, index) =>
      index === mediaIndex ? media : mediaItem
    );
    const primaryMedia = nextMediaItems[0] || media;

    return {
      ...message,
      image: primaryMedia.kind === 'image' ? toChatImageAttachment(primaryMedia) : null,
      media: primaryMedia,
      mediaItems: nextMediaItems
    };
  }

  return {
    ...message,
    image: media.kind === 'image' ? toChatImageAttachment(media) : null,
    media,
    mediaItems: currentMediaItems.length > 1 ? currentMediaItems : []
  };
}

export function applyCachedMediaRecordsToMessage(
  message: ChatMessage,
  mediaRecords: LocalCachedChatMediaRecord[]
): ChatMessage {
  const sortedMediaRecords = [...mediaRecords]
    .filter((record) => record.messageId === message.messageId)
    .sort((first, second) => first.mediaIndex - second.mediaIndex);

  if (!sortedMediaRecords.length) {
    return message;
  }

  return sortedMediaRecords.reduce((nextMessage, record) =>
    applyMediaUpdateToMessage(nextMessage, record.media, record.mediaIndex),
    message
  );
}
