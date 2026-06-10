import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

const androidReadUriPermissionFlag = 1;

export async function openChatAttachmentFile(input: {
  contentType: string;
  fileName: string;
  localUri: string;
}): Promise<void> {
  if (isAudioAttachment(input)) {
    await openAudioAttachment(input);
    return;
  }

  if (Platform.OS === 'android') {
    await openAndroidAttachment(input);
    return;
  }

  await openSharedAttachment(input);
}

async function openAudioAttachment(input: {
  contentType: string;
  fileName: string;
  localUri: string;
}): Promise<void> {
  if (Platform.OS === 'android') {
    await openAndroidAttachment(input);
    return;
  }

  try {
    await Linking.openURL(input.localUri);
  } catch {
    throw new Error('No audio player is available to open this attachment.');
  }
}

async function openAndroidAttachment(input: {
  contentType: string;
  fileName: string;
  localUri: string;
}): Promise<void> {
  try {
    const contentUri = await FileSystem.getContentUriAsync(input.localUri);

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: androidReadUriPermissionFlag,
      type: getSafeContentType(input.contentType)
    });
  } catch (error) {
    try {
      await openSharedAttachment(input);
    } catch {
      throw error;
    }
  }
}

async function openSharedAttachment(input: {
  contentType: string;
  fileName: string;
  localUri: string;
}): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    throw new Error('No app is available to open this file.');
  }

  await Sharing.shareAsync(input.localUri, {
    dialogTitle: input.fileName || 'Open file',
    mimeType: getSafeContentType(input.contentType),
    UTI: getAppleUniformTypeIdentifier(input.contentType)
  });
}

function getSafeContentType(contentType: string): string {
  return contentType.trim().toLowerCase() || 'application/octet-stream';
}

function isAudioAttachment(input: {
  contentType: string;
  fileName: string;
}): boolean {
  const safeContentType = getSafeContentType(input.contentType);

  if (safeContentType.startsWith('audio/')) {
    return true;
  }

  const extension = input.fileName.split('.').pop()?.trim().toLowerCase();

  return Boolean(extension && [
    'aac',
    'aif',
    'aiff',
    'amr',
    'flac',
    'm4a',
    'mp3',
    'oga',
    'ogg',
    'opus',
    'wav',
    'weba',
    'wma'
  ].includes(extension));
}

function getAppleUniformTypeIdentifier(contentType: string): string | undefined {
  const safeContentType = getSafeContentType(contentType);

  if (safeContentType === 'application/pdf') {
    return 'com.adobe.pdf';
  }

  if (safeContentType.startsWith('image/')) {
    return 'public.image';
  }

  if (safeContentType.startsWith('audio/')) {
    return 'public.audio';
  }

  if (safeContentType.startsWith('video/')) {
    return 'public.movie';
  }

  if (safeContentType.startsWith('text/')) {
    return 'public.text';
  }

  return undefined;
}
