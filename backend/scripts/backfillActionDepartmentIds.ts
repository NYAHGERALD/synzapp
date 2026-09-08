#!/usr/bin/env node
/**
 * Gives every existing action the `departmentIds` field the scoped list queries.
 *
 * Actions written before that field existed have no value for it, so an
 * `array-contains` query would not match them and they would disappear from
 * every department's view. The API already derives the field on read, so what
 * is broken is only what Firestore can *find* — which is exactly what this
 * fixes.
 *
 * Written as a script rather than a route for the same reason as
 * `addStaffMember.mjs`: a migration endpoint is a permanent hole kept open for
 * one day's use. It runs from a machine that already holds project credentials.
 *
 * Safe to run more than once. A record already holding the right value is not
 * written again, so a second run costs reads and no writes, and a run that dies
 * halfway can simply be started over.
 *
 * Usage:
 *   node --import tsx scripts/backfillActionDepartmentIds.ts --dry-run
 *   node --import tsx scripts/backfillActionDepartmentIds.ts
 *   node --import tsx scripts/backfillActionDepartmentIds.ts --tenant <tenantId>
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildActionDepartmentIds,
  hasCurrentDepartmentIds
} from '../src/services/actionScope.js';

/** Firestore's own ceiling for one batched write. */
const BATCH_SIZE = 400;
/** Read in pages so a tenant with a hundred thousand actions still fits memory. */
const PAGE_SIZE = 500;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const tenantArgIndex = args.indexOf('--tenant');
const onlyTenantId = tenantArgIndex >= 0 ? args[tenantArgIndex + 1] : null;

const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId }
  : { projectId });

const firestore = getFirestore();

interface TenantOutcome {
  alreadyCorrect: number;
  scanned: number;
  tenantId: string;
  updated: number;
}

async function backfillTenant(db: Firestore, tenantId: string): Promise<TenantOutcome> {
  const outcome: TenantOutcome = { alreadyCorrect: 0, scanned: 0, tenantId, updated: 0 };
  const actionsRef = db.collection('organizations').doc(tenantId).collection('actions');
  // Ordered by document id rather than a timestamp: ids are always present and
  // always unique, so paging cannot stall on a run of equal values or skip a
  // record whose timestamp is missing.
  let cursor: string | null = null;

  for (;;) {
    let query = actionsRef.orderBy('__name__').limit(PAGE_SIZE);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const page = await query.get();

    if (page.empty) {
      break;
    }

    const batch = db.batch();
    let pendingWrites = 0;

    for (const doc of page.docs) {
      const raw = doc.data() as Record<string, unknown>;

      outcome.scanned += 1;

      const expected = buildActionDepartmentIds({
        responsibleDepartmentId: (raw.responsibleDepartmentId as string) || null,
        sourceDepartmentId: (raw.sourceDepartmentId as string) || null
      });

      if (hasCurrentDepartmentIds(raw.departmentIds, expected)) {
        outcome.alreadyCorrect += 1;
        continue;
      }

      outcome.updated += 1;

      if (!isDryRun) {
        batch.update(doc.ref, { departmentIds: expected });
        pendingWrites += 1;

        if (pendingWrites >= BATCH_SIZE) {
          await batch.commit();
          pendingWrites = 0;
        }
      }
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }

    cursor = page.docs[page.docs.length - 1].id;

    if (page.size < PAGE_SIZE) {
      break;
    }
  }

  return outcome;
}

async function listTenantIds(db: Firestore): Promise<string[]> {
  if (onlyTenantId) {
    return [onlyTenantId];
  }

  // Ids only. Reading whole organization documents to get their names would
  // pull every tenant's settings into memory for no reason.
  const organizations = await db.collection('organizations').select().get();

  return organizations.docs.map((doc) => doc.id);
}

const tenantIds = await listTenantIds(firestore);
const outcomes: TenantOutcome[] = [];

console.log(
  `${isDryRun ? 'Dry run. ' : ''}Backfilling departmentIds across ${tenantIds.length} tenant(s).`
);

for (const tenantId of tenantIds) {
  const outcome = await backfillTenant(firestore, tenantId);

  outcomes.push(outcome);

  if (outcome.scanned > 0) {
    console.log(
      `  ${tenantId}: scanned ${outcome.scanned}, ` +
      `${isDryRun ? 'would update' : 'updated'} ${outcome.updated}, ` +
      `already correct ${outcome.alreadyCorrect}`
    );
  }
}

const totals = outcomes.reduce(
  (sum, outcome) => ({
    alreadyCorrect: sum.alreadyCorrect + outcome.alreadyCorrect,
    scanned: sum.scanned + outcome.scanned,
    updated: sum.updated + outcome.updated
  }),
  { alreadyCorrect: 0, scanned: 0, updated: 0 }
);

console.log(
  `\nScanned ${totals.scanned}. ` +
  `${isDryRun ? 'Would update' : 'Updated'} ${totals.updated}. ` +
  `Already correct ${totals.alreadyCorrect}.`
);

if (isDryRun && totals.updated > 0) {
  console.log('Run again without --dry-run to write these.');
}

process.exit(0);
