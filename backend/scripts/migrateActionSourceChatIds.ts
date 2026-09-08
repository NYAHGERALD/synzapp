#!/usr/bin/env node
/**
 * Moves existing actions onto the canonical conversation id.
 *
 * A direct chat's `sourceChatId` used to be stored as one participant's uid,
 * which meant naming somebody else's uid read the actions of their
 * conversations with other people. The id is now built from both people, so
 * records written before that change no longer match the queries that find
 * them.
 *
 * A group action keeps its id: a group is already named by something nobody can
 * derive their way into. Only direct chats move.
 *
 * Safe to run more than once: a record already canonical is skipped.
 *
 * Usage:
 *   node --import tsx scripts/migrateActionSourceChatIds.ts --dry-run
 *   node --import tsx scripts/migrateActionSourceChatIds.ts
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildDirectChatId,
  isCanonicalDirectChatId
} from '../src/services/conversationIdentity.js';

const isDryRun = process.argv.includes('--dry-run');
const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId }
  : { projectId });

const firestore = getFirestore();

async function isGroupId(db: Firestore, tenantId: string, id: string): Promise<boolean> {
  const snapshot = await db
    .collection('organizations').doc(tenantId)
    .collection('groups').doc(id)
    .get()
    .catch(() => null);

  return Boolean(snapshot?.exists);
}

const organizations = await firestore.collection('organizations').select().get();
let scanned = 0;
let migrated = 0;
let alreadyCanonical = 0;
let groups = 0;

for (const org of organizations.docs) {
  const actions = await firestore
    .collection('organizations').doc(org.id)
    .collection('actions')
    .get();

  for (const doc of actions.docs) {
    const raw = doc.data() as Record<string, unknown>;
    const sourceChatId = String(raw.sourceChatId || '');
    const createdByUid = String(raw.createdByUid || '');

    scanned += 1;

    if (!sourceChatId || !createdByUid) {
      continue;
    }

    if (isCanonicalDirectChatId(sourceChatId)) {
      alreadyCanonical += 1;
      continue;
    }

    // A group keeps its own id. Checked rather than guessed from the shape,
    // because a uid and a group id look alike.
    if (await isGroupId(firestore, org.id, sourceChatId)) {
      groups += 1;
      continue;
    }

    const canonical = buildDirectChatId(createdByUid, sourceChatId);

    migrated += 1;

    if (!isDryRun) {
      await doc.ref.update({
        sourceChatId: canonical,
        sourceChatType: 'DIRECT'
      });
    }

    console.log(
      `  ${org.id.slice(0, 18)} ${doc.id.slice(0, 8)}: ` +
      `${sourceChatId.slice(0, 12)} -> ${canonical.slice(0, 20)}…`
    );
  }
}

console.log(
  `\nScanned ${scanned}. ${isDryRun ? 'Would move' : 'Moved'} ${migrated} direct. ` +
  `Left ${groups} group and ${alreadyCanonical} already canonical.`
);

process.exit(0);
