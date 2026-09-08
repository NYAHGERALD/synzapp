import { buildRecordedChatMediaFileName } from './chatMediaNaming';

/**
 * What the app's own camera hands back.
 *
 * The point of running the camera in-app is everything that is *known* here and
 * had to be guessed before: the file is already where we put it, the still
 * frame was kept while the viewfinder was showing it, and the lens that took it
 * is not a mystery.
 */
export interface CapturedChatMedia {
  capturedAtMs: number;
  contentType: string;
  /** How long the recording ran. The camera counted it, so nothing reads the file to find out. */
  durationMs?: number;
  /** Which lens. A front camera writes a mirrored picture. */
  facing: 'back' | 'front';
  fileName: string;
  height?: number;
  kind: 'image' | 'video';
  /** The frame the camera was showing when recording began. */
  posterDataUrl: string | null;
  uri: string;
  width?: number;
}

export function buildCapturedChatMedia(input: {
  capturedAtMs: number;
  durationMs?: number;
  facing: 'back' | 'front';
  height?: number;
  kind: 'image' | 'video';
  posterDataUrl?: string | null;
  uri: string;
  width?: number;
}): CapturedChatMedia {
  const contentType = input.kind === 'video' ? 'video/mp4' : 'image/jpeg';

  return {
    capturedAtMs: input.capturedAtMs,
    contentType,
    durationMs: input.durationMs,
    facing: input.facing,
    fileName: buildRecordedChatMediaFileName({
      capturedAtMs: input.capturedAtMs,
      contentType,
      kind: input.kind
    }),
    height: input.height,
    kind: input.kind,
    posterDataUrl: input.posterDataUrl || null,
    uri: input.uri,
    width: input.width
  };
}

/**
 * Whether a capture needs flipping back.
 *
 * A front camera writes what the lens sees, which is the reverse of the mirror
 * the person was looking at, so text in the shot reads backwards. Until now the
 * app could not tell: the picker never said which lens took the picture, so
 * flipping was offered in the review screen and left to the person to notice.
 * Running the camera means the answer is simply known.
 *
 * Only stills. Flipping a video would mean re-encoding it, which costs far more
 * than it is worth, and every phone camera app leaves recordings as they are.
 */
export function shouldUnmirrorCapture(media: {
  facing: 'back' | 'front';
  kind: 'image' | 'video';
}): boolean {
  return media.facing === 'front' && media.kind === 'image';
}

/** The counter shown while recording, as minutes and seconds. */
export function describeRecordingLength(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
