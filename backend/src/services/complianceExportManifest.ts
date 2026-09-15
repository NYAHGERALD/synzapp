import { toCsvCell } from './csvCell.js';
/**
 * The manifest that ships inside every eDiscovery export.
 *
 * **An export that quietly misses items is worse than no export**, because
 * somebody will swear to its completeness in front of a court. So the manifest
 * is not a summary of what worked — it is a complete accounting of every message
 * the search matched, including the ones that could not be included and the
 * reason for each.
 *
 * Kept free of Firestore and storage so the accounting rules can be tested
 * directly. The export service decides what happened to each message; this file
 * decides how that is stated.
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

/** Why a matched message or file is not in the export. */
export type ExportExclusionReason =
  | 'NOT_ARCHIVED'
  | 'NO_ARCHIVE_KEY'
  | 'DECRYPT_FAILED'
  | 'MEDIA_MISSING'
  | 'MEDIA_DECRYPT_FAILED'
  | 'MEDIA_TOO_LARGE'
  | 'EXPORT_FULL';

export interface ExportManifestMediaEntry {
  contentType: string;
  excludedReason: ExportExclusionReason | null;
  fileName: string;
  /** Null when the file could not be included. */
  filePath: string | null;
  mediaId: string;
  sizeBytes: number;
}

export interface ExportManifestEntry {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  envelopeId: string;
  excludedReason: ExportExclusionReason | null;
  media: ExportManifestMediaEntry[];
  /** Null when the message body could not be included. */
  messageFilePath: string | null;
  senderUid: string;
  sentAtMs: number;
}

export interface ExportCriteria {
  conversationIds: string[];
  custodianUids: string[];
  fromMs: number | null;
  holdId: string | null;
  /** Recorded so a manifest shows whether files were asked for at all. */
  includeAttachments?: boolean;
  toMs: number | null;
}

export interface ExportManifest {
  /**
   * PARTIAL whenever anything the search matched could not be included.
   *
   * Stated as a single word at the top so nobody has to total the counts to
   * discover the export is incomplete.
   */
  completeness: 'COMPLETE' | 'PARTIAL';
  criteria: ExportCriteria;
  entries: ExportManifestEntry[];
  exclusions: { count: number; meaning: string; reason: ExportExclusionReason }[];
  exportId: string;
  generatedAtMs: number;
  generatedByUid: string;
  tenantId: string;
  totals: {
    matchedMessages: number;
    excludedMessages: number;
    includedMessages: number;
    includedMediaFiles: number;
    excludedMediaFiles: number;
  };
}

/**
 * Plain-English meanings, written for the person receiving the export.
 *
 * A lawyer reading a manifest is entitled to know why something is missing
 * without asking an engineer. "NOT_ARCHIVED" tells them nothing; the sentence
 * tells them the gap is permanent and why, which is what determines whether
 * they need to look somewhere else for that message.
 */
export function describeExclusionReason(reason: ExportExclusionReason): string {
  switch (reason) {
    case 'NOT_ARCHIVED':
      return 'Sent before this organization had a compliance archive. The message '
        + 'exists on the participants\' devices but was never readable by the '
        + 'organization, and this cannot be corrected after the fact.';
    case 'NO_ARCHIVE_KEY':
      return 'This organization has no compliance archive key, so no message can '
        + 'be read. Nothing in this period is recoverable through an export.';
    case 'DECRYPT_FAILED':
      return 'The archived copy exists but could not be unscrambled. This is a '
        + 'fault worth reporting, not an expected gap.';
    case 'MEDIA_MISSING':
      return 'The attached file is referenced by the message but is no longer in '
        + 'storage. The message text is included; the file is not.';
    case 'MEDIA_DECRYPT_FAILED':
      return 'The attached file was found but could not be unscrambled. The '
        + 'message text is included; the file is not.';
    case 'MEDIA_TOO_LARGE':
      return 'The attached file is larger than a single export can carry. Request '
        + 'it separately using the message reference in this manifest.';
    case 'EXPORT_FULL':
      return 'This export reached its total size limit before this file could be '
        + 'added. Narrow the dates or the people and take a further export to '
        + 'collect it.';
    default:
      return 'Excluded for an unrecorded reason.';
  }
}

export function buildExportManifest(input: {
  criteria: ExportCriteria;
  entries: ExportManifestEntry[];
  exportId: string;
  generatedAtMs: number;
  generatedByUid: string;
  tenantId: string;
}): ExportManifest {
  const counts = new Map<ExportExclusionReason, number>();

  const addExclusion = (reason: ExportExclusionReason) => {
    counts.set(reason, (counts.get(reason) || 0) + 1);
  };

  let excludedMessages = 0;
  let includedMessages = 0;
  let excludedMediaFiles = 0;
  let includedMediaFiles = 0;

  for (const entry of input.entries) {
    if (entry.excludedReason) {
      excludedMessages += 1;
      addExclusion(entry.excludedReason);
    } else {
      includedMessages += 1;
    }

    for (const media of entry.media) {
      if (media.excludedReason) {
        excludedMediaFiles += 1;
        addExclusion(media.excludedReason);
      } else {
        includedMediaFiles += 1;
      }
    }
  }

  const exclusions = Array.from(counts.entries())
    .map(([reason, count]) => ({
      count,
      meaning: describeExclusionReason(reason),
      reason
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));

  return {
    completeness: excludedMessages > 0 || excludedMediaFiles > 0 ? 'PARTIAL' : 'COMPLETE',
    criteria: input.criteria,
    entries: input.entries,
    exclusions,
    exportId: input.exportId,
    generatedAtMs: input.generatedAtMs,
    generatedByUid: input.generatedByUid,
    tenantId: input.tenantId,
    totals: {
      excludedMediaFiles,
      excludedMessages,
      includedMediaFiles,
      includedMessages,
      matchedMessages: input.entries.length
    }
  };
}

/**
 * The manifest as a spreadsheet, one row per matched message.
 *
 * Provided because the people who read these open a spreadsheet, not a JSON
 * file, and an export whose index cannot be sorted or filtered is an index
 * nobody uses.
 */
export function formatManifestCsv(
  manifest: ExportManifest,
  /** Names, so the spreadsheet reads the same as the transcript beside it. */
  nameForUid: (uid: string) => string = (uid) => uid
): string {
  const rows: string[][] = [[
    'Sent (UTC)',
    'Conversation',
    'Conversation type',
    'Sender',
    'Message reference',
    'Included',
    'Reason if missing',
    'File in export',
    'Attachments included',
    'Attachments missing'
  ]];

  for (const entry of manifest.entries) {
    const includedMedia = entry.media.filter((media) => !media.excludedReason).length;
    const excludedMedia = entry.media.length - includedMedia;

    rows.push([
      new Date(entry.sentAtMs).toISOString(),
      entry.conversationId,
      entry.conversationKind === 'GROUP' ? 'Group' : 'Direct',
      nameForUid(entry.senderUid),
      entry.envelopeId,
      entry.excludedReason ? 'No' : 'Yes',
      entry.excludedReason ? describeExclusionReason(entry.excludedReason) : '',
      entry.messageFilePath || '',
      String(includedMedia),
      String(excludedMedia)
    ]);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * A manifest cell can hold a sentence with commas, quotes and newlines in it,
 * and it can hold a display name somebody chose. The first shifts every column
 * after it; the second is executed by Excel when the file is opened. This
 * manifest goes to auditors and into eDiscovery bundles, so both matter.
 */
function escapeCsvCell(value: string): string {
  return toCsvCell(value);
}
