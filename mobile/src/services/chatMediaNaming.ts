/**
 * What a recorded photo or video is called once it leaves the phone.
 *
 * The camera hands back whatever the platform felt like: on Android that is a
 * bare identifier such as `21c6c38c-1e9a-4ce8-bbd7-0e96798b172b.mp4`. That name
 * is carried in the message, shown in the viewer, and is what somebody gets
 * when they save or forward the file. A row of hex tells the person who
 * received it nothing, and a folder of them cannot be sorted or searched.
 *
 * So a recording is named the way WhatsApp, Signal and every camera roll name
 * theirs: what it is, then when it was taken, most significant part first, so a
 * plain alphabetical sort is also a sort by date.
 *
 *     Synzapp-Video-20260906-051334.mp4
 *     Synzapp-Photo-20260906-051334.jpg
 *
 * Files chosen from the library keep the name they already had. Somebody who
 * picked `Site survey east wing.mp4` meant to send that, and renaming it would
 * throw away the only description the file has.
 */

/** Only these are ever produced, so the name can never carry a surprise. */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/heic': 'heic',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/3gpp': '3gp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm'
};

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/**
 * The moment, in the phone's own timezone.
 *
 * Local rather than UTC on purpose: this is read by a person who wants to know
 * when the thing in front of them was recorded, not by a machine reconciling
 * clocks. The timestamp in the message itself remains the record.
 */
export function formatChatMediaTimestamp(capturedAtMs: number): string {
  const captured = new Date(capturedAtMs);
  const date = [
    captured.getFullYear(),
    twoDigits(captured.getMonth() + 1),
    twoDigits(captured.getDate())
  ].join('');
  const time = [
    twoDigits(captured.getHours()),
    twoDigits(captured.getMinutes()),
    twoDigits(captured.getSeconds())
  ].join('');

  return `${date}-${time}`;
}

export function buildRecordedChatMediaFileName(input: {
  capturedAtMs: number;
  contentType?: string | null;
  kind: string;
}): string {
  const label = input.kind === 'video' ? 'Video' : 'Photo';
  const contentType = (input.contentType || '').trim().toLowerCase();
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ||
    (input.kind === 'video' ? 'mp4' : 'jpg');

  return `Synzapp-${label}-${formatChatMediaTimestamp(input.capturedAtMs)}.${extension}`;
}
