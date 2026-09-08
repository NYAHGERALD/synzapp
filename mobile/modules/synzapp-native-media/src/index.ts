import { requireOptionalNativeModule } from 'expo-modules-core';

export type SynzappNativeMediaAssetKind = 'image' | 'video';

export interface SynzappNativeMediaAsset {
  assetIdentifier: string;
  contentType: string;
  durationMs?: number;
  fileName: string;
  height?: number;
  kind: SynzappNativeMediaAssetKind;
  sizeBytes?: number;
  thumbnailDataUrl?: string;
  width?: number;
}

export interface SynzappNativeMediaPickerResult {
  assets: SynzappNativeMediaAsset[];
  canceled: boolean;
}

export interface SynzappNativeMediaPickerOptions {
  limit?: number;
}

export interface SynzappNativeMediaPreparationEvent {
  assetIdentifier: string;
  contentType?: string;
  fileName?: string;
  fileUri?: string;
  message?: string;
  progress: number;
  sizeBytes?: number;
  status: 'cancelled' | 'completed' | 'failed' | 'running';
}

export interface SynzappNativeMediaPrepareOptions {
  assetIdentifier: string;
  contentType?: string;
  fileName?: string;
  kind?: SynzappNativeMediaAssetKind;
}

export interface SynzappNativeMediaCancelPreparationOptions {
  assetIdentifier: string;
}

export interface SynzappNativeMediaPrepareResult {
  assetIdentifier: string;
  contentType: string;
  fileName: string;
  fileUri: string;
  height?: number;
  kind: SynzappNativeMediaAssetKind;
  sizeBytes: number;
  width?: number;
}

export interface SynzappNativeMediaPipelineCapabilities {
  backgroundMultipartUploadWorkerAvailable: boolean;
  killedAppSecretboxWorkerAvailable: boolean;
  nativeAeadMediaEncryptionAvailable?: boolean;
  nativeAeadMediaEncryptionMode?: 'native-chacha20poly1305-chunked-v1';
  reason?: string;
  secretboxAlgorithm: 'nacl-secretbox-xsalsa20-poly1305';
  videoTranscodingAvailable?: boolean;
}

export interface SynzappNativeMediaTranscodeEvent {
  fileUri?: string;
  message?: string;
  progress: number;
  requestId: string;
  status: 'cancelled' | 'completed' | 'failed' | 'running';
}

export interface SynzappNativeMediaTranscodeVideoOptions {
  /** Target AAC bitrate in bits per second. */
  audioBitrate?: number;
  fileName?: string;
  /** Output frame-rate cap. Capping a 60 fps source at 30 halves the payload on its own. */
  frameRate?: number;
  /** Caller-owned id used to cancel this transcode and to match progress events. */
  requestId: string;
  sourceUri: string;
  /** Longest output edge in pixels. Aspect ratio is preserved. */
  targetLongEdge?: number;
  /** Target H.264 bitrate in bits per second. */
  videoBitrate?: number;
}

export interface SynzappNativeMediaTranscodeVideoResult {
  durationMs: number;
  fileUri: string;
  height: number;
  sizeBytes: number;
  /**
   * False when the native side deliberately declined - the source was already
   * small enough, or re-encoding would have produced a larger file. `fileUri`
   * is then the untouched source.
   */
  transcoded: boolean;
  width: number;
}

export interface SynzappNativeMediaCancelTranscodeOptions {
  requestId: string;
}

export interface SynzappNativeMediaEncryptFileOptions {
  chunkSizeBytes?: number;
  fileName?: string;
  sourceUri: string;
}

export interface SynzappNativeMediaEncryptFileResult {
  chunkSizeBytes: number;
  encryptedFileUri: string;
  encryptedSizeBytes: number;
  encryptionMode: 'native-chacha20poly1305-chunked-v1';
  key: string;
  partCount: number;
  partNonces: string[];
}

export interface SynzappNativeMediaDecryptFileOptions {
  chunkSizeBytes: number;
  encryptedFileUri: string;
  fileName?: string;
  key: string;
  originalSizeBytes: number;
  partCount: number;
  partNonces: string[];
}

export interface SynzappNativeMediaDecryptFileResult {
  fileUri: string;
  sizeBytes: number;
}

export interface SynzappNativeMediaPosterOptions {
  /** JPEG quality, 0 to 1. */
  quality?: number;
  sourceUri: string;
  /** Longest side of the finished poster, in pixels. */
  targetLongEdge?: number;
  /** How far into the video to take the frame from. */
  timeMs?: number;
}

export interface SynzappNativeMediaPosterResult {
  base64: string;
  height: number;
  width: number;
}

export interface SynzappNativeMediaModule {
  addListener?: {
    (
      eventName: 'onSynzappNativeMediaPreparationEvent',
      listener: (event: SynzappNativeMediaPreparationEvent) => void
    ): { remove: () => void };
    (
      eventName: 'onSynzappNativeMediaTranscodeEvent',
      listener: (event: SynzappNativeMediaTranscodeEvent) => void
    ): { remove: () => void };
  };
  cancelMediaAssetPreparation?: (input: SynzappNativeMediaCancelPreparationOptions) => Promise<boolean>;
  cancelVideoTranscode?: (input: SynzappNativeMediaCancelTranscodeOptions) => Promise<boolean>;
  decryptMediaFile?: (input: SynzappNativeMediaDecryptFileOptions) => Promise<SynzappNativeMediaDecryptFileResult>;
  encryptMediaFile?: (input: SynzappNativeMediaEncryptFileOptions) => Promise<SynzappNativeMediaEncryptFileResult>;
  getMediaPipelineCapabilities?: () => Promise<SynzappNativeMediaPipelineCapabilities>;
  /**
   * One still frame, decoded straight to the size asked for.
   *
   * Null when the platform could not read one, which the caller must treat as
   * "no poster" rather than as a failure to send.
   */
  readVideoPoster?: (
    input: SynzappNativeMediaPosterOptions
  ) => Promise<SynzappNativeMediaPosterResult | null>;
  /**
   * Directory for media that must outlive the OS reclaiming disk space.
   * Returns null when the platform could not provide one.
   */
  getPersistentMediaDirectory?: () => Promise<string | null>;
  isAvailable?: () => Promise<boolean>;
  pickMediaAssets?: (input?: SynzappNativeMediaPickerOptions) => Promise<SynzappNativeMediaPickerResult>;
  prepareMediaAsset?: (input: SynzappNativeMediaPrepareOptions) => Promise<SynzappNativeMediaPrepareResult>;
  transcodeVideo?: (
    input: SynzappNativeMediaTranscodeVideoOptions
  ) => Promise<SynzappNativeMediaTranscodeVideoResult>;
}

export default requireOptionalNativeModule<SynzappNativeMediaModule>('SynzappNativeMedia');
