import { Platform } from 'react-native';
import SynzappNativeMedia, {
  type SynzappNativeMediaAsset,
  type SynzappNativeMediaCancelPreparationOptions,
  type SynzappNativeMediaDecryptFileOptions,
  type SynzappNativeMediaDecryptFileResult,
  type SynzappNativeMediaEncryptFileOptions,
  type SynzappNativeMediaEncryptFileResult,
  type SynzappNativeMediaPipelineCapabilities,
  type SynzappNativeMediaPreparationEvent,
  type SynzappNativeMediaPrepareOptions,
  type SynzappNativeMediaPrepareResult,
  type SynzappNativeMediaPickerOptions,
  type SynzappNativeMediaPickerResult
} from 'synzapp-native-media';

const NATIVE_MEDIA_SELECTION_LIMIT = 10;

export type NativeMediaAsset = SynzappNativeMediaAsset;
export type NativeMediaDecryptFileOptions = SynzappNativeMediaDecryptFileOptions;
export type NativeMediaDecryptFileResult = SynzappNativeMediaDecryptFileResult;
export type NativeMediaEncryptFileOptions = SynzappNativeMediaEncryptFileOptions;
export type NativeMediaEncryptFileResult = SynzappNativeMediaEncryptFileResult;
export type NativeMediaPipelineCapabilities = SynzappNativeMediaPipelineCapabilities;
export type NativeMediaPreparationEvent = SynzappNativeMediaPreparationEvent;
export type NativeMediaPrepareResult = SynzappNativeMediaPrepareResult;

export interface NativeMediaPickerResult {
  assets: NativeMediaAsset[];
  canceled: boolean;
}

export async function isNativeMediaPickerAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  if (!SynzappNativeMedia?.isAvailable || !SynzappNativeMedia.pickMediaAssets) {
    return false;
  }

  return SynzappNativeMedia.isAvailable().catch(() => false);
}

export async function pickNativeMediaAssets(
  options: SynzappNativeMediaPickerOptions = {}
): Promise<NativeMediaPickerResult | null> {
  if (!await isNativeMediaPickerAvailable() || !SynzappNativeMedia?.pickMediaAssets) {
    return null;
  }

  const result = await SynzappNativeMedia.pickMediaAssets({
    limit: normalizeSelectionLimit(options.limit)
  });

  return normalizeNativeMediaPickerResult(result);
}

export async function getNativeMediaPipelineCapabilities(): Promise<NativeMediaPipelineCapabilities> {
  const fallback: NativeMediaPipelineCapabilities = {
    backgroundMultipartUploadWorkerAvailable: false,
    killedAppSecretboxWorkerAvailable: false,
    nativeAeadMediaEncryptionAvailable: false,
    reason: 'Native media pipeline capabilities are not available in this runtime.',
    secretboxAlgorithm: 'nacl-secretbox-xsalsa20-poly1305'
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return fallback;
  }

  if (!SynzappNativeMedia?.getMediaPipelineCapabilities) {
    return fallback;
  }

  return SynzappNativeMedia.getMediaPipelineCapabilities().catch(() => fallback);
}

/**
 * Directory for media that must survive the OS reclaiming disk space.
 *
 * Returns null when the native module is unavailable, in which case the caller
 * keeps using the cache directory.
 */
export async function getNativePersistentMediaDirectory(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  if (!SynzappNativeMedia?.getPersistentMediaDirectory) {
    return null;
  }

  const directory = await SynzappNativeMedia.getPersistentMediaDirectory().catch(() => null);
  const safeDirectory = (directory || '').trim();

  if (!safeDirectory) {
    return null;
  }

  return safeDirectory.endsWith('/') ? safeDirectory : `${safeDirectory}/`;
}

export async function prepareNativeMediaAsset(
  options: SynzappNativeMediaPrepareOptions
): Promise<NativeMediaPrepareResult | null> {
  if (!await isNativeMediaPickerAvailable() || !SynzappNativeMedia?.prepareMediaAsset) {
    return null;
  }

  const assetIdentifier = typeof options.assetIdentifier === 'string' ? options.assetIdentifier.trim() : '';
  if (!assetIdentifier) {
    return null;
  }

  return SynzappNativeMedia.prepareMediaAsset({
    ...options,
    assetIdentifier
  });
}

export async function encryptNativeMediaFile(
  options: NativeMediaEncryptFileOptions
): Promise<NativeMediaEncryptFileResult | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  if (!SynzappNativeMedia?.encryptMediaFile) {
    return null;
  }

  const sourceUri = typeof options.sourceUri === 'string' ? options.sourceUri.trim() : '';
  if (!sourceUri) {
    return null;
  }

  return SynzappNativeMedia.encryptMediaFile({
    ...options,
    sourceUri
  }).catch(() => null);
}

export async function decryptNativeMediaFile(
  options: NativeMediaDecryptFileOptions
): Promise<NativeMediaDecryptFileResult | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  if (!SynzappNativeMedia?.decryptMediaFile) {
    return null;
  }

  const encryptedFileUri = typeof options.encryptedFileUri === 'string' ? options.encryptedFileUri.trim() : '';
  if (!encryptedFileUri) {
    return null;
  }

  return SynzappNativeMedia.decryptMediaFile({
    ...options,
    encryptedFileUri
  }).catch((error: unknown) => {
    // Returning null keeps the caller's fallback path intact, but the native
    // failure reason is the only thing that explains why a media file will not
    // open, so it must not be discarded silently.
    console.warn('[SynzappNativeMedia] decryptMediaFile failed', String(
      error instanceof Error ? error.message : error
    ));
    return null;
  });
}

export async function cancelNativeMediaPreparation(
  options: SynzappNativeMediaCancelPreparationOptions
): Promise<boolean> {
  if (!SynzappNativeMedia?.cancelMediaAssetPreparation) {
    return false;
  }

  const assetIdentifier = typeof options.assetIdentifier === 'string' ? options.assetIdentifier.trim() : '';
  if (!assetIdentifier) {
    return false;
  }

  return SynzappNativeMedia.cancelMediaAssetPreparation({ assetIdentifier }).catch(() => false);
}

export function subscribeNativeMediaPreparationEvents(
  listener: (event: NativeMediaPreparationEvent) => void
): { remove: () => void } | null {
  if (!SynzappNativeMedia?.addListener) {
    return null;
  }

  return SynzappNativeMedia.addListener('onSynzappNativeMediaPreparationEvent', listener);
}

function normalizeNativeMediaPickerResult(result: SynzappNativeMediaPickerResult | undefined): NativeMediaPickerResult {
  return {
    assets: Array.isArray(result?.assets)
      ? result.assets.map(normalizeNativeMediaAsset).filter((asset): asset is NativeMediaAsset => Boolean(asset))
      : [],
    canceled: result?.canceled !== false
  };
}

function normalizeNativeMediaAsset(asset: SynzappNativeMediaAsset | undefined): NativeMediaAsset | null {
  const assetIdentifier = typeof asset?.assetIdentifier === 'string' && asset.assetIdentifier.trim()
    ? asset.assetIdentifier.trim()
    : '';

  if (!assetIdentifier) {
    return null;
  }

  const kind = asset?.kind === 'video' ? 'video' : 'image';
  const fallbackContentType = kind === 'video' ? 'video/quicktime' : 'image/jpeg';
  const fallbackFileName = kind === 'video' ? 'video.mov' : 'photo.jpg';

  return {
    assetIdentifier,
    contentType: typeof asset?.contentType === 'string' && asset.contentType.trim()
      ? asset.contentType.trim()
      : fallbackContentType,
    durationMs: Number.isFinite(asset?.durationMs)
      ? Math.max(0, Math.round(asset?.durationMs || 0))
      : undefined,
    fileName: typeof asset?.fileName === 'string' && asset.fileName.trim()
      ? asset.fileName.trim()
      : fallbackFileName,
    height: Number.isFinite(asset?.height) ? Math.max(1, Math.round(asset?.height || 1)) : undefined,
    kind,
    sizeBytes: Number.isFinite(asset?.sizeBytes) ? Math.max(1, Math.round(asset?.sizeBytes || 1)) : undefined,
    thumbnailDataUrl: typeof asset?.thumbnailDataUrl === 'string' && asset.thumbnailDataUrl.startsWith('data:image/')
      ? asset.thumbnailDataUrl
      : undefined,
    width: Number.isFinite(asset?.width) ? Math.max(1, Math.round(asset?.width || 1)) : undefined
  };
}

function normalizeSelectionLimit(limit: number | undefined): number {
  return Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.round(limit || NATIVE_MEDIA_SELECTION_LIMIT), NATIVE_MEDIA_SELECTION_LIMIT))
    : NATIVE_MEDIA_SELECTION_LIMIT;
}

/**
 * One still frame from a video, decoded natively at the size asked for.
 *
 * Returns null whenever the platform could not produce one, including on a
 * build whose native module predates this. A missing poster is never a reason
 * to fail a send, so every caller treats null as "no poster yet".
 */
export async function readNativeVideoPoster(input: {
  quality?: number;
  sourceUri: string;
  targetLongEdge?: number;
  timeMs?: number;
}): Promise<{ base64: string; height: number; width: number } | null> {
  const read = SynzappNativeMedia?.readVideoPoster;

  if (typeof read !== 'function') {
    return null;
  }

  const poster = await read(input).catch(() => null);

  return poster?.base64 ? poster : null;
}
