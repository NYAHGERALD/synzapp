import { firestore } from '../config/firebaseAdmin.js';
import { readArchivedEnvelopes, type ArchivedEnvelope } from './archiveReaderService.js';
import { listLegalHolds } from './legalHoldService.js';

/**
 * Search across an organization's preserved conversations.
 *
 * A legal hold preserves content, which is only half of what a legal obligation
 * requires: the content then has to be found and produced. This is the finding
 * half — by person, by date, by conversation — and the export service reuses it
 * so that what an administrator previews is exactly what they receive.
 *
 * **Messages that cannot be read are returned, not dropped.** A search that
 * silently omits unreadable messages tells an administrator a period is empty
 * when it is not, and they would then swear to that. Every hit carries either
 * text or the reason there is none.
 *
 * Scope note: this file reads chat conversations only. It does not touch the
 * interpreter or any other part of Synzapp.
 */

const MAX_CONVERSATIONS_SCANNED = 500;
const MAX_ENVELOPES_PER_CONVERSATION = 2000;
const DEFAULT_HIT_LIMIT = 200;
const MAX_HIT_LIMIT = 5000;

export interface ArchivedMessageMedia {
  chunkSizeBytes?: number;
  contentType: string;
  encryptionMode?: string;
  fileName: string;
  key?: string;
  kind: string;
  mediaId: string;
  nonce?: string;
  partCount?: number;
  partNonces?: string[];
  sizeBytes: number;
}

export interface ArchivedMessage {
  conversationId: string;
  conversationKind: 'DIRECT' | 'GROUP';
  envelopeId: string;
  media: ArchivedMessageMedia[];
  /** Null when the message could not be read; `unreadableReason` says why. */
  text: string | null;
  recipientUid: string | null;
  senderUid: string;
  sentAtMs: number;
  unreadableReason: 'NOT_ARCHIVED' | 'NO_ARCHIVE_KEY' | 'DECRYPT_FAILED' | null;
}

export interface ArchiveSearchCriteria {
  conversationIds?: string[];
  custodianUids?: string[];
  fromMs?: number | null;
  holdId?: string | null;
  limit?: number;
  /** Case-insensitive text match, applied after messages are unscrambled. */
  text?: string | null;
  toMs?: number | null;
}

export interface ArchiveSearchResult {
  /**
   * Conversations where the per-conversation cap was reached.
   *
   * Reported rather than hidden: a busy conversation can hold more messages
   * than one search reads, and an administrator producing records for a court
   * has to know that this particular chat was only partly examined.
   */
  cappedConversationIds: string[];
  hits: ArchivedMessage[];
  scannedConversations: number;
  /** True when the limit cut the results short, so the caller can widen or page. */
  truncated: boolean;
}

export async function searchArchivedMessages(input: ArchiveSearchCriteria & {
  tenantId: string;
}): Promise<ArchiveSearchResult> {
  const limit = Math.min(Math.max(input.limit || DEFAULT_HIT_LIMIT, 1), MAX_HIT_LIMIT);
  const custodianUids = await resolveCustodians(input);
  const conversationFilter = new Set((input.conversationIds || []).filter(Boolean));
  const conversations = await listConversations(input.tenantId);

  const cappedConversationIds: string[] = [];
  const gathered: { conversation: ConversationRef; envelope: StoredEnvelope }[] = [];
  let scannedConversations = 0;

  for (const conversation of conversations) {
    if (conversationFilter.size && !conversationFilter.has(conversation.id)) {
      continue;
    }

    scannedConversations += 1;

    const { capped, envelopes } = await readConversationEnvelopes({
      conversation,
      fromMs: input.fromMs ?? null,
      tenantId: input.tenantId,
      toMs: input.toMs ?? null
    });

    if (capped) {
      cappedConversationIds.push(conversation.id);
    }

    // Membership decides custodian matching for a group: a person is produced
    // everything sent to a group they belong to, not only what they sent in it.
    // Matching on the sender alone would omit every message a custodian
    // received there, which under a legal hold is an under-production.
    const custodianIsMember = conversation.kind === 'GROUP'
      && custodianUids.size > 0
      && await groupIncludesCustodian({
        conversationId: conversation.id,
        custodianUids,
        tenantId: input.tenantId
      });

    for (const envelope of envelopes) {
      if (matchesCustodian(envelope, custodianUids) || custodianIsMember) {
        gathered.push({ conversation, envelope });
      }
    }
  }

  // Newest first while trimming, so a capped search keeps recent messages
  // rather than whatever happened to be read first.
  gathered.sort((left, right) => (right.envelope.sentAtMs || 0) - (left.envelope.sentAtMs || 0));

  // One decryption pass for the whole search. Decrypting per conversation
  // unwrapped the organization's key once per chat, which is slow and fills
  // Google's key audit log with one entry per conversation for a single
  // question an administrator asked once.
  const decrypted = await readArchivedEnvelopes({
    envelopes: gathered.map((item) => toArchivedEnvelope(item.envelope)),
    tenantId: input.tenantId
  });

  const hits: ArchivedMessage[] = [];
  let truncated = false;

  for (let index = 0; index < gathered.length; index += 1) {
    if (hits.length >= limit) {
      truncated = true;
      break;
    }

    const message = toArchivedMessage(
      gathered[index].conversation,
      gathered[index].envelope,
      decrypted[index]
    );

    if (!matchesText(message, input.text)) {
      continue;
    }

    hits.push(message);
  }

  hits.sort((left, right) => left.sentAtMs - right.sentAtMs);

  return { cappedConversationIds, hits, scannedConversations, truncated };
}

/** Whether any custodian belongs to a group, so its messages are theirs too. */
async function groupIncludesCustodian(input: {
  conversationId: string;
  custodianUids: Set<string>;
  tenantId: string;
}): Promise<boolean> {
  const members = await firestore
    .collection('organizations')
    .doc(input.tenantId)
    .collection('groups')
    .doc(input.conversationId)
    .collection('members')
    .get()
    .catch(() => null);

  if (!members) {
    return false;
  }

  return members.docs.some((doc) => input.custodianUids.has(doc.id));
}

/**
 * Which people the search covers.
 *
 * Searching "across a hold" means the hold decides the custodians, so naming a
 * hold restricts the search to the people it preserves. A hold with no named
 * custodians covers everyone, which is how it is stored and how it must read
 * here — treating an empty list as "nobody" would return an empty result for
 * an organization-wide hold, the exact case where completeness matters most.
 */
async function resolveCustodians(input: ArchiveSearchCriteria & { tenantId: string }): Promise<Set<string>> {
  const requested = new Set((input.custodianUids || []).filter(Boolean));

  if (!input.holdId) {
    return requested;
  }

  const holds = await listLegalHolds(input.tenantId);
  const hold = holds.find((candidate) => candidate.id === input.holdId);

  if (!hold) {
    return requested;
  }

  const holdCustodians = new Set((hold.custodianUids || []).filter(Boolean));

  if (!holdCustodians.size) {
    return requested;
  }

  if (!requested.size) {
    return holdCustodians;
  }

  // Both were named, so the search is the overlap: a custodian outside the hold
  // is not preserved by it and must not be produced under its authority.
  return new Set(Array.from(requested).filter((uid) => holdCustodians.has(uid)));
}

interface ConversationRef {
  id: string;
  kind: 'DIRECT' | 'GROUP';
}

async function listConversations(tenantId: string): Promise<ConversationRef[]> {
  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const [directChats, groups] = await Promise.all([
    organizationRef.collection('directChats').limit(MAX_CONVERSATIONS_SCANNED).get(),
    organizationRef.collection('groups').limit(MAX_CONVERSATIONS_SCANNED).get()
  ]);

  return [
    ...directChats.docs.map((doc) => ({ id: doc.id, kind: 'DIRECT' as const })),
    ...groups.docs.map((doc) => ({ id: doc.id, kind: 'GROUP' as const }))
  ];
}

interface StoredEnvelope {
  ciphertext?: string;
  encryptedKeysByDevice?: Record<string, string>;
  envelopeId?: string;
  nonce?: string;
  recipientUid?: string;
  senderKeyAgreementPublicKey?: string;
  senderUid?: string;
  sentAtMs?: number;
}

async function readConversationEnvelopes(input: {
  conversation: ConversationRef;
  fromMs: number | null;
  tenantId: string;
  toMs: number | null;
}): Promise<{ capped: boolean; envelopes: StoredEnvelope[] }> {
  const organizationRef = firestore.collection('organizations').doc(input.tenantId);
  const chatRef = input.conversation.kind === 'GROUP'
    ? organizationRef.collection('groups').doc(input.conversation.id)
    : organizationRef.collection('directChats').doc(input.conversation.id);

  // Newest first. Reading oldest-first meant a conversation with more messages
  // than the cap returned only its earliest ones, so recent messages — usually
  // the ones being asked about — were invisible and nothing said so.
  let query = chatRef.collection('encryptedEnvelopes').orderBy('sentAtMs', 'desc');

  if (input.fromMs !== null) {
    query = query.where('sentAtMs', '>=', input.fromMs);
  }

  if (input.toMs !== null) {
    query = query.where('sentAtMs', '<=', input.toMs);
  }

  const snapshot = await query.limit(MAX_ENVELOPES_PER_CONVERSATION).get();

  return {
    capped: snapshot.size >= MAX_ENVELOPES_PER_CONVERSATION,
    envelopes: snapshot.docs.map((doc) => ({
      ...(doc.data() as StoredEnvelope),
      envelopeId: doc.id
    }))
  };
}

function matchesCustodian(envelope: StoredEnvelope, custodianUids: Set<string>): boolean {
  if (!custodianUids.size) {
    return true;
  }

  // Either end of a conversation makes it that person's record, so a search for
  // one custodian returns what they were sent as well as what they sent.
  return custodianUids.has(envelope.senderUid || '')
    || custodianUids.has(envelope.recipientUid || '');
}

function matchesText(message: ArchivedMessage, text?: string | null): boolean {
  const needle = (text || '').trim().toLowerCase();

  if (!needle) {
    return true;
  }

  // An unreadable message is kept in the results whatever the search text is.
  // It might be the one that matters, and reporting it as "not matching" would
  // be a claim nobody is in a position to make.
  if (message.text === null) {
    return true;
  }

  return message.text.toLowerCase().includes(needle);
}

function toArchivedEnvelope(envelope: StoredEnvelope): ArchivedEnvelope {
  return {
    ciphertext: envelope.ciphertext || '',
    encryptedKeysByDevice: envelope.encryptedKeysByDevice,
    envelopeId: envelope.envelopeId || '',
    nonce: envelope.nonce || '',
    senderKeyAgreementPublicKey: envelope.senderKeyAgreementPublicKey,
    senderUid: envelope.senderUid,
    sentAtMs: envelope.sentAtMs
  };
}

function toArchivedMessage(
  conversation: ConversationRef,
  envelope: StoredEnvelope,
  read: { plaintext: string | null; unreadableReason: ArchivedMessage['unreadableReason'] }
): ArchivedMessage {
  const payload = read.plaintext ? parsePayload(read.plaintext) : null;

  return {
    conversationId: conversation.id,
    conversationKind: conversation.kind,
    envelopeId: envelope.envelopeId || '',
    media: payload ? extractMedia(payload) : [],
    recipientUid: envelope.recipientUid || null,
    senderUid: envelope.senderUid || '',
    sentAtMs: envelope.sentAtMs || 0,
    text: payload ? String(payload.text || '') : null,
    unreadableReason: read.unreadableReason
  };
}

interface DecryptedPayload {
  image?: Record<string, unknown>;
  media?: Record<string, unknown>;
  mediaItems?: Record<string, unknown>[];
  text?: unknown;
}

function parsePayload(plaintext: string): DecryptedPayload | null {
  try {
    const parsed = JSON.parse(plaintext) as DecryptedPayload;

    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractMedia(payload: DecryptedPayload): ArchivedMessageMedia[] {
  const candidates = [
    ...(payload.media ? [payload.media] : []),
    ...(payload.image ? [payload.image] : []),
    ...(Array.isArray(payload.mediaItems) ? payload.mediaItems : [])
  ];

  return candidates
    .map(toArchivedMessageMedia)
    .filter((media): media is ArchivedMessageMedia => media !== null);
}

function toArchivedMessageMedia(value: Record<string, unknown>): ArchivedMessageMedia | null {
  const mediaId = typeof value.mediaId === 'string' ? value.mediaId.trim() : '';

  if (!mediaId) {
    return null;
  }

  return {
    chunkSizeBytes: typeof value.chunkSizeBytes === 'number' ? value.chunkSizeBytes : undefined,
    contentType: typeof value.contentType === 'string' ? value.contentType : 'application/octet-stream',
    encryptionMode: typeof value.encryptionMode === 'string' ? value.encryptionMode : undefined,
    fileName: typeof value.fileName === 'string' && value.fileName.trim() ? value.fileName.trim() : mediaId,
    key: typeof value.key === 'string' ? value.key : undefined,
    kind: typeof value.kind === 'string' ? value.kind : 'file',
    mediaId,
    nonce: typeof value.nonce === 'string' ? value.nonce : undefined,
    partCount: typeof value.partCount === 'number' ? value.partCount : undefined,
    partNonces: Array.isArray(value.partNonces)
      ? value.partNonces.filter((nonce): nonce is string => typeof nonce === 'string')
      : undefined,
    sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0
  };
}
