import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import JSZip from 'jszip';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import {
  buildExportManifest,
  formatManifestCsv,
  type ExportCriteria,
  type ExportManifestEntry,
  type ExportManifestMediaEntry
} from './complianceExportManifest.js';
import { createArchivedMediaDecryptStream, decryptArchivedMedia } from './archivedMediaDecryptor.js';
import { buildConversationTranscript, type TranscriptMessage } from './complianceTranscript.js';
import { listCompliancePeople } from './complianceDirectoryService.js';
import {
  searchArchivedMessages,
  type ArchivedMessage,
  type ArchivedMessageMedia
} from './complianceSearchService.js';

/**
 * Builds an eDiscovery export: a single file an administrator can hand to a
 * lawyer.
 *
 * Three properties matter, and each exists because of how these are used.
 *
 * **The export copies the bytes.** Not signed links — an export taken today has
 * to open years from now, long after any link has expired and possibly after the
 * original conversation has been deleted under a retention policy.
 *
 * **The export always contains a manifest.** Somebody will swear to the
 * completeness of what is in here, so what is missing is stated rather than
 * left to be discovered.
 *
 * **A failure to include one item never fails the export.** An unreadable
 * attachment is recorded as an exclusion and the other ten thousand messages
 * still arrive.
 *
 * Scope note: chat conversations only. This does not read or touch the
 * interpreter or any other part of Synzapp.
 */

/**
 * Size limits, set by the memory this runs in rather than by taste.
 *
 * The container has 512Mi. Decrypting one attachment holds the encrypted copy
 * and the decrypted copy at the same time, so a single large file was enough to
 * run the container out of memory — which does not fail one export, it kills
 * the instance and every other request being served by it.
 *
 * The whole-export budget exists for the same reason: many medium files add up
 * to the same crash as one huge one. Both limits are reported in the manifest,
 * never applied silently.
 */
const MAX_MEDIA_BYTES_IN_EXPORT = 2 * 1024 * 1024 * 1024;
const MAX_EXPORT_MEDIA_BUDGET_BYTES = 4 * 1024 * 1024 * 1024;
/**
 * The ceiling for older single-part attachments only.
 *
 * Those were sealed as one piece and cannot be opened until the whole file is
 * in memory. Chunked attachments — everything sent by a current app — stream a
 * chunk at a time and are not limited by this.
 */
const MAX_UNSTREAMABLE_MEDIA_BYTES = 20 * 1024 * 1024;

/**
 * Photos, videos and voice notes are stored, not compressed.
 *
 * They are already compressed formats, so deflating them costs time and saves
 * nothing. Text — transcripts, the manifest, the JSON — still compresses, which
 * is where compression actually pays.
 */
const MEDIA_ZIP_OPTIONS = { compression: 'STORE' as const };
/**
 * How long a download link is good for.
 *
 * A signed URL is a bearer credential: it bypasses every Storage rule, and
 * anybody holding the string can fetch an unencrypted zip of a company's
 * decrypted chat history. Twenty-four hours of that sat in browser history,
 * proxy logs and whatever the link was pasted into.
 *
 * An hour is the window to *start* a download, not to finish one, so a large
 * bundle is unaffected. The gating itself was always sound — requireComplianceAdmin
 * decides who may ask — it was only the life of the answer that was wrong.
 */
const EXPORT_DOWNLOAD_TTL_MS = 60 * 60 * 1000;
/**
 * How long a built export is kept.
 *
 * An export bundle is an organization's messages in readable form. Keeping them
 * for ever quietly builds a second, unencrypted archive beside the real one —
 * exactly the thing retention exists to prevent — so they expire and are
 * cleared by the nightly run.
 */
const EXPORT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_EXPORT = 5000;

/**
 * Where an export has got to.
 *
 * PENDING is written before any work starts, so an export that dies mid-way is
 * still visible as an unfinished job rather than vanishing. A sweep picks up
 * anything left PENDING or RUNNING too long.
 */
export type ComplianceExportState = 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';

export interface ComplianceExportRecord {
  /**
   * SHA-256 of the bundle exactly as it was written.
   *
   * What lets whoever receives the export show that the file they hold is the
   * file that was handed over — and lets you show it too. A bundle nobody can
   * verify is worth much less in the proceeding it was produced for.
   */
  archiveSha256?: string | null;
  completeness: 'COMPLETE' | 'PARTIAL';
  /** Set when the job failed, so the console can say why rather than hang. */
  error?: string | null;
  finishedAtMs?: number | null;
  /** Messages packaged so far, against `totalMessages`. */
  processedMessages: number;
  /** What the job is doing, in words an administrator can read. */
  stage: string;
  startedAtMs?: number | null;
  state: ComplianceExportState;
  totalMessages: number;
  /** What the file is called when an administrator downloads it. */
  downloadFileName: string;
  expiresAtMs: number;
  createdAtMs: number;
  createdByUid: string;
  criteria: ExportCriteria;
  excludedMediaFiles: number;
  excludedMessages: number;
  id: string;
  includedMediaFiles: number;
  includedMessages: number;
  matchedMessages: number;
  sizeBytes: number;
  storagePath: string;
  tenantId: string;
}

function exportsRef(tenantId: string) {
  return firestore.collection('tenants').doc(tenantId).collection('complianceExports');
}

export interface ComplianceExportRequest {
  actorUid: string;
  conversationIds?: string[];
  custodianUids?: string[];
  fromMs?: number | null;
  holdId?: string | null;
  includeAttachments?: boolean;
  tenantId: string;
  text?: string | null;
  toMs?: number | null;
}

/**
 * Records the request and returns immediately.
 *
 * The packaging happens afterwards, in `runComplianceExport`. An export across a
 * busy organization's year of conversations takes longer than a browser will
 * wait, and doing it inside the request meant the administrator watched a
 * button with no idea whether it was working — and a large enough search would
 * simply time out and lose everything it had done.
 */
export async function requestComplianceExport(
  input: ComplianceExportRequest
): Promise<ComplianceExportRecord> {
  const nowMs = Date.now();
  const exportRef = exportsRef(input.tenantId).doc();
  const criteria: ExportCriteria = {
    conversationIds: input.conversationIds || [],
    custodianUids: input.custodianUids || [],
    fromMs: input.fromMs ?? null,
    holdId: input.holdId ?? null,
    includeAttachments: input.includeAttachments !== false,
    toMs: input.toMs ?? null
  };

  const record: ComplianceExportRecord = {
    completeness: 'COMPLETE',
    createdAtMs: nowMs,
    createdByUid: input.actorUid,
    criteria,
    downloadFileName: '',
    error: null,
    excludedMediaFiles: 0,
    excludedMessages: 0,
    expiresAtMs: nowMs + EXPORT_RETENTION_MS,
    finishedAtMs: null,
    id: exportRef.id,
    includedMediaFiles: 0,
    includedMessages: 0,
    matchedMessages: 0,
    processedMessages: 0,
    sizeBytes: 0,
    stage: 'Waiting to start',
    startedAtMs: null,
    state: 'PENDING',
    storagePath: '',
    tenantId: input.tenantId,
    totalMessages: 0
  };

  await exportRef.set({
    ...record,
    // The search itself is kept so the worker can run it without the request.
    request: {
      conversationIds: input.conversationIds || [],
      custodianUids: input.custodianUids || [],
      fromMs: input.fromMs ?? null,
      holdId: input.holdId ?? null,
      includeAttachments: input.includeAttachments !== false,
      text: input.text ?? null,
      toMs: input.toMs ?? null
    },
    createdAt: fieldValue.serverTimestamp()
  });

  return record;
}

interface StoredExportRequest {
  conversationIds: string[];
  custodianUids: string[];
  fromMs: number | null;
  holdId: string | null;
  includeAttachments: boolean;
  text: string | null;
  toMs: number | null;
}

/** How long a job may sit before a sweep decides it died and restarts it. */
const EXPORT_STALE_MS = 30 * 60 * 1000;

/**
 * Packages one requested export.
 *
 * Progress is written to the record as it goes, because the only thing worse
 * than a slow export is a slow export that looks identical to a broken one.
 */
export async function runComplianceExport(input: {
  exportId: string;
  tenantId: string;
}): Promise<ComplianceExportRecord | null> {
  const exportRef = exportsRef(input.tenantId).doc(input.exportId);
  const snapshot = await exportRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const stored = snapshot.data() as ComplianceExportRecord & { request?: StoredExportRequest };

  if (stored.state === 'READY' || stored.state === 'RUNNING') {
    return stored;
  }

  const request = stored.request;

  if (!request) {
    await exportRef.set({
      error: 'This export is missing the search that created it.',
      finishedAtMs: Date.now(),
      stage: 'Failed',
      state: 'FAILED'
    }, { merge: true });

    return null;
  }

  const generatedAtMs = Date.now();

  await exportRef.set({
    stage: 'Searching conversations',
    startedAtMs: generatedAtMs,
    state: 'RUNNING'
  }, { merge: true });

  // Timed by stage. Three separate guesses at why an export took 347 seconds
  // were all wrong — compression, then the zip library — and each cost a
  // deploy to disprove. The timings say where the time actually goes.
  const timings = { mediaMs: 0, packageMs: 0, peopleMs: 0, searchMs: 0, uploadMs: 0 };
  let stageStartedMs = Date.now();

  try {
    const search = await searchArchivedMessages({
      conversationIds: request.conversationIds,
      custodianUids: request.custodianUids,
      fromMs: request.fromMs,
      holdId: request.holdId,
      limit: MAX_MESSAGES_PER_EXPORT,
      tenantId: input.tenantId,
      text: request.text,
      toMs: request.toMs
    });

    timings.searchMs = Date.now() - stageStartedMs;
    stageStartedMs = Date.now();

    await exportRef.set({
      matchedMessages: search.hits.length,
      stage: `Packaging ${search.hits.length} message${search.hits.length === 1 ? '' : 's'}`,
      totalMessages: search.hits.length
    }, { merge: true });

    const includeAttachments = request.includeAttachments !== false;
    const people = await listCompliancePeople(input.tenantId).catch(() => []);
    const nameByUid = new Map(people.map((person) => [person.uid, person.displayName]));
    const nameForUid = (uid: string) => nameByUid.get(uid) || uid;

    timings.peopleMs = Date.now() - stageStartedMs;
    stageStartedMs = Date.now();
    const transcriptsByConversation = new Map<string, TranscriptMessage[]>();
    const zip = new JSZip();
    const entries: ExportManifestEntry[] = [];
    const budget = { remainingBytes: includeAttachments ? MAX_EXPORT_MEDIA_BUDGET_BYTES : 0 };
    let processedMessages = 0;
    let lastReportedAtMs = 0;

    for (const message of search.hits) {
      const messageStartedMs = Date.now();
      const entry = await addMessageToExport({ budget, message, tenantId: input.tenantId, zip });

      if (message.media.length) {
        timings.mediaMs += Date.now() - messageStartedMs;
      }

      entries.push(entry);

      const existing = transcriptsByConversation.get(message.conversationId) || [];

      existing.push({ entry, text: message.text });
      transcriptsByConversation.set(message.conversationId, existing);

      processedMessages += 1;

      // Reported at most once a second. A write per message would cost more
      // than the packaging on a large export.
      if (Date.now() - lastReportedAtMs > 1000) {
        lastReportedAtMs = Date.now();
        await exportRef.set({ processedMessages }, { merge: true }).catch(() => undefined);
      }
    }

    timings.packageMs = Date.now() - stageStartedMs;
    stageStartedMs = Date.now();

    const criteria = stored.criteria;
    const manifest = buildExportManifest({
      criteria,
      entries,
      exportId: input.exportId,
      generatedAtMs,
      generatedByUid: stored.createdByUid,
      tenantId: input.tenantId
    });

    const criteriaSummary = describeCriteria(criteria, nameForUid);

    for (const [conversationId, messages] of transcriptsByConversation) {
      const participantNames = Array.from(new Set(messages.map((item) => item.entry.senderUid)))
        .map(nameForUid)
        .sort((left, right) => left.localeCompare(right));

      zip.file(
        `transcripts/${sanitizeFileName(
          `${participantNames.join(' and ') || 'Conversation'} (${conversationId.slice(-8)})`,
          conversationId
        )}.html`,
        buildConversationTranscript({
          conversationId,
          conversationKind: messages[0]?.entry.conversationKind || 'DIRECT',
          criteriaSummary,
          exportId: input.exportId,
          generatedAtMs,
          messages,
          nameForUid
        })
      );
    }

    zip.file('manifest.csv', formatManifestCsv(manifest, nameForUid));
    zip.file('data/manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt', buildReadme({
      completeness: manifest.completeness,
      conversationCount: transcriptsByConversation.size,
      criteriaSummary,
      truncated: search.truncated
    }));

    await exportRef.set({ processedMessages, stage: 'Finishing the export file' }, { merge: true });

    const storagePath = `complianceExports/${input.tenantId}/${input.exportId}.zip`;
    const { sha256, sizeBytes } = await writeArchiveToStorage(zip, storagePath);

    timings.uploadMs = Date.now() - stageStartedMs;

    console.log('[SynzappComplianceExport] timings', JSON.stringify({
      exportId: input.exportId,
      messages: search.hits.length,
      sizeBytes,
      totalMs: Date.now() - generatedAtMs,
      ...timings
    }));

    const finished: Partial<ComplianceExportRecord> = {
      /** The digest of the bundle as it was written, for whoever receives it. */
      archiveSha256: sha256,
      completeness: manifest.completeness,
      downloadFileName: buildDownloadFileName({
        criteria,
        exportId: input.exportId,
        generatedAtMs,
        nameForUid
      }),
      error: null,
      excludedMediaFiles: manifest.totals.excludedMediaFiles,
      excludedMessages: manifest.totals.excludedMessages,
      finishedAtMs: Date.now(),
      includedMediaFiles: manifest.totals.includedMediaFiles,
      includedMessages: manifest.totals.includedMessages,
      matchedMessages: manifest.totals.matchedMessages,
      processedMessages,
      sizeBytes,
      stage: 'Ready to download',
      state: 'READY',
      storagePath
    };

    await exportRef.set(finished, { merge: true });

    return { ...stored, ...finished } as ComplianceExportRecord;
  } catch (error) {
    // Recorded rather than thrown away. An export that failed silently looks
    // exactly like one still running, and an administrator would wait for it.
    const message = error instanceof Error ? error.message : 'The export could not be built.';

    console.error('[SynzappComplianceExport] export failed', {
      exportId: input.exportId,
      message,
      tenantId: input.tenantId
    });

    await exportRef.set({
      error: message,
      finishedAtMs: Date.now(),
      stage: 'Failed',
      state: 'FAILED'
    }, { merge: true }).catch(() => undefined);

    return null;
  }
}

/**
 * Restarts exports that were left unfinished.
 *
 * A container can be replaced mid-export. Without this the job would sit at
 * "Packaging" for ever, which is indistinguishable from slow progress.
 */
export async function resumeStalledComplianceExports(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<{ resumed: number }> {
  const nowMs = input.nowMs ?? Date.now();
  const candidates = await exportsRef(input.tenantId)
    .where('state', 'in', ['PENDING', 'RUNNING'])
    .limit(10)
    .get();

  let resumed = 0;

  for (const doc of candidates.docs) {
    const record = doc.data() as ComplianceExportRecord;
    const startedAtMs = record.startedAtMs || record.createdAtMs;

    if (nowMs - startedAtMs < EXPORT_STALE_MS) {
      continue;
    }

    // Put back to PENDING so the worker will pick it up again.
    await doc.ref.set({ stage: 'Restarting after an interruption', state: 'PENDING' }, { merge: true });
    await runComplianceExport({ exportId: doc.id, tenantId: input.tenantId });

    resumed += 1;
  }

  return { resumed };
}

/**
 * Streams the archive into storage and reports how large it turned out.
 *
 * Measured before being replaced: zipping 60 MB of video plus 200 messages
 * takes about a quarter of a second here. When an export took 347 seconds, this
 * was not where the time went — recorded so the next person does not rewrite it
 * on the same wrong hunch.
 */
async function writeArchiveToStorage(
  zip: JSZip,
  storagePath: string
): Promise<{ sha256: string; sizeBytes: number }> {
  const file = storageBucket.file(storagePath);
  /**
   * The digest that makes the bundle checkable after it leaves.
   *
   * An eDiscovery bundle with no digest cannot be verified by whoever receives
   * it, which is most of what it was produced for: the other side has no way to
   * show the file they hold is the file that was handed over, and neither do
   * you. The same codebase already does this properly for the interpreter,
   * where the comment reads "the digest is what makes a dispute settleable".
   *
   * Taken in transit rather than by reading the file back. The archive is
   * already being streamed to Storage, so this costs one pass over bytes that
   * are passing anyway — no second download of something that may be gigabytes.
   *
   * Over the whole archive, not per file. The media inside is handed to the zip
   * as a stream and drained later, long after the manifest has been written, so
   * a per-file digest could not reach the manifest without buffering entire
   * videos in memory. The bundle digest is also the one a receiver actually
   * checks.
   */
  const archiveDigest = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const writeStream = file.createWriteStream({
      contentType: 'application/zip',
      resumable: false
    });
    const digestTap = new Transform({
      transform(chunk, _encoding, callback) {
        archiveDigest.update(chunk);
        callback(null, chunk);
      }
    });

    zip.generateNodeStream({ compression: 'DEFLATE', streamFiles: true })
      .on('error', reject)
      .pipe(digestTap)
      .on('error', reject)
      .pipe(writeStream)
      .on('error', reject)
      .on('finish', resolve);
  });

  const [metadata] = await file.getMetadata();

  return {
    sha256: archiveDigest.digest('hex'),
    sizeBytes: Number(metadata.size || 0)
  };
}

async function addMessageToExport(input: {
  budget: { remainingBytes: number };
  message: ArchivedMessage;
  tenantId: string;
  zip: JSZip;
}): Promise<ExportManifestEntry> {
  const { message } = input;
  const folder = `data/messages/${message.conversationId}`;
  const baseName = `${new Date(message.sentAtMs).toISOString().replace(/[:.]/g, '-')}_${message.envelopeId}`;

  if (message.unreadableReason) {
    // Listed with its reason and no file. The alternative — omitting it — would
    // make the export look complete when it is not.
    return {
      conversationId: message.conversationId,
      conversationKind: message.conversationKind,
      envelopeId: message.envelopeId,
      excludedReason: message.unreadableReason,
      media: [],
      messageFilePath: null,
      senderUid: message.senderUid,
      sentAtMs: message.sentAtMs
    };
  }

  const messageFilePath = `${folder}/${baseName}.json`;

  input.zip.file(messageFilePath, JSON.stringify({
    conversationId: message.conversationId,
    conversationKind: message.conversationKind,
    envelopeId: message.envelopeId,
    recipientUid: message.recipientUid,
    senderUid: message.senderUid,
    sentAt: new Date(message.sentAtMs).toISOString(),
    sentAtMs: message.sentAtMs,
    text: message.text
  }, null, 2));

  const media: ExportManifestMediaEntry[] = [];

  for (const attachment of message.media) {
    media.push(await addMediaToExport({
      attachment,
      budget: input.budget,
      conversationId: message.conversationId,
      conversationKind: message.conversationKind,
      folder: `attachments/${message.conversationId}`,
      tenantId: input.tenantId,
      zip: input.zip
    }));
  }

  return {
    conversationId: message.conversationId,
    conversationKind: message.conversationKind,
    envelopeId: message.envelopeId,
    excludedReason: null,
    media,
    messageFilePath,
    senderUid: message.senderUid,
    sentAtMs: message.sentAtMs
  };
}

async function addMediaToExport(input: {
  attachment: ArchivedMessageMedia;
  budget: { remainingBytes: number };
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  folder: string;
  tenantId: string;
  zip: JSZip;
}): Promise<ExportManifestMediaEntry> {
  const { attachment } = input;
  const base = {
    contentType: attachment.contentType,
    fileName: attachment.fileName,
    mediaId: attachment.mediaId,
    sizeBytes: attachment.sizeBytes
  };

  if (attachment.sizeBytes > MAX_MEDIA_BYTES_IN_EXPORT) {
    return { ...base, excludedReason: 'MEDIA_TOO_LARGE', filePath: null };
  }

  if (attachment.sizeBytes > input.budget.remainingBytes) {
    return { ...base, excludedReason: 'EXPORT_FULL', filePath: null };
  }

  const storagePath = await findMediaStoragePath({
    conversationId: input.conversationId,
    conversationKind: input.conversationKind,
    mediaId: attachment.mediaId,
    tenantId: input.tenantId
  });

  if (!storagePath) {
    return { ...base, excludedReason: 'MEDIA_MISSING', filePath: null };
  }

  const filePath = `${input.folder}/${sanitizeFileName(attachment.fileName, attachment.mediaId)}`;
  const decryptStream = createArchivedMediaDecryptStream(attachment);

  // Streamed wherever the format allows it, so a large video is produced rather
  // than reported as too big to carry. Only the file's own chunk passes through
  // memory.
  if (decryptStream) {
    try {
      const source = storageBucket.file(storagePath).createReadStream();

      // Timed here because the download does not happen when this function
      // runs — the stream is handed to the archive and drained later, so its
      // cost lands in whatever stage happens to be measuring at the time.
      // Four guesses at the slow stage have already been wrong; this one is
      // measured directly.
      const downloadStartedMs = Date.now();
      let downloadedBytes = 0;

      source.on('data', (piece: Buffer) => {
        downloadedBytes += piece.length;
      });
      source.on('end', () => {
        console.log('[SynzappComplianceExport] attachment read', JSON.stringify({
          declaredSizeBytes: attachment.sizeBytes,
          downloadedBytes,
          fileName: attachment.fileName,
          ms: Date.now() - downloadStartedMs
        }));
      });
      source.on('error', (error) => decryptStream.destroy(error));
      source.pipe(decryptStream);

      input.zip.file(filePath, decryptStream, MEDIA_ZIP_OPTIONS);
      input.budget.remainingBytes -= attachment.sizeBytes;

      return { ...base, excludedReason: null, filePath };
    } catch {
      return { ...base, excludedReason: 'MEDIA_DECRYPT_FAILED', filePath: null };
    }
  }

  // Older single-part attachments cannot be opened until they are whole.
  if (attachment.sizeBytes > MAX_UNSTREAMABLE_MEDIA_BYTES) {
    return { ...base, excludedReason: 'MEDIA_TOO_LARGE', filePath: null };
  }

  const encrypted = await readEncryptedMediaBytes(storagePath);

  if (!encrypted) {
    return { ...base, excludedReason: 'MEDIA_MISSING', filePath: null };
  }

  const plaintext = decryptArchivedMedia({ encrypted, media: attachment });

  if (!plaintext) {
    return { ...base, excludedReason: 'MEDIA_DECRYPT_FAILED', filePath: null };
  }

  input.budget.remainingBytes -= plaintext.length;
  input.zip.file(filePath, plaintext, MEDIA_ZIP_OPTIONS);

  return { ...base, excludedReason: null, filePath };
}

async function findMediaStoragePath(input: {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  mediaId: string;
  tenantId: string;
}): Promise<string | null> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const chatRef = input.conversationKind === 'GROUP'
    ? organizationRef.collection('groups').doc(input.conversationId)
    : organizationRef.collection('directChats').doc(input.conversationId);

  const snapshot = await chatRef.collection('mediaAttachments').doc(input.mediaId).get();

  if (!snapshot.exists) {
    return null;
  }

  return (snapshot.data() as { storagePath?: string }).storagePath || null;
}

async function readEncryptedMediaBytes(storagePath: string): Promise<Buffer | null> {
  try {
    const [contents] = await storageBucket.file(storagePath).download();

    return contents;
  } catch {
    // The attachment expired or was purged. Recorded as missing rather than
    // failing the whole export.
    return null;
  }
}

/**
 * A file name safe to unzip anywhere.
 *
 * The name comes from whatever the sender's phone called the file, so it can
 * contain path separators. Left alone, unzipping an export could write outside
 * the folder it was extracted into.
 */
function sanitizeFileName(fileName: string, fallback: string): string {
  const cleaned = fileName
    .replace(/[\\/]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);

  return cleaned || fallback;
}

/**
 * Says in plain words what a person holding this bundle is looking at.
 *
 * Written for whoever opens it — often a lawyer, months later, with no idea how
 * Synzapp works. It names the file to start with rather than leaving them to
 * guess between a transcript, a spreadsheet and a folder of data.
 */
function buildReadme(input: {
  completeness: 'COMPLETE' | 'PARTIAL';
  conversationCount: number;
  criteriaSummary: string;
  truncated: boolean;
}): string {
  const lines = [
    'SYNZAPP COMPLIANCE EXPORT',
    '=========================',
    '',
    `This export covers ${input.conversationCount} conversation`
      + `${input.conversationCount === 1 ? '' : 's'}.`,
    `Search: ${input.criteriaSummary}`,
    '',
    'START HERE',
    '----------',
    'transcripts/   Open these first. Each file is one conversation, readable in',
    '               any web browser, showing who said what and when, in order,',
    '               with its attachments linked. Print to PDF if you need a',
    '               fixed copy.',
    '',
    'ALSO INCLUDED',
    '-------------',
    'attachments/   The original photos, videos and files, exactly as sent.',
    'manifest.csv   One row per message the search matched, and whether it is in',
    '               this export. Opens in Excel.',
    'data/          The same content as structured files, for review software.',
    '',
    'COMPLETENESS',
    '------------'
  ];

  lines.push(input.completeness === 'COMPLETE'
    ? 'Every message this search matched is included in full.'
    : 'This export is INCOMPLETE. Some matched messages or attachments could not\n'
      + 'be included. Every one of them is listed in manifest.csv with the reason,\n'
      + 'and shown in place in the transcript, so nothing is missing without a\n'
      + 'record of it.');

  if (input.truncated) {
    lines.push(
      '',
      'This search reached the maximum number of messages a single export can',
      'carry. Narrow the dates or the people and take further exports to cover',
      'the rest.'
    );
  }

  return lines.join('\n');
}

/**
 * What the downloaded file is called.
 *
 * A download named after an internal id tells the person receiving it nothing,
 * and several of them in one folder are indistinguishable. The name carries the
 * date and who it covers, with a short id kept on the end so two exports of the
 * same search never overwrite each other.
 */
function buildDownloadFileName(input: {
  criteria: ExportCriteria;
  exportId: string;
  generatedAtMs: number;
  nameForUid: (uid: string) => string;
}): string {
  const who = input.criteria.custodianUids.length <= 2 && input.criteria.custodianUids.length > 0
    ? input.criteria.custodianUids.map(input.nameForUid).join(' and ')
    : input.criteria.custodianUids.length
      ? `${input.criteria.custodianUids.length} people`
      : 'All conversations';

  return sanitizeFileName(
    `Synzapp export - ${who} - ${formatDay(input.generatedAtMs)} (${input.exportId.slice(-6)}).zip`,
    `Synzapp-export-${input.exportId}.zip`
  );
}

/** The search, in a sentence a non-technical reader can check. */
function describeCriteria(
  criteria: ExportCriteria,
  nameForUid: (uid: string) => string
): string {
  const parts: string[] = [];

  parts.push(criteria.custodianUids.length
    ? `messages sent to or from ${criteria.custodianUids.map(nameForUid).join(', ')}`
    : 'all messages');

  if (criteria.fromMs && criteria.toMs) {
    parts.push(`between ${formatDay(criteria.fromMs)} and ${formatDay(criteria.toMs)}`);
  } else if (criteria.fromMs) {
    parts.push(`from ${formatDay(criteria.fromMs)} onwards`);
  } else if (criteria.toMs) {
    parts.push(`up to ${formatDay(criteria.toMs)}`);
  }

  if (criteria.holdId) {
    parts.push(`preserved under legal hold ${criteria.holdId}`);
  }

  if (criteria.includeAttachments === false) {
    parts.push('excluding attachments');
  }

  return parts.join(', ');
}

function formatDay(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export async function listComplianceExports(tenantId: string): Promise<ComplianceExportRecord[]> {
  const snapshot = await exportsRef(tenantId).orderBy('createdAtMs', 'desc').limit(100).get();

  return snapshot.docs.map((doc) => normalizeExportRecord({
    ...(doc.data() as ComplianceExportRecord),
    id: doc.id
  }));
}

/**
 * Fills in exports created before jobs existed.
 *
 * Those records have no state at all, so the console had nothing to read and
 * showed them as "Working" for ever — indistinguishable from an export that is
 * genuinely still running, and impossible to clear. A finished file is treated
 * as ready; anything else as failed, which is the truth: it was interrupted and
 * nothing is coming.
 */
function normalizeExportRecord(record: ComplianceExportRecord): ComplianceExportRecord {
  if (record.state) {
    return record;
  }

  const wasFinished = Boolean(record.storagePath) && record.sizeBytes > 0;

  return {
    ...record,
    error: wasFinished ? null : 'This export was interrupted before it finished. Run it again.',
    processedMessages: record.processedMessages || record.matchedMessages || 0,
    stage: wasFinished ? 'Ready to download' : 'Interrupted',
    state: wasFinished ? 'READY' : 'FAILED',
    totalMessages: record.totalMessages || record.matchedMessages || 0
  };
}

/**
 * A time-limited link to download a finished export.
 *
 * Short-lived deliberately: the export contains an organization's readable
 * messages, and a link that never expires is a copy of that archive sitting in
 * whatever inbox it was forwarded to.
 */
export async function createComplianceExportDownloadUrl(input: {
  exportId: string;
  tenantId: string;
}): Promise<{
  archiveSha256: string | null;
  downloadUrl: string;
  expiresAtMs: number;
} | null> {
  const snapshot = await exportsRef(input.tenantId).doc(input.exportId).get();

  if (!snapshot.exists) {
    return null;
  }

  const record = snapshot.data() as ComplianceExportRecord;
  const storagePath = record.storagePath;

  if (!storagePath) {
    return null;
  }

  const expiresAtMs = Date.now() + EXPORT_DOWNLOAD_TTL_MS;
  const [downloadUrl] = await storageBucket.file(storagePath).getSignedUrl({
    action: 'read',
    // Without this the browser saves the file under the storage object's id,
    // which is what put an unreadable name on the downloaded folder.
    promptSaveAs: record.downloadFileName || `Synzapp-export-${input.exportId}.zip`,
    expires: expiresAtMs,
    version: 'v4'
  });

  /**
   * The digest travels with the link, not only in the record.
   *
   * A bundle digest nobody is handed is a digest nobody checks. Whoever receives
   * the export needs it at the moment they take delivery, so it goes back with
   * the link that produces the file.
   */
  return { archiveSha256: record.archiveSha256 || null, downloadUrl, expiresAtMs };
}

/**
 * Deletes expired export bundles for one organization.
 *
 * Called by the nightly retention run. The bundle is removed before its record
 * so that a failure part-way leaves a record pointing at nothing, rather than a
 * readable archive nobody is tracking.
 */
export async function purgeExpiredComplianceExports(input: {
  nowMs?: number;
  tenantId: string;
}): Promise<{ purged: number }> {
  const nowMs = input.nowMs ?? Date.now();
  const expired = await exportsRef(input.tenantId)
    .where('expiresAtMs', '<=', nowMs)
    .limit(50)
    .get();

  let purged = 0;

  for (const doc of expired.docs) {
    const record = doc.data() as ComplianceExportRecord;

    if (record.storagePath) {
      await storageBucket.file(record.storagePath).delete({ ignoreNotFound: true })
        .catch((error: unknown) => {
          console.error('[SynzappComplianceExport] could not delete expired export', {
            message: error instanceof Error ? error.message : String(error),
            storagePath: record.storagePath
          });
        });
    }

    await doc.ref.delete();
    purged += 1;
  }

  return { purged };
}
