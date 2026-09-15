#!/usr/bin/env node
/**
 * Finds data belonging to organizations that no longer exist.
 *
 * Deleting an organization used to remove `organizations/{tenantId}` and the
 * Storage prefix of the same name, and nothing else. Two things were left:
 *
 *   - `complianceExports/{tenantId}/` in Storage — plain zips of decrypted
 *     message bodies and files, up to four gigabytes each. Their thirty day
 *     purge only ever runs for tenants the nightly sweep can enumerate, and it
 *     enumerates `organizations`, so once the organization document was gone
 *     nothing came back for them. Ever.
 *   - `tenants/{tenantId}` in Firestore — legal holds, disposition items,
 *     export records and retention policies.
 *
 * Both are fixed for future deletions. This is for the ones already gone.
 *
 * READ ONLY, on purpose. It would be easy to delete everything with no matching
 * organization, and wrong: a transient read failure would then destroy a live
 * customer's archive. It prints what it finds and a person decides.
 *
 * Usage:
 *   node scripts/reviewOrphanedTenantData.mjs
 *   node scripts/reviewOrphanedTenantData.mjs --json
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const asJson = process.argv.includes('--json');
const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const storageBucketName = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId, storageBucket: storageBucketName }
  : { projectId, storageBucket: storageBucketName });

const firestore = getFirestore();
const bucket = getStorage().bucket();

/** Every organization that still exists. Anything not in here is an orphan. */
const liveTenantIds = new Set(
  (await firestore.collection('organizations').listDocuments()).map((doc) => doc.id)
);

const orphanedTenantDocs = (await firestore.collection('tenants').listDocuments())
  .map((doc) => doc.id)
  .filter((tenantId) => !liveTenantIds.has(tenantId));

/**
 * Storage prefixes under complianceExports/, with the bytes they hold.
 *
 * Listed rather than counted by prefix, because the size is the part that makes
 * somebody act: "three orphan prefixes" reads as tidying, "eleven gigabytes of
 * readable chat history belonging to companies that left" does not.
 */
const [exportFiles] = await bucket.getFiles({ prefix: 'complianceExports/' });
const orphanedExports = new Map();

exportFiles.forEach((file) => {
  const tenantId = file.name.split('/')[1];

  if (!tenantId || liveTenantIds.has(tenantId)) {
    return;
  }

  const existing = orphanedExports.get(tenantId) || { bytes: 0, files: 0 };

  existing.bytes += Number(file.metadata?.size || 0);
  existing.files += 1;
  orphanedExports.set(tenantId, existing);
});

if (asJson) {
  console.log(JSON.stringify({
    liveTenantCount: liveTenantIds.size,
    orphanedExports: [...orphanedExports.entries()].map(([tenantId, stats]) => ({ tenantId, ...stats })),
    orphanedTenantDocs
  }, null, 2));
  process.exit(0);
}

console.log(`${liveTenantIds.size} organization(s) still exist.`);
console.log('');

if (!orphanedTenantDocs.length && !orphanedExports.size) {
  console.log('Nothing orphaned. Every tenants/ document and export prefix has an organization.');
  process.exit(0);
}

if (orphanedExports.size) {
  console.log('Compliance exports with no organization — decrypted chat history:');
  [...orphanedExports.entries()].forEach(([tenantId, stats]) => {
    const megabytes = (stats.bytes / (1024 * 1024)).toFixed(1);

    console.log(`  complianceExports/${tenantId}/  ${stats.files} file(s), ${megabytes} MB`);
  });
  console.log('');
}

if (orphanedTenantDocs.length) {
  console.log('tenants/ documents with no organization — holds, disposition, policies:');
  orphanedTenantDocs.forEach((tenantId) => console.log(`  tenants/${tenantId}`));
  console.log('');
}

console.log('Nothing has been deleted. Confirm each one belonged to a company that left');
console.log('before removing it — a tenant missing from the list above because a read');
console.log('failed would look exactly the same as one that was offboarded.');
