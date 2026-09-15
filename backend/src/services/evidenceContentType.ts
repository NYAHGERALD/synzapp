/**
 * What an evidence file may claim to be.
 *
 * Both evidence stores used a shape check — RAILS matched `type/subtype`, RCA
 * matched the same against five top-level types — and whatever passed was echoed
 * back as the response content type with `Content-Disposition: inline`. The web
 * app then reissued those bytes as a `blob:` URL **on its own origin**.
 *
 * So `text/html` survived both checks, and an uploaded file became a page
 * running as the person viewing it. The evidence library is tenant-wide rather
 * than per-item, so one uploader reached every colleague. Nothing in the stack
 * blunted it: a blob document inherits the Content-Security-Policy of the page
 * that created it, and the web app had none.
 *
 * A shape check cannot express any of that. This is an allowlist instead, and
 * the two types worth naming are the two that are deliberately absent:
 *
 *   - `text/html`, and anything else a browser renders as a document.
 *   - `image/svg+xml`, which looks like a picture and is a script host.
 *
 * Anything unrecognised becomes `application/octet-stream`, which browsers
 * download rather than run. That is a worse experience for an odd file type and
 * the right default for a file somebody else uploaded.
 *
 * Pure, so the list can be tested without a database.
 */

/** Photographs and scans. Raster only — an SVG is a script host, not a picture. */
const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff'
];

const VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/3gpp'
];

const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg'
];

/**
 * Documents. A PDF can carry script of its own, so it is allowed to be stored
 * and named honestly but must never be served inline — the routes send
 * `Content-Disposition: attachment` for everything.
 */
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'text/csv'
];

export const ALLOWED_EVIDENCE_CONTENT_TYPES = new Set([
  ...IMAGE_TYPES,
  ...VIDEO_TYPES,
  ...AUDIO_TYPES,
  ...DOCUMENT_TYPES
]);

export const FALLBACK_EVIDENCE_CONTENT_TYPE = 'application/octet-stream';

/**
 * The content type to store and serve for an uploaded file.
 *
 * `image/jpg` is corrected to `image/jpeg` because phones send it and it is the
 * same picture; nothing else is guessed at.
 */
export function normalizeEvidenceContentType(contentType?: string | null): string {
  const claimed = (contentType || '').trim().toLowerCase().split(';')[0].trim();
  const corrected = claimed === 'image/jpg' ? 'image/jpeg' : claimed;

  return ALLOWED_EVIDENCE_CONTENT_TYPES.has(corrected)
    ? corrected
    : FALLBACK_EVIDENCE_CONTENT_TYPE;
}

/**
 * Whether a type is one a browser would run as a document.
 *
 * Exported for the tests rather than the code, so the two types this exists to
 * keep out are asserted by name and cannot quietly return to the list.
 */
export function isRenderableAsDocument(contentType: string): boolean {
  const safe = (contentType || '').trim().toLowerCase();

  return safe === 'text/html' ||
    safe === 'application/xhtml+xml' ||
    safe === 'image/svg+xml' ||
    safe === 'text/xml' ||
    safe === 'application/xml' ||
    safe.endsWith('+xml');
}
