import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import type { AudioMode } from 'expo-audio';
import { getReadableFileExtension } from '../services/chatMessagePreview';

/**
 * Audio playback and sharing for chat attachments.
 *
 * The `safe*` wrappers exist because Expo can release a player's native object
 * before React's cleanup runs, so a pause on unmount throws against an object
 * that is already gone. Sharing copies the track into its own cache directory
 * under a readable name first — iOS shares the file as it is named on disk, and
 * an opaque media id is not what anyone wants to receive.
 */

export interface AudioAttachmentPreviewState {
  contentType: string;
  fileName: string;
  localUri: string;
  sizeBytes: number;
}

export const CHAT_AUDIO_PLAYBACK_MODE: AudioMode = {
  allowsBackgroundRecording: false,
  allowsRecording: false,
  interruptionMode: 'duckOthers' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  shouldRouteThroughEarpiece: false
};

const chatAudioShareDirectory = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}Synzapp/SharedAudio/`
  : '';

export function getSafeAudioShareExtension(contentType?: string | null, fileName?: string | null): string {
  const safeContentType = (contentType || '').trim().toLowerCase();
  const extension = getReadableFileExtension(fileName).toLowerCase();

  if (safeContentType === 'audio/mpeg' || extension === 'mp3') {
    return 'mp3';
  }

  if (safeContentType === 'audio/mp4' || safeContentType === 'audio/x-m4a' || extension === 'm4a') {
    return 'm4a';
  }

  if (safeContentType === 'audio/aac' || extension === 'aac') {
    return 'aac';
  }

  if (safeContentType === 'audio/wav' || safeContentType === 'audio/x-wav' || extension === 'wav') {
    return 'wav';
  }

  if (safeContentType === 'audio/3gpp' || extension === '3gp') {
    return '3gp';
  }

  if (safeContentType === 'audio/webm' || extension === 'webm') {
    return 'webm';
  }

  if (['aif', 'aiff', 'amr', 'flac', 'oga', 'ogg', 'opus', 'wma'].includes(extension)) {
    return extension;
  }

  return 'mp3';
}

function buildSafeChatAudioShareFileName(state: AudioAttachmentPreviewState): string {
  const extension = getSafeAudioShareExtension(state.contentType, state.fileName);
  const timestamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace('Z', '');

  return `Synzapp-Audio-Track-${timestamp}.${extension}`;
}

export function getAudioAttachmentUniformTypeIdentifier(contentType?: string | null, fileName?: string | null): string | undefined {
  const safeContentType = (contentType || '').trim().toLowerCase();
  const extension = getReadableFileExtension(fileName).toLowerCase();

  if (safeContentType === 'audio/mpeg' || extension === 'mp3') {
    return 'public.mp3';
  }

  if (safeContentType === 'audio/mp4' || extension === 'm4a') {
    return 'public.mpeg-4-audio';
  }

  if (safeContentType === 'audio/aac' || extension === 'aac') {
    return 'public.aac-audio';
  }

  if (safeContentType === 'audio/wav' || safeContentType === 'audio/x-wav' || extension === 'wav') {
    return 'com.microsoft.waveform-audio';
  }

  if (safeContentType.startsWith('audio/')) {
    return 'public.audio';
  }

  return undefined;
}

export async function prepareChatAudioAttachmentShareUri(
  state: AudioAttachmentPreviewState,
  sourceUri: string
): Promise<string> {
  if (!chatAudioShareDirectory) {
    throw new Error('Audio sharing is not available on this device.');
  }

  await FileSystem.makeDirectoryAsync(chatAudioShareDirectory, { intermediates: true }).catch(() => undefined);

  const fileName = buildSafeChatAudioShareFileName(state);
  const shareUri = `${chatAudioShareDirectory}${fileName}`;

  await FileSystem.deleteAsync(shareUri, { idempotent: true }).catch(() => undefined);

  if (sourceUri.startsWith('file://')) {
    await FileSystem.copyAsync({ from: sourceUri, to: shareUri });
  } else {
    await FileSystem.downloadAsync(sourceUri, shareUri);
  }

  return shareUri;
}

export function safePauseAudioPlayer(player: { pause: () => void }): void {
  try {
    player.pause();
  } catch {
    // Expo may release the native shared object before React cleanup runs.
  }
}

export function safePlayAudioPlayer(player: { play: () => void }): void {
  try {
    player.play();
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to play this audio.');
  }
}

export function safeReplaceAudioPlayerSource(
  player: { replace: (source: { uri: string }) => void },
  uri: string
): void {
  try {
    player.replace({ uri });
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to load this audio.');
  }
}
