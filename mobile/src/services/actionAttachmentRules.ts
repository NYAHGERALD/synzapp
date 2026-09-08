import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * The rules about what may be attached to an action.
 *
 * Deliberately free of any native import so they can be tested directly, and
 * so the same numbers are used by the picker, the create sheet and the checks
 * shown to a person before they wait for an upload.
 */

export interface PickedActionMedia {
  contentType: string;
  fileName: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  uri: string;
}

/** The same limit the server enforces, so the refusal happens before the wait. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const MAX_ATTACHMENTS = 10;

export function isTooLarge(media: { sizeBytes: number }): boolean {
  return media.sizeBytes > MAX_ATTACHMENT_BYTES;
}

/** What a person should be told when a file is refused. */
export function describeTooLarge(media: PickedActionMedia): string {
  const mb = Math.round(media.sizeBytes / (1024 * 1024));

  return `${media.fileName} is ${mb} MB. The limit is 50 MB.`;
}

export function toPickedMedia(asset: ImagePickerAsset): PickedActionMedia {
  const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
  const fallbackType = kind === 'video' ? 'video/mp4' : 'image/jpeg';

  return {
    contentType: asset.mimeType || fallbackType,
    fileName: asset.fileName || (kind === 'video' ? 'clip' : 'photo'),
    kind,
    sizeBytes: asset.fileSize || 0,
    uri: asset.uri
  };
}
