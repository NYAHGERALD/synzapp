import { Platform } from 'react-native';
import SynzappNativeMedia, {
  type SynzappNativeMediaTranscodeEvent,
  type SynzappNativeMediaTranscodeVideoResult
} from 'synzapp-native-media';
import type { ChatMediaQualityMode } from './chatMediaApi';

export type NativeVideoTranscodeEvent = SynzappNativeMediaTranscodeEvent;
export type NativeVideoTranscodeResult = SynzappNativeMediaTranscodeVideoResult;

export interface VideoTranscodeProfile {
  audioBitrate: number;
  frameRate: number;
  targetLongEdge: number;
  videoBitrate: number;
}

/**
 * The bitrate ladder both platforms encode against.
 *
 * These are deliberately in WhatsApp's neighbourhood. A one-minute clip lands at
 * roughly 5 MB on `data_saver`, 15 MB on `standard`, and 35 MB on `hd` - against
 * the 90 MB - 400 MB the original camera file would have been.
 */
export const VIDEO_TRANSCODE_PROFILES: Record<ChatMediaQualityMode, VideoTranscodeProfile> = {
  hd: {
    audioBitrate: 128_000,
    frameRate: 30,
    targetLongEdge: 1280,
    videoBitrate: 4_500_000
  },
  standard: {
    audioBitrate: 96_000,
    frameRate: 30,
    targetLongEdge: 848,
    videoBitrate: 2_000_000
  }
};

const DATA_SAVER_PROFILE: VideoTranscodeProfile = {
  audioBitrate: 64_000,
  frameRate: 24,
  targetLongEdge: 480,
  videoBitrate: 600_000
};

/**
 * Videos below this never justify a re-encode. The native side applies the same
 * floor; this is the cheap check that avoids the bridge call entirely.
 */
const VIDEO_TRANSCODE_MIN_SOURCE_BYTES = 2 * 1024 * 1024;

export function getVideoTranscodeProfile(input: {
  dataSaver?: boolean;
  qualityMode?: ChatMediaQualityMode | null;
}): VideoTranscodeProfile {
  if (input.dataSaver) {
    return DATA_SAVER_PROFILE;
  }

  return input.qualityMode === 'hd'
    ? VIDEO_TRANSCODE_PROFILES.hd
    : VIDEO_TRANSCODE_PROFILES.standard;
}

export async function isNativeVideoTranscodingAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  if (!SynzappNativeMedia?.transcodeVideo) {
    return false;
  }

  const capabilities = await SynzappNativeMedia.getMediaPipelineCapabilities?.().catch(() => null);

  // A module that predates the capability flag still exposes the function, so
  // treat a missing flag as available rather than silently disabling this.
  return capabilities?.videoTranscodingAvailable !== false;
}

export function subscribeNativeVideoTranscodeEvents(
  listener: (event: NativeVideoTranscodeEvent) => void
): { remove: () => void } | null {
  if (!SynzappNativeMedia?.addListener) {
    return null;
  }

  try {
    return SynzappNativeMedia.addListener('onSynzappNativeMediaTranscodeEvent', listener);
  } catch {
    return null;
  }
}

export async function cancelNativeVideoTranscode(requestId: string): Promise<boolean> {
  const safeRequestId = (requestId || '').trim();

  if (!safeRequestId || !SynzappNativeMedia?.cancelVideoTranscode) {
    return false;
  }

  return SynzappNativeMedia.cancelVideoTranscode({ requestId: safeRequestId }).catch(() => false);
}

/**
 * Compresses a local video for sending.
 *
 * Returns `null` whenever the original should be used instead: the native module
 * is unavailable, the source is already small, the transcode failed, or the
 * native side decided re-encoding would not help. Callers treat `null` as "send
 * what you already have" - a transcode problem must never become a send failure.
 */
export async function transcodeChatVideo(input: {
  dataSaver?: boolean;
  fileName?: string;
  qualityMode?: ChatMediaQualityMode | null;
  requestId: string;
  sizeBytes?: number;
  sourceUri: string;
}): Promise<NativeVideoTranscodeResult | null> {
  const sourceUri = (input.sourceUri || '').trim();
  const requestId = (input.requestId || '').trim();

  if (!sourceUri || !requestId || !sourceUri.startsWith('file://')) {
    logTranscode('skipped: not a local file', { sourceUri });
    return null;
  }

  if (typeof input.sizeBytes === 'number' && input.sizeBytes > 0 &&
    input.sizeBytes <= VIDEO_TRANSCODE_MIN_SOURCE_BYTES) {
    logTranscode('skipped: already small', { sizeBytes: input.sizeBytes });
    return null;
  }

  if (!await isNativeVideoTranscodingAvailable() || !SynzappNativeMedia?.transcodeVideo) {
    logTranscode('skipped: native transcoding unavailable', {});
    return null;
  }

  const profile = getVideoTranscodeProfile({
    dataSaver: input.dataSaver,
    qualityMode: input.qualityMode
  });
  const startedAtMs = Date.now();
  const result = await SynzappNativeMedia.transcodeVideo({
    audioBitrate: profile.audioBitrate,
    fileName: input.fileName,
    frameRate: profile.frameRate,
    requestId,
    sourceUri,
    targetLongEdge: profile.targetLongEdge,
    videoBitrate: profile.videoBitrate
  }).catch((error: unknown) => {
    // Never rethrow - the caller falls back to the original file. But a silent
    // failure here is indistinguishable from "no compression implemented", which
    // is exactly how a broken transcoder hides. Say so out loud.
    logTranscode('FAILED, sending original', {
      elapsedMs: Date.now() - startedAtMs,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  });

  if (!result?.fileUri) {
    return null;
  }

  if (!result.transcoded) {
    logTranscode('declined by native side, sending original', {
      elapsedMs: Date.now() - startedAtMs,
      sizeBytes: result.sizeBytes
    });
    return null;
  }

  logTranscode('completed', {
    elapsedMs: Date.now() - startedAtMs,
    fromBytes: input.sizeBytes,
    resolution: `${result.width}x${result.height}`,
    toBytes: result.sizeBytes
  });

  return result;
}

function logTranscode(outcome: string, details: Record<string, unknown>): void {
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');

  console.log(`[SynzappVideoTranscode] ${outcome}${detailText ? ` ${detailText}` : ''}`);
}

export function buildVideoTranscodeRequestId(input: {
  mediaIndex?: number;
  messageId: string;
}): string {
  const mediaIndex = Math.max(0, Math.round(input.mediaIndex || 0));
  const safeMessageId = (input.messageId || 'message').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);

  return `transcode:${safeMessageId}:${mediaIndex}`;
}
