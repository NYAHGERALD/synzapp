import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { shouldUnmirrorCapture, type CapturedChatMedia } from './chatCameraCapture';
import type { LocalChatMediaInput } from './chatMediaApi';

export type { CapturedChatMedia } from './chatCameraCapture';

/**
 * Turns a capture from the app's own camera into an outgoing attachment.
 *
 * Nothing is extracted and nothing is copied. The recording is already on disk
 * where the camera put it, and its poster was kept from the viewfinder while it
 * was still on screen, so this is bookkeeping rather than work.
 *
 * Compare with what a capture from the system picker still has to go through in
 * `chatAttachmentPicker`: the picker copies the file out of the camera app,
 * then the poster has to be read back out of the finished video. That is the
 * path this exists to avoid, and it is why a recording used to sit in the chat
 * without a still for seconds.
 */
export async function buildLocalMediaFromCapture(
  captured: CapturedChatMedia
): Promise<LocalChatMediaInput> {
  const uprighted = shouldUnmirrorCapture(captured)
    ? await unmirror(captured)
    : captured;
  const sizeBytes = await readFileSize(uprighted.uri);

  return {
    contentType: uprighted.contentType,
    durationMs: uprighted.durationMs,
    fileName: uprighted.fileName,
    height: uprighted.height,
    kind: uprighted.kind,
    originalContentType: uprighted.contentType,
    originalHeight: uprighted.height,
    originalSizeBytes: sizeBytes,
    originalUri: uprighted.uri,
    originalWidth: uprighted.width,
    qualityMode: 'standard',
    sizeBytes,
    thumbnailContentType: uprighted.posterDataUrl ? 'image/jpeg' : undefined,
    thumbnailDataUrl: uprighted.posterDataUrl || undefined,
    uri: uprighted.uri,
    width: uprighted.width
  };
}

/**
 * Turns a selfie back the right way round.
 *
 * A front camera writes what the lens sees, which is the reverse of the mirror
 * the person was looking at, so writing on a shirt or a whiteboard reads
 * backwards. The app could not tell before, because the system picker never
 * says which lens took the picture, so this was offered in the review screen
 * and left for somebody to notice. Running the camera means it is simply known.
 *
 * A flip that fails returns the capture untouched. A backwards photo is a small
 * problem; a photo that will not send is a large one.
 */
async function unmirror(captured: CapturedChatMedia): Promise<CapturedChatMedia> {
  try {
    const flipped = await ImageManipulator.manipulateAsync(
      captured.uri,
      [{ flip: ImageManipulator.FlipType.Horizontal }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      ...captured,
      height: flipped.height || captured.height,
      uri: flipped.uri,
      width: flipped.width || captured.width
    };
  } catch {
    return captured;
  }
}

async function readFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);

  return info?.exists && typeof info.size === 'number' && info.size > 0 ? info.size : 1;
}
