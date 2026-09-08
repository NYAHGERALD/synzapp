import * as ImagePicker from 'expo-image-picker';
import {
  MAX_ATTACHMENTS,
  toPickedMedia,
  type PickedActionMedia
} from './actionAttachmentRules';
import {
  reserveActionUpload,
  uploadActionFile,
  type ActionUploadTicket
} from './actionApi';

/**
 * Picking and uploading the photos on an action.
 *
 * Deliberately not the chat media pipeline. That one seals each file to the
 * devices in one conversation, and an action is read by a group the raiser may
 * not belong to, so those keys would be the wrong keys. See section 8 of the
 * Create Action plan.
 */

export async function pickActionMedia(remaining: number): Promise<PickedActionMedia[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Synzapp needs permission to open your photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
    selectionLimit: Math.max(1, Math.min(remaining, MAX_ATTACHMENTS))
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(toPickedMedia);
}

export async function takeActionPhoto(): Promise<PickedActionMedia[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Synzapp needs permission to use the camera.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(toPickedMedia);
}

/**
 * Uploads what was picked and returns the ids to name when creating.
 *
 * One at a time rather than all at once: a phone on a factory wifi that starts
 * eight uploads together finishes none of them.
 */
export async function uploadPickedMedia(input: {
  idToken: string;
  media: PickedActionMedia[];
  onProgress?: (done: number, total: number) => void;
}): Promise<string[]> {
  const ids: string[] = [];

  for (const [index, item] of input.media.entries()) {
    const ticket: ActionUploadTicket = await reserveActionUpload({
      contentType: item.contentType,
      idToken: input.idToken,
      kind: item.kind,
      sizeBytes: item.sizeBytes
    });

    await uploadActionFile({
      contentType: item.contentType,
      fileUri: item.uri,
      uploadUrl: ticket.uploadUrl
    });

    ids.push(ticket.attachmentId);
    input.onProgress?.(index + 1, input.media.length);
  }

  return ids;
}

export {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  describeTooLarge,
  isTooLarge,
  toPickedMedia,
  type PickedActionMedia
} from './actionAttachmentRules';
