import * as FileSystem from 'expo-file-system/legacy';
import type { CompanyLibraryItem } from '../services/companyLibraryApi';
import type { LocalConversationRecord } from '../services/localChatStore';
import { ChatContact, ChatMediaAttachment, ChatMessage } from '../services/chatApi';
import { getMediaLocalUri, getMessageMediaItems } from '../services/chatMessageReconciliation';
import { getSafeAudioShareExtension } from '../services/chatAudioPlayback';
import { normalizeCompanyLibraryBucketValue } from '../services/companyLibraryDisplay';

/**
 * Building Company Library entries out of chat media.
 *
 * Lifted out of the chat screen unchanged.
 */

export const companyLibraryAudioPreviewDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}Synzapp/LibraryAudio/`
  : '';

export function buildCompanyLibraryItemsFromChatConversations({
  conversations,
  currentUid,
  currentUserDepartmentName,
  currentUserName
}: {
  conversations: LocalConversationRecord[];
  currentUid: string;
  currentUserDepartmentName: string;
  currentUserName: string;
}): CompanyLibraryItem[] {
  const items: CompanyLibraryItem[] = [];

  conversations.forEach((conversation) => {
    const contact = conversation.contact;
    const chatType = contact?.chatType || 'DIRECT';
    const sourceArea = chatType === 'GROUP'
      ? getCompanyLibraryGroupSourceArea(contact)
      : 'chat';
    const sourceLabel = chatType === 'GROUP'
      ? contact?.displayName || 'Group chat'
      : 'Chats';
    const sourceId = contact?.contactId || conversation.contactId;

    conversation.messages.forEach((message) => {
      getMessageMediaItems(message).forEach((media, mediaIndex) => {
        const item = buildCompanyLibraryItemFromChatMedia({
          chatType,
          contact,
          conversationId: conversation.contactId,
          currentUid,
          currentUserDepartmentName,
          currentUserName,
          media,
          mediaIndex,
          message,
          sourceArea,
          sourceId,
          sourceLabel
        });

        if (item) {
          items.push(item);
        }
      });
    });
  });

  return items;
}

export function buildCompanyLibraryItemFromChatMedia({
  chatType,
  contact,
  conversationId,
  currentUid,
  currentUserDepartmentName,
  currentUserName,
  media,
  mediaIndex,
  message,
  sourceArea,
  sourceId,
  sourceLabel
}: {
  chatType: 'DIRECT' | 'GROUP';
  contact: ChatContact | null;
  conversationId: string;
  currentUid: string;
  currentUserDepartmentName: string;
  currentUserName: string;
  media: ChatMediaAttachment;
  mediaIndex: number;
  message: ChatMessage;
  sourceArea: string;
  sourceId: string;
  sourceLabel: string;
}): CompanyLibraryItem | null {
  if (!media?.fileName) {
    return null;
  }

  const mediaUri = getCompanyLibraryChatMediaUri(media);
  const sender = getCompanyLibraryChatSender({
    contact,
    currentUid,
    currentUserName,
    senderUid: message.senderUid
  });
  const sourceKey = normalizeCompanyLibraryBucketValue(sourceId || conversationId);
  const sourceLabelKey = normalizeCompanyLibraryBucketValue(sourceLabel);
  const departmentKey = normalizeCompanyLibraryBucketValue(currentUserDepartmentName);
  const scopes = [
    chatType === 'DIRECT' ? 'chat' : sourceArea,
    sourceArea,
    sourceKey ? `${sourceArea}:${sourceKey}` : '',
    sourceLabelKey ? `${sourceArea}:${sourceLabelKey}` : '',
    sourceArea === 'department' && departmentKey ? `department:${departmentKey}` : ''
  ].filter(Boolean);

  return {
    contentType: media.contentType || null,
    // Chat media already carries a poster captured when it was sent, so a video
    // from a conversation has a thumbnail without downloading anything.
    thumbnailUrl: media.thumbnailDataUrl || null,
    evidenceId: [
      'chat',
      conversationId,
      message.messageId,
      media.mediaId || media.fileName,
      mediaIndex
    ].map((segment) => normalizeCompanyLibraryBucketValue(String(segment))).join(':'),
    fileName: media.fileName,
    fileSizeBytes: typeof media.sizeBytes === 'number' ? media.sizeBytes : null,
    fileUrl: mediaUri || null,
    label: media.fileName || 'Chat file',
    libraryScopes: Array.from(new Set(scopes)),
    note: message.text || '',
    sourceArea,
    sourceId: sourceId || conversationId,
    sourceLabel,
    uploadedAtIso: message.sentAt || null,
    uploadedByDepartmentName: sender.departmentName,
    uploadedByName: sender.name,
    uploadedByProfilePhotoUrl: sender.profilePhotoUrl,
    uploadedByRoleName: sender.roleName,
    uploadedByUid: message.senderUid || null,
    visibility: 'private'
  };
}

export function getCompanyLibraryGroupSourceArea(contact: ChatContact | null): 'department' | 'group' {
  return contact?.isDepartmentDefault ? 'department' : 'group';
}

/**
 * The playable file behind a Library entry, never a stand-in for it.
 *
 * This used to return the preview URI, which for a video is its poster frame —
 * so the Library handed the player a JPEG and playback failed with a broken
 * file marker. The poster belongs in `thumbnailUrl`; this is the file itself.
 *
 * An image may still fall back to its embedded copy, because that copy is a
 * genuine, viewable version of the image rather than a picture of it.
 */
export function getCompanyLibraryChatMediaUri(media: ChatMediaAttachment): string {
  const localUri = getMediaLocalUri(media);

  if (localUri) {
    return localUri;
  }

  return media.kind === 'image' ? media.thumbnailDataUrl || '' : '';
}

export function getCompanyLibraryChatSender({
  contact,
  currentUid,
  currentUserName,
  senderUid
}: {
  contact: ChatContact | null;
  currentUid: string;
  currentUserName: string;
  senderUid: string;
}): {
  departmentName: string | null;
  name: string | null;
  profilePhotoUrl: string | null;
  roleName: string | null;
} {
  if (senderUid && senderUid === currentUid) {
    return {
      departmentName: null,
      name: currentUserName || 'You',
      profilePhotoUrl: null,
      roleName: null
    };
  }

  const member = contact?.members?.find((entry) => entry.uid === senderUid) || null;

  if (member) {
    return {
      departmentName: null,
      name: member.displayName || null,
      profilePhotoUrl: member.profilePhotoUrl || null,
      roleName: member.roleName || null
    };
  }

  return {
    departmentName: null,
    name: contact?.displayName || null,
    profilePhotoUrl: contact?.profilePhotoUrl || null,
    roleName: contact?.roleName || null
  };
}

export function sortCompanyLibraryItemsByDate(items: CompanyLibraryItem[]): CompanyLibraryItem[] {
  return [...items].sort((first, second) =>
    Date.parse(second.uploadedAtIso || '') - Date.parse(first.uploadedAtIso || '')
  );
}

export async function prepareCompanyLibraryAudioPreviewUri(
  item: CompanyLibraryItem,
  fileHeaders?: Record<string, string>
): Promise<string> {
  const sourceUri = (item.fileUrl || '').trim();

  if (!sourceUri) {
    throw new Error('This Library audio file is not available.');
  }

  if (sourceUri.startsWith('file://') || sourceUri.startsWith('data:')) {
    return sourceUri;
  }

  if (!/^https?:\/\//i.test(sourceUri)) {
    return sourceUri;
  }

  if (!companyLibraryAudioPreviewDirectory) {
    throw new Error('Audio playback is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(companyLibraryAudioPreviewDirectory, { intermediates: true }).catch(() => undefined);

  const extension = getSafeAudioShareExtension(item.contentType, item.fileName || item.label);
  const previewFileName = buildSafeCompanyLibraryAudioPreviewFileName(item, extension);
  const localUri = `${companyLibraryAudioPreviewDirectory}${previewFileName}`;
  const existingFile = await FileSystem.getInfoAsync(localUri).catch(() => null);

  if (existingFile?.exists) {
    return localUri;
  }

  const downloadOptions = fileHeaders ? { headers: fileHeaders } : undefined;
  const downloadResult = downloadOptions
    ? await FileSystem.downloadAsync(sourceUri, localUri, downloadOptions)
    : await FileSystem.downloadAsync(sourceUri, localUri);

  if (!downloadResult.uri) {
    throw new Error('This Library audio file could not be downloaded.');
  }

  return downloadResult.uri;
}

export function buildSafeCompanyLibraryAudioPreviewFileName(item: CompanyLibraryItem, extension: string): string {
  const sourceName = item.evidenceId || item.fileName || item.label || 'audio';
  const uploadedAtStamp = item.uploadedAtIso
    ? new Date(item.uploadedAtIso).getTime().toString(36)
    : 'latest';
  const safeBaseName = sourceName
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'audio';

  return `${safeBaseName}-${uploadedAtStamp}.${extension}`;
}
