import type { ExportManifestEntry } from './complianceExportManifest.js';
import { describeExclusionReason } from './complianceExportManifest.js';

/**
 * The conversation transcript — the file a lawyer actually opens.
 *
 * An export of one JSON file per message is a data dump, not a record. Nobody
 * reviewing a dispute reads it, and a court will not accept a folder of
 * fragments as "the conversation". What is needed is the conversation as it was
 * held: in order, with names, timestamps and attachments in place.
 *
 * This is what Microsoft produces for Teams, and for the same reason. The
 * machine-readable copies still ship alongside it for review platforms that
 * want them; they are simply no longer the thing being handed over.
 *
 * **Everything is escaped.** Message text is written by people, and an export
 * is opened in a browser by somebody outside the organization. Unescaped text
 * would let a message run code on the reviewer's machine.
 *
 * **Unreadable messages appear in place.** A transcript that silently skipped
 * them would misrepresent the conversation, showing an unbroken exchange where
 * there is a gap.
 *
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

export interface TranscriptMessage {
  entry: ExportManifestEntry;
  /** Null when the message could not be read. */
  text: string | null;
}

export interface TranscriptInput {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  criteriaSummary: string;
  exportId: string;
  generatedAtMs: number;
  messages: TranscriptMessage[];
  nameForUid: (uid: string) => string;
}

export function buildConversationTranscript(input: TranscriptInput): string {
  const participants = Array.from(new Set(input.messages.map((message) => message.entry.senderUid)))
    .map(input.nameForUid)
    .sort((left, right) => left.localeCompare(right));

  const ordered = [...input.messages]
    .sort((left, right) => left.entry.sentAtMs - right.entry.sentAtMs);

  const first = ordered[0]?.entry.sentAtMs;
  const last = ordered[ordered.length - 1]?.entry.sentAtMs;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(conversationTitle(input))}</title>
<style>
  :root { color-scheme: light; }
  body {
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    line-height: 1.5;
    margin: 0 auto;
    max-width: 820px;
    padding: 32px 24px 64px;
  }
  header { border-bottom: 2px solid #111827; margin-bottom: 28px; padding-bottom: 18px; }
  h1 { font-size: 20px; margin: 0 0 10px; }
  .facts { color: #4b5563; font-size: 13px; }
  .facts div { margin-top: 3px; }
  .message { border-top: 1px solid #e5e7eb; padding: 14px 0; }
  .message:first-of-type { border-top: 0; }
  .who { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  .name { font-weight: 600; }
  .when { color: #6b7280; font-size: 12px; font-variant-numeric: tabular-nums; }
  .text { margin-top: 5px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .files { margin-top: 8px; }
  .file {
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
    display: block; font-size: 13px; margin-top: 5px; padding: 7px 10px;
    text-decoration: none; color: #1d4ed8;
  }
  .file.missing { color: #92400e; }
  .file .why { color: #6b7280; display: block; font-size: 12px; margin-top: 2px; }
  .unreadable {
    background: #fffbeb; border-left: 3px solid #d97706; color: #92400e;
    font-size: 13px; margin-top: 5px; padding: 8px 11px;
  }
  footer { border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; margin-top: 32px; padding-top: 14px; }
  @media print { body { max-width: none; padding: 0; } .file { text-decoration: none; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(conversationTitle(input))}</h1>
  <div class="facts">
    <div><strong>Participants:</strong> ${escapeHtml(participants.join(', ') || 'None')}</div>
    <div><strong>Messages:</strong> ${ordered.length}${first && last
      ? ` — ${escapeHtml(formatStamp(first))} to ${escapeHtml(formatStamp(last))}`
      : ''}</div>
    <div><strong>Search:</strong> ${escapeHtml(input.criteriaSummary)}</div>
    <div><strong>Export reference:</strong> ${escapeHtml(input.exportId)}</div>
    <div><strong>Produced:</strong> ${escapeHtml(formatStamp(input.generatedAtMs))}</div>
  </div>
</header>

${ordered.map((message) => renderMessage(message, input.nameForUid)).join('\n')}

<footer>
  Produced by Synzapp on ${escapeHtml(formatStamp(input.generatedAtMs))}.
  Messages that could not be read are shown in place with the reason, so this
  transcript reflects the conversation in full rather than only its readable
  parts. See manifest.csv for the complete index.
</footer>
</body>
</html>
`;
}

function conversationTitle(input: TranscriptInput): string {
  return input.conversationKind === 'GROUP' ? 'Group conversation' : 'Direct conversation';
}

function renderMessage(
  message: TranscriptMessage,
  nameForUid: (uid: string) => string
): string {
  const { entry } = message;
  const body = entry.excludedReason
    ? `<div class="unreadable">${escapeHtml(describeExclusionReason(entry.excludedReason))}</div>`
    : `<div class="text">${escapeHtml(message.text || '')}</div>`;

  const files = entry.media.map((media) => {
    if (media.excludedReason || !media.filePath) {
      return `<span class="file missing">${escapeHtml(media.fileName)}`
        + `<span class="why">Not included. `
        + `${escapeHtml(describeExclusionReason(media.excludedReason || 'MEDIA_MISSING'))}</span></span>`;
    }

    // Relative link, so the transcript and its files stay together when the
    // bundle is unzipped anywhere.
    return `<a class="file" href="${escapeAttribute(toRelativeHref(media.filePath))}">`
      + `${escapeHtml(media.fileName)}`
      + `<span class="why">${escapeHtml(formatBytes(media.sizeBytes))}</span></a>`;
  }).join('\n      ');

  return `<div class="message">
  <div class="who">
    <span class="name">${escapeHtml(nameForUid(entry.senderUid))}</span>
    <span class="when">${escapeHtml(formatStamp(entry.sentAtMs))}</span>
  </div>
  ${body}
  ${files ? `<div class="files">\n      ${files}\n  </div>` : ''}
</div>`;
}

/** Transcripts live one folder deep, so paths from the bundle root step up. */
function toRelativeHref(filePath: string): string {
  return `../${filePath}`.split('/').map(encodeURIComponent).join('/').replace(/%2E%2E/g, '..');
}

function formatStamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${Math.max(sizeBytes, 0)} bytes`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = sizeBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${Math.round(value * 10) / 10} ${units[unitIndex]}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
