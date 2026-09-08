import * as DocumentPicker from 'expo-document-picker';
import { buildRecordedChatMediaFileName } from './chatMediaNaming';
import { readNativeVideoPoster } from './nativeMediaPicker';
import {
  resolvePosterRotationDegrees,
  settleWithinTimeLimit,
  VIDEO_POSTER_PICK_TIME_LIMIT_MS
} from './chatMediaPosterRules';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import {
  CHAT_MEDIA_LIMITS,
  type ChatMediaQualityMode,
  type LocalChatMediaInput
} from './chatMediaApi';
import {
  pickNativeMediaAssets,
  type NativeMediaAsset
} from './nativeMediaPicker';

const CHAT_LIBRARY_SELECTION_LIMIT = 10;
export const PHOTO_ACCESS_DENIED_MESSAGE =
  'Synzapp needs access to your photos to send media. Turn on Photos access for Synzapp in Settings.';
const CHAT_MEDIA_PICKER_PREPARATION_CONCURRENCY = 2;
const CHAT_MEDIA_THUMBNAIL_WIDTHS = [360, 280, 220];
/** Tried in turn on the already-shrunken picture, never on the camera frame. */
const CHAT_MEDIA_THUMBNAIL_FALLBACK_QUALITIES = [0.42, 0.32, 0.24];
/**
 * Bounded so a long thread cannot be sunk by its own thumbnails.
 *
 * The thumbnail travels inside the message and is therefore held in memory for
 * every message the thread has loaded, and the local cache holds a thousand of
 * them. At the old ceiling of 120 KB that is 120 MB of base64 strings in the
 * worst case, before a single one is decoded, which is how a chat full of
 * photos turns into a freeze on a mid-range Android.
 *
 * A bubble draws this at roughly 200pt wide, so the ladder of widths below
 * still starts at 360 and only steps down for the images that will not fit.
 * Only the heaviest few are affected, and the tail is bounded at a third of
 * what it was.
 */
const CHAT_MEDIA_THUMBNAIL_MAX_BASE64_BYTES = 40 * 1024;

interface PreparedMediaThumbnail {
  contentType: 'image/jpeg';
  dataUrl: string;
  height: number;
  width: number;
}

export interface IPhonePhotoPreparationProgress {
  fileName: string;
  progress: number;
}

export function needsIphonePhotoSendPreparation(media: LocalChatMediaInput): boolean {
  return media.kind === 'image' && isIphonePhotoContentType(media.contentType);
}

export async function prepareIphonePhotoMediaForSend(
  media: LocalChatMediaInput,
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void
): Promise<LocalChatMediaInput> {
  if (!needsIphonePhotoSendPreparation(media)) {
    return media;
  }

  const fileName = getPreparedIphonePhotoFileNameFromName(media.fileName);

  onIphonePhotoProgress?.({ fileName, progress: 0.12 });

  const converted = await ImageManipulator.manipulateAsync(
    media.uri,
    [],
    {
      compress: 0.94,
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  onIphonePhotoProgress?.({ fileName, progress: 0.62 });

  const sizeBytes = await getFileSize(converted.uri);

  if (sizeBytes > CHAT_MEDIA_LIMITS.image) {
    throw new Error(`This photo is ${formatPickerByteCount(sizeBytes)} after preparing. Synzapp currently allows photos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.image)}.`);
  }

  const preparedMedia = await attachMediaThumbnail({
    ...media,
    contentType: 'image/jpeg',
    fileName,
    height: converted.height || media.height,
    originalContentType: media.originalContentType || media.contentType,
    originalHeight: media.originalHeight || media.height,
    originalSizeBytes: media.originalSizeBytes || media.sizeBytes,
    originalUri: converted.uri,
    originalWidth: media.originalWidth || media.width,
    sizeBytes: sizeBytes > 0 ? sizeBytes : 1,
    uri: converted.uri,
    width: converted.width || media.width
  }, converted.uri);

  onIphonePhotoProgress?.({ fileName, progress: 1 });

  return preparedMedia;
}

export async function pickNativeChatLibraryMedia(
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput[] | null> {
  let nativeResult = null;

  try {
    nativeResult = await pickNativeMediaAssets({ limit: CHAT_LIBRARY_SELECTION_LIMIT });
  } catch (error) {
    // A refused photo permission is a decision, not a failure to route around.
    // Falling through to the Expo picker here would open a second gallery right
    // after the user was asked - which is exactly the double-prompt this flow is
    // meant to avoid.
    if (isPhotoAccessDeniedError(error)) {
      throw new Error(PHOTO_ACCESS_DENIED_MESSAGE);
    }

    if (Platform.OS === 'ios') {
      throw normalizeNativeLibraryPickerError(error);
    }
  }

  if (nativeResult?.canceled) {
    return null;
  }

  if (nativeResult?.assets.length) {
    return Promise.all(
      nativeResult.assets.map((asset) => withNativeAssetThumbnail(
        buildNativeSelectedMediaInput(asset, qualityMode),
        asset
      ))
    );
  }

  if (Platform.OS === 'ios') {
    console.warn('Synzapp native media picker returned no usable assets; falling back to the system media picker.');
  }

  const result = await launchLibrary().catch((error) => {
    throw normalizePhotoLibraryError(error);
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return prepareSystemPickerAssets(result.assets.slice(0, CHAT_LIBRARY_SELECTION_LIMIT), onIphonePhotoProgress, qualityMode);
}

function buildNativeSelectedMediaInput(
  asset: NativeMediaAsset,
  qualityMode: ChatMediaQualityMode
): LocalChatMediaInput {
  const fallbackContentType = asset.kind === 'video' ? 'video/quicktime' : 'image/jpeg';
  const fallbackFileName = asset.kind === 'video' ? 'video.mov' : 'photo.jpg';
  const previewUri = asset.thumbnailDataUrl || '';

  return {
    contentType: asset.contentType || fallbackContentType,
    durationMs: asset.durationMs,
    fileName: asset.fileName || fallbackFileName,
    height: asset.height,
    kind: asset.kind,
    nativeAssetIdentifier: asset.assetIdentifier,
    originalContentType: asset.contentType || fallbackContentType,
    originalHeight: asset.height,
    originalSizeBytes: asset.sizeBytes,
    originalUri: asset.assetIdentifier,
    originalWidth: asset.width,
    qualityMode,
    sizeBytes: asset.sizeBytes || 1,
    thumbnailContentType: asset.thumbnailDataUrl ? 'image/jpeg' : undefined,
    thumbnailDataUrl: asset.thumbnailDataUrl,
    uri: previewUri,
    width: asset.width
  };
}

/**
 * Adds a poster frame when the native picker did not supply one.
 *
 * The iOS module returns a thumbnail with each asset; the Android one does not,
 * so without this every Android photo and video is sent with no poster at all —
 * blank in the bubble for the sender, and blank for the recipient too, because
 * the thumbnail travels inside the encrypted message.
 *
 * The asset identifier is a content:// URI on Android, which the thumbnail and
 * image tools read directly, so no copy is needed to produce one.
 */
async function withNativeAssetThumbnail(
  media: LocalChatMediaInput,
  asset: NativeMediaAsset
): Promise<LocalChatMediaInput> {
  if (media.thumbnailDataUrl || !asset.assetIdentifier) {
    return media;
  }

  return attachMediaThumbnail(media, asset.assetIdentifier).catch(() => media);
}

export async function pickNativeChatFile(): Promise<LocalChatMediaInput | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*'
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const sizeBytes = asset.size || await getFileSize(asset.uri);

  return {
    contentType: asset.mimeType || 'application/octet-stream',
    fileName: asset.name || 'attachment',
    kind: 'file',
    sizeBytes,
    uri: asset.uri
  };
}

async function prepareImageMedia(
  asset: ImagePicker.ImagePickerAsset,
  _onIphonePhotoProgress: ((progress: IPhonePhotoPreparationProgress) => void) | undefined,
  qualityMode: ChatMediaQualityMode,
  isRecording = false
): Promise<LocalChatMediaInput> {
  return buildOriginalImageMedia(asset, qualityMode, isRecording);
}

/**
 * The system picker's assets, prepared.
 *
 * Only the library falls through to here now, when the native picker returns
 * nothing usable. The camera no longer goes anywhere near it: `ChatCameraModal`
 * runs the camera in the app, which is why a recording no longer waits on a
 * copy out of another app or on a poster dug back out of the finished file.
 */
async function prepareSystemPickerAssets(
  assets: ImagePicker.ImagePickerAsset[],
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput[]> {
  const preparedMedia = new Array<LocalChatMediaInput>(assets.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < assets.length) {
      const index = nextIndex;
      nextIndex += 1;
      preparedMedia[index] = await prepareSystemPickerAsset(assets[index], onIphonePhotoProgress, qualityMode);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CHAT_MEDIA_PICKER_PREPARATION_CONCURRENCY, assets.length) },
      () => runWorker()
    )
  );

  return preparedMedia;
}

async function prepareSystemPickerAsset(
  asset: ImagePicker.ImagePickerAsset,
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput> {
  const assetType = asset.type === 'video' ? 'video' : 'image';

  // Chosen from the library, never recorded, so the file keeps the name it
  // already had. Recordings are named in ChatCameraModal instead.
  if (assetType === 'video') {
    return prepareVideoMedia(asset, undefined, qualityMode);
  }

  return prepareImageMedia(asset, onIphonePhotoProgress, qualityMode);
}

async function prepareVideoMedia(
  asset: ImagePicker.ImagePickerAsset,
  onProgress?: (progress: number) => void,
  qualityMode: ChatMediaQualityMode = 'standard',
  isRecording = false
): Promise<LocalChatMediaInput> {
  const originalContentType = getAssetVideoContentType(asset);
  const originalSizeBytes = asset.fileSize || await getFileSize(asset.uri);

  if (originalSizeBytes > CHAT_MEDIA_LIMITS.video) {
    throw new Error(`This video is ${formatPickerByteCount(originalSizeBytes)}. Synzapp currently allows videos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.video)}.`);
  }

  onProgress?.(0.1);
  const sizeBytes = originalSizeBytes || 1;

  if (sizeBytes > CHAT_MEDIA_LIMITS.video) {
    throw new Error(`This video is ${formatPickerByteCount(sizeBytes)}. Synzapp currently allows videos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.video)}.`);
  }

  onProgress?.(0.45);

  const media: LocalChatMediaInput = {
    contentType: originalContentType,
    durationMs: asset.duration || undefined,
    fileName: isRecording
      ? buildRecordedChatMediaFileName({
          capturedAtMs: Date.now(),
          contentType: originalContentType,
          kind: 'video'
        })
      : getAssetFileName(asset, 'video.mp4'),
    height: asset.height || undefined,
    kind: 'video',
    originalContentType,
    originalHeight: asset.height || undefined,
    originalSizeBytes: originalSizeBytes > 0 ? originalSizeBytes : undefined,
    originalUri: asset.uri,
    originalWidth: asset.width || undefined,
    qualityMode,
    sizeBytes,
    uri: asset.uri,
    width: asset.width || undefined
  };

  // The poster is taken here, while the attachment is being built, which is how
  // WhatsApp and Signal do it: one frame, extracted on the sender, carried
  // inside the message so the other side sees something before downloading tens
  // of megabytes, and so both sides see it offline.
  //
  // It used to be deferred to the preparation queue. Nothing recorded on the
  // camera ever reaches that queue, because entry to it requires the photo
  // library asset identifier that only the library picker supplies, so a
  // recorded video was sent with no poster at all and its bubble was empty for
  // everyone, for good. Deferring it also meant the sender's own bubble stayed
  // empty while offline, with nothing to fill it until the message went out.
  //
  // Given a deadline, though. Seeking one frame does not depend on how long the
  // video is, but it is still a decode, and a send that does not appear the
  // moment it is tapped feels broken. Past the deadline the bubble goes up
  // without a poster and the upload path attaches one before the message is
  // encrypted, so nothing is lost either way.
  // `rotation` is reported by expo-image-picker on Android and is absent from
  // its published types, so it is read defensively rather than declared.
  const assetRotationDegrees = (asset as { rotation?: number | null }).rotation;
  const mediaWithPoster = await settleWithinTimeLimit(
    attachMediaThumbnail(media, asset.uri, assetRotationDegrees).catch(() => media),
    media,
    VIDEO_POSTER_PICK_TIME_LIMIT_MS
  );

  onProgress?.(0.6);

  return mediaWithPoster;
}

async function buildOriginalImageMedia(
  asset: ImagePicker.ImagePickerAsset,
  qualityMode: ChatMediaQualityMode,
  isRecording = false
): Promise<LocalChatMediaInput> {
  const contentType = getAssetImageContentType(asset);
  const sizeBytes = await getFileSize(asset.uri);

  if (contentType && isIphonePhotoContentType(contentType)) {
    if (sizeBytes > CHAT_MEDIA_LIMITS.image) {
      throw new Error(`This photo is ${formatPickerByteCount(sizeBytes)}. Synzapp currently allows photos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.image)}.`);
    }

    return {
      contentType,
      fileName: isRecording
        ? buildRecordedChatMediaFileName({
            capturedAtMs: Date.now(),
            contentType,
            kind: 'image'
          })
        : getAssetFileName(asset, getDefaultImageFileName(contentType)),
      height: asset.height || undefined,
      kind: 'image',
      originalContentType: contentType,
      originalHeight: asset.height || undefined,
      originalSizeBytes: sizeBytes > 0 ? sizeBytes : undefined,
      originalUri: asset.uri,
      originalWidth: asset.width || undefined,
      qualityMode,
      sizeBytes: sizeBytes > 0 ? sizeBytes : 1,
      uri: asset.uri,
      width: asset.width || undefined
    };
  }

  if (contentType && sizeBytes > 0 && sizeBytes <= CHAT_MEDIA_LIMITS.image) {
    return attachMediaThumbnail({
      contentType,
      fileName: isRecording
        ? buildRecordedChatMediaFileName({
            capturedAtMs: Date.now(),
            contentType,
            kind: 'image'
          })
        : getAssetFileName(asset, getDefaultImageFileName(contentType)),
      height: asset.height || undefined,
      kind: 'image',
      originalContentType: contentType,
      originalHeight: asset.height || undefined,
      originalSizeBytes: sizeBytes,
      originalUri: asset.uri,
      originalWidth: asset.width || undefined,
      qualityMode,
      sizeBytes,
      uri: asset.uri,
      width: asset.width || undefined
    }, asset.uri);
  }

  if (sizeBytes > CHAT_MEDIA_LIMITS.image) {
    throw new Error(`This photo is ${formatPickerByteCount(sizeBytes)}. Synzapp currently allows photos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.image)}.`);
  }

  throw new Error('Unable to prepare this photo. Please choose another image.');
}

function getPreparedIphonePhotoFileNameFromName(fileName: string): string {
  const originalFileName = (fileName || 'photo.heic').trim();
  const baseName = originalFileName.replace(/\.[^.]+$/, '').trim() || 'photo';

  return `${baseName}.jpg`;
}

async function attachMediaThumbnail(
  media: LocalChatMediaInput,
  sourceUri: string,
  videoRotationDegrees?: number | null
): Promise<LocalChatMediaInput> {
  const thumbnail = media.kind === 'image'
    ? await generateImageThumbnail(sourceUri)
    : media.kind === 'video'
      ? await generateVideoThumbnail(sourceUri, {
          videoHeight: media.height,
          videoRotationDegrees,
          videoWidth: media.width
        })
      : null;

  if (!thumbnail) {
    return media;
  }

  return {
    ...media,
    thumbnailContentType: thumbnail.contentType,
    thumbnailDataUrl: thumbnail.dataUrl,
    thumbnailHeight: thumbnail.height,
    thumbnailWidth: thumbnail.width
  };
}

async function generateImageThumbnail(
  sourceUri: string,
  rotateDegrees = 0
): Promise<PreparedMediaThumbnail | null> {
  // The camera frame is decoded once, and only once.
  //
  // This used to walk a ladder of widths and re-read the full-resolution frame
  // at each step, which was affordable while almost everything fitted on the
  // first try. Lowering the size ceiling to bound a long thread's memory made
  // the first try miss regularly, so a poster started costing two or three full
  // decodes: measured at 1143ms against the 570ms Android spends reading the
  // frame in the first place, and enough to miss the deadline the bubble waits
  // on. One expensive pass, then cheap re-encodes of the small result.
  //
  // Turning is done after shrinking for the same reason: rotating a 4K bitmap
  // rewrites the whole frame at full resolution. A quarter turn swaps the
  // sides, so the target goes on the height when one is coming, and the
  // finished poster is the same size either way.
  const isQuarterTurn = rotateDegrees === 90 || rotateDegrees === 270;
  const width = CHAT_MEDIA_THUMBNAIL_WIDTHS[0];

  try {
    const shrunk = await ImageManipulator.manipulateAsync(
      sourceUri,
      [
        { resize: isQuarterTurn ? { height: width } : { width } },
        ...(rotateDegrees ? [{ rotate: rotateDegrees }] : [])
      ],
      {
        base64: true,
        compress: 0.54,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    if (shrunk.base64 && getUtf8ByteCount(shrunk.base64) <= CHAT_MEDIA_THUMBNAIL_MAX_BASE64_BYTES) {
      return {
        contentType: 'image/jpeg',
        dataUrl: `data:image/jpeg;base64,${shrunk.base64}`,
        height: shrunk.height,
        width: shrunk.width
      };
    }

    // Over the ceiling, so it is squeezed further. These read the small picture
    // above rather than the camera frame, so they cost almost nothing.
    for (const compress of CHAT_MEDIA_THUMBNAIL_FALLBACK_QUALITIES) {
      const squeezed = await ImageManipulator.manipulateAsync(
        shrunk.uri,
        [],
        {
          base64: true,
          compress,
          format: ImageManipulator.SaveFormat.JPEG
        }
      ).catch(() => null);

      if (squeezed?.base64 && getUtf8ByteCount(squeezed.base64) <= CHAT_MEDIA_THUMBNAIL_MAX_BASE64_BYTES) {
        return {
          contentType: 'image/jpeg',
          dataUrl: `data:image/jpeg;base64,${squeezed.base64}`,
          height: squeezed.height,
          width: squeezed.width
        };
      }
    }
  } catch {
    await waitForImageManipulatorRecovery();
  }

  return null;
}

async function generateVideoThumbnail(
  sourceUri: string,
  video: {
    videoHeight?: number | null;
    videoRotationDegrees?: number | null;
    videoWidth?: number | null;
  } = {}
): Promise<PreparedMediaThumbnail | null> {
  for (const time of [500, 900, 1500, 0]) {
    try {
      // Read natively first: one call that decodes straight to the size wanted.
      // The path below asks for a full resolution frame, writes it to disk,
      // reads it back and decodes it whole before shrinking, which measured
      // 1.5s plus 2.3s on a minute of 4K. It stays only as a fallback for a
      // build without the native module.
      const nativeStartedAtMs = Date.now();
      const native = await readNativeVideoPoster({
        quality: 0.54,
        sourceUri,
        targetLongEdge: CHAT_MEDIA_THUMBNAIL_WIDTHS[0],
        timeMs: time
      });

      if (native) {
        console.log(`[SynzappVideoPoster] native ms=${Date.now() - nativeStartedAtMs} at=${time}`);

        return {
          contentType: 'image/jpeg',
          dataUrl: `data:image/jpeg;base64,${native.base64}`,
          height: native.height,
          width: native.width
        };
      }

      const frameStartedAtMs = Date.now();
      const poster = await VideoThumbnails.getThumbnailAsync(sourceUri, {
        quality: 0.68,
        time
      });
      const frameMs = Date.now() - frameStartedAtMs;
      const shrinkStartedAtMs = Date.now();
      // Android hands the frame back exactly as stored, so a portrait
      // recording arrives lying on its side. See resolvePosterRotationDegrees.
      const thumbnail = await generateImageThumbnail(poster.uri, resolvePosterRotationDegrees({
        platform: Platform.OS,
        posterHeight: poster.height,
        posterWidth: poster.width,
        videoHeight: video.videoHeight,
        videoRotationDegrees: video.videoRotationDegrees,
        videoWidth: video.videoWidth
      }));

      if (thumbnail) {
        // The two halves reported apart, so a slow poster can be blamed on the
        // right one rather than argued about. Reading the frame is the platform;
        // shrinking it is ours.
        console.log(
          `[SynzappVideoPoster] ready frameMs=${frameMs} shrinkMs=${Date.now() - shrinkStartedAtMs} at=${time}`
        );

        return thumbnail;
      }
    } catch {
      await waitForImageManipulatorRecovery();
    }
  }

  console.log('[SynzappVideoPoster] gave up');

  return null;
}

function getAssetImageContentType(asset: ImagePicker.ImagePickerAsset): string | null {
  const contentType = normalizeSupportedImageContentType(asset.mimeType);

  if (contentType) {
    return contentType;
  }

  const extension = getAssetImageExtension(asset);

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'heic') {
    return 'image/heic';
  }

  if (extension === 'heif') {
    return 'image/heif';
  }

  return null;
}

function getAssetImageExtension(asset: ImagePicker.ImagePickerAsset): string {
  const fileNameExtension = getAssetFileName(asset, '').split('.').pop()?.toLowerCase();

  if (fileNameExtension) {
    return fileNameExtension;
  }

  const uriWithoutQuery = asset.uri.split('?')[0] || '';

  return uriWithoutQuery.split('.').pop()?.toLowerCase() || '';
}

function normalizeSupportedImageContentType(contentType?: string | null): string | null {
  const safeContentType = (contentType || '').trim().toLowerCase();

  if (safeContentType === 'image/jpg') {
    return 'image/jpeg';
  }

  if (
    safeContentType === 'image/jpeg' ||
    safeContentType === 'image/png' ||
    safeContentType === 'image/webp' ||
    safeContentType === 'image/heic' ||
    safeContentType === 'image/heif'
  ) {
    return safeContentType;
  }

  return null;
}

function isIphonePhotoContentType(contentType: string): boolean {
  const safeContentType = contentType.trim().toLowerCase();

  return safeContentType === 'image/heic' || safeContentType === 'image/heif';
}

function getDefaultImageFileName(contentType: string): string {
  if (contentType === 'image/png') {
    return 'photo.png';
  }

  if (contentType === 'image/webp') {
    return 'photo.webp';
  }

  if (contentType === 'image/heic') {
    return 'photo.heic';
  }

  if (contentType === 'image/heif') {
    return 'photo.heif';
  }

  return 'photo.jpg';
}

function getAssetVideoContentType(asset: ImagePicker.ImagePickerAsset): 'video/mp4' | 'video/quicktime' {
  const safeContentType = (asset.mimeType || '').trim().toLowerCase();

  if (safeContentType === 'video/mp4') {
    return 'video/mp4';
  }

  const fileNameExtension = getAssetFileName(asset, '').split('.').pop()?.toLowerCase();
  const uriExtension = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase() || '';

  return fileNameExtension === 'mp4' || uriExtension === 'mp4'
    ? 'video/mp4'
    : 'video/quicktime';
}

function waitForImageManipulatorRecovery(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 90);
  });
}

function getUtf8ByteCount(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);

    if (codePoint <= 0x7F) {
      bytes += 1;
    } else if (codePoint <= 0x7FF) {
      bytes += 2;
    } else if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

async function launchLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Photo library access is needed to choose media.');
  }

  return ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    orderedSelection: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    quality: 1,
    selectionLimit: CHAT_LIBRARY_SELECTION_LIMIT
  });
}

function normalizePhotoLibraryError(error: unknown): Error {
  if (isPhotoLibraryExportError(error)) {
    return new Error('iOS could not provide a local copy of this video from Photos. If it is stored in iCloud, open the video in Photos and wait for it to download to this device, then try again.');
  }

  return error instanceof Error
    ? error
    : new Error('Unable to open the photo library. Please try again.');
}

export function isPhotoAccessDeniedError(error: unknown): boolean {
  return /photo_access_denied/i.test(getUnknownErrorMessage(error));
}

function normalizeNativeLibraryPickerError(error: unknown): Error {
  const message = getUnknownErrorMessage(error);

  if (/photo_access_denied/i.test(message)) {
    return new Error(PHOTO_ACCESS_DENIED_MESSAGE);
  }

  if (/picker_active/i.test(message)) {
    return new Error('The media picker is already open.');
  }

  if (/presenter_unavailable/i.test(message)) {
    return new Error('Synzapp could not open the media picker. Please try again.');
  }

  return error instanceof Error
    ? error
    : new Error('Synzapp could not open the native media picker. Please try again.');
}

function isPhotoLibraryExportError(error: unknown): boolean {
  const message = getUnknownErrorMessage(error);

  return /PHPhotosErrorDomain|PhotosError|error\s*3164|NSItemProvider|Cannot\s+load|couldn'?t\s+be\s+completed/i.test(message);
}

function getUnknownErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
}

function formatPickerByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }

  const mb = bytes / (1024 * 1024);

  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);

  return info?.exists && typeof info.size === 'number' ? info.size : 0;
}

function getAssetFileName(asset: ImagePicker.ImagePickerAsset, fallback: string): string {
  return (asset.fileName || fallback).replace(/[^\w .()+-]/g, '_').slice(0, 120) || fallback;
}

/**
 * Flips a photo left to right.
 *
 * A phone set to "save selfies as previewed" writes the front camera image
 * mirrored, so text in the shot reads backwards. Which way round is correct
 * cannot be worked out from the file: the picker does not report which lens
 * took it, and flipping everything would reverse photos from the back camera.
 * So this is offered in the review screen and the person decides.
 */
export async function flipChatMediaHorizontally(
  media: LocalChatMediaInput
): Promise<LocalChatMediaInput> {
  if (media.kind !== 'image') {
    return media;
  }

  const flipped = await ImageManipulator.manipulateAsync(
    media.uri,
    [{ flip: ImageManipulator.FlipType.Horizontal }],
    {
      compress: 1,
      format: media.contentType === 'image/png'
        ? ImageManipulator.SaveFormat.PNG
        : ImageManipulator.SaveFormat.JPEG
    }
  );

  return {
    ...media,
    height: flipped.height || media.height,
    uri: flipped.uri,
    width: flipped.width || media.width
  };
}
