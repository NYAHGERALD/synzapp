import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import {
  CHAT_MEDIA_LIMITS,
  type ChatMediaQualityMode,
  type LocalChatMediaInput
} from './chatMediaApi';

const CHAT_LIBRARY_SELECTION_LIMIT = 10;
const CHAT_MEDIA_THUMBNAIL_WIDTHS = [360, 280, 220];
const CHAT_MEDIA_THUMBNAIL_MAX_BASE64_BYTES = 120 * 1024;

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

export async function pickNativeChatCameraMedia(
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput[] | null> {
  const result = await launchCamera(ImagePicker.MediaTypeOptions.All).catch((error) => {
    throw normalizePhotoLibraryError(error);
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return prepareCameraMediaAssets(result.assets.slice(0, CHAT_LIBRARY_SELECTION_LIMIT), onIphonePhotoProgress, qualityMode);
}

export async function pickNativeChatLibraryMedia(
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput[] | null> {
  const result = await launchLibrary().catch((error) => {
    throw normalizePhotoLibraryError(error);
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return prepareCameraMediaAssets(result.assets.slice(0, CHAT_LIBRARY_SELECTION_LIMIT), onIphonePhotoProgress, qualityMode);
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
  qualityMode: ChatMediaQualityMode
): Promise<LocalChatMediaInput> {
  return buildOriginalImageMedia(asset, qualityMode);
}

async function prepareCameraMediaAssets(
  assets: ImagePicker.ImagePickerAsset[],
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput[]> {
  const preparedMedia: LocalChatMediaInput[] = [];

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];

    preparedMedia.push(await prepareCameraMediaAsset(asset, onIphonePhotoProgress, qualityMode));
  }

  return preparedMedia;
}

async function prepareCameraMediaAsset(
  asset: ImagePicker.ImagePickerAsset,
  onIphonePhotoProgress?: (progress: IPhonePhotoPreparationProgress) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
): Promise<LocalChatMediaInput> {
  const assetType = asset.type === 'video' ? 'video' : 'image';

  if (assetType === 'video') {
    return prepareVideoMedia(asset, undefined, qualityMode);
  }

  return prepareImageMedia(asset, onIphonePhotoProgress, qualityMode);
}

async function prepareVideoMedia(
  asset: ImagePicker.ImagePickerAsset,
  onProgress?: (progress: number) => void,
  qualityMode: ChatMediaQualityMode = 'standard'
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
  return await attachMediaThumbnail({
    contentType: originalContentType,
    durationMs: asset.duration || undefined,
    fileName: getAssetFileName(asset, 'video.mp4'),
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
  }, asset.uri);
}

async function buildOriginalImageMedia(
  asset: ImagePicker.ImagePickerAsset,
  qualityMode: ChatMediaQualityMode
): Promise<LocalChatMediaInput> {
  const contentType = getAssetImageContentType(asset);
  const sizeBytes = await getFileSize(asset.uri);

  if (contentType && isIphonePhotoContentType(contentType)) {
    if (sizeBytes > CHAT_MEDIA_LIMITS.image) {
      throw new Error(`This photo is ${formatPickerByteCount(sizeBytes)}. Synzapp currently allows photos up to ${formatPickerByteCount(CHAT_MEDIA_LIMITS.image)}.`);
    }

    return {
      contentType,
      fileName: getAssetFileName(asset, getDefaultImageFileName(contentType)),
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
      fileName: getAssetFileName(asset, getDefaultImageFileName(contentType)),
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
  sourceUri: string
): Promise<LocalChatMediaInput> {
  const thumbnail = media.kind === 'image'
    ? await generateImageThumbnail(sourceUri)
    : media.kind === 'video'
      ? await generateVideoThumbnail(sourceUri)
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

async function generateImageThumbnail(sourceUri: string): Promise<PreparedMediaThumbnail | null> {
  for (const width of CHAT_MEDIA_THUMBNAIL_WIDTHS) {
    try {
      const thumbnail = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width } }],
        {
          base64: true,
          compress: width >= 320 ? 0.54 : 0.48,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      if (!thumbnail.base64) {
        continue;
      }

      if (getUtf8ByteCount(thumbnail.base64) > CHAT_MEDIA_THUMBNAIL_MAX_BASE64_BYTES) {
        await waitForImageManipulatorRecovery();
        continue;
      }

      return {
        contentType: 'image/jpeg',
        dataUrl: `data:image/jpeg;base64,${thumbnail.base64}`,
        height: thumbnail.height,
        width: thumbnail.width
      };
    } catch {
      await waitForImageManipulatorRecovery();
    }
  }

  return null;
}

async function generateVideoThumbnail(sourceUri: string): Promise<PreparedMediaThumbnail | null> {
  for (const time of [500, 900, 1500, 0]) {
    try {
      const poster = await VideoThumbnails.getThumbnailAsync(sourceUri, {
        quality: 0.68,
        time
      });
      const thumbnail = await generateImageThumbnail(poster.uri);

      if (thumbnail) {
        return thumbnail;
      }
    } catch {
      await waitForImageManipulatorRecovery();
    }
  }

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

async function launchCamera(mediaTypes: ImagePicker.MediaTypeOptions) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Camera access is needed to capture media.');
  }

  return ImagePicker.launchCameraAsync({
    allowsEditing: false,
    mediaTypes,
    quality: 1
  });
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
    return new Error('iOS could not export this video from Photos. If it is stored in iCloud, open the video in Photos first so it downloads to this device, then try again. If it is a very large video, send a shorter clip or lower-quality copy.');
  }

  return error instanceof Error
    ? error
    : new Error('Unable to open the photo library. Please try again.');
}

function isPhotoLibraryExportError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';

  return /PHPhotosErrorDomain|PhotosError|error\s*3164|NSItemProvider|Cannot\s+load|couldn'?t\s+be\s+completed/i.test(message);
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
