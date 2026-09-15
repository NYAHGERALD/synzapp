#!/usr/bin/env node
/**
 * Lists every organization admin, so each one can be confirmed as intended.
 *
 * Until now the only way a tenant could gain a second organization admin was
 * to invite somebody into a department named "Human Resources", which granted
 * all ten admin permissions silently and overrode the role the admin had
 * picked. Renaming any department to that name turned it on, and a department
 * admin of HR could do it without limit.
 *
 * That path is closed. This answers the question it leaves behind: who already
 * holds admin, and did anybody mean to give it to them? The invite audit event
 * cannot answer it — it recorded the role that was *discarded*, so an account
 * escalated this way reads as "invited as Forklift Operator".
 *
 * READ ONLY. It opens no transaction and writes nothing, on purpose: deciding
 * what to do about a particular account is a judgement, not a sweep.
 *
 * Three places have to agree, because they are all read back into a person's
 * claims on their next profile request. A record that appears in one list and
 * not another is worth looking at on its own.
 *
 * Usage:
 *   node scripts/reviewOrgAdmins.mjs
 *   node scripts/reviewOrgAdmins.mjs --json
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const asJson = process.argv.includes('--json');
const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId }
  : { projectId });

const firestore = getFirestore();

/** The global directory, which is what a new sign-in is matched against. */
async function readDirectoryAdmins() {
  const snapshot = await firestore
    .collection('approvedPhoneDirectory')
    .where('role', '==', 'ORG_ADMIN')
    .get();

  return snapshot.docs.map((doc) => {
    const record = doc.data();

    return {
      approvedPhoneId: doc.id,
      departmentId: record.departmentId || null,
      invitedBy: record.invitedBy || null,
      phoneLast4: record.phoneLast4 || null,
      roleId: record.roleId || null,
      source: 'approvedPhoneDirectory',
      status: record.status || null,
      tenantId: record.tenantId || null
    };
  });
}

/**
 * The per-tenant copies. Collection-group rather than a walk over tenants, so
 * an admin sitting under an organization that no longer lists them still shows.
 */
async function readApprovedPhoneAdmins() {
  const snapshot = await firestore
    .collectionGroup('approvedPhones')
    .where('role', '==', 'ORG_ADMIN')
    .get();

  return snapshot.docs.map((doc) => {
    const record = doc.data();

    return {
      approvedPhoneId: doc.id,
      departmentId: record.departmentId || null,
      departmentName: record.departmentName || null,
      displayName: record.displayName || null,
      invitedBy: record.invitedBy || null,
      roleId: record.roleId || null,
      roleName: record.roleName || null,
      source: 'approvedPhones',
      status: record.status || null,
      tenantId: record.tenantId || null
    };
  });
}

/** The live accounts. These are the ones actually carrying admin claims today. */
async function readTenantUserAdmins() {
  const snapshot = await firestore
    .collectionGroup('users')
    .where('role', '==', 'ORG_ADMIN')
    .get();

  return snapshot.docs.map((doc) => {
    const record = doc.data();

    return {
      departmentId: record.departmentId || null,
      displayName: record.displayName || null,
      source: 'users',
      status: record.status || null,
      tenantId: record.tenantId || null,
      uid: doc.id
    };
  });
}

function groupByTenant(rows) {
  const byTenant = new Map();

  rows.forEach((row) => {
    const tenantId = row.tenantId || '(no tenant)';
    const existing = byTenant.get(tenantId) || [];

    existing.push(row);
    byTenant.set(tenantId, existing);
  });

  return byTenant;
}

/**
 * Anything carrying SYSTEM_ADMIN.
 *
 * Nothing in the product assigns that role, and a session presenting it is now
 * refused — so this should return nothing. If it does not, those accounts lose
 * access on the next deploy and somebody needs to know before it happens rather
 * than after.
 */
async function readSystemAdmins() {
  const [users, approvedPhones, directory] = await Promise.all([
    firestore.collectionGroup('users').where('role', '==', 'SYSTEM_ADMIN').get().catch(() => null),
    firestore.collectionGroup('approvedPhones').where('role', '==', 'SYSTEM_ADMIN').get().catch(() => null),
    firestore.collection('approvedPhoneDirectory').where('role', '==', 'SYSTEM_ADMIN').get().catch(() => null)
  ]);

  return [
    ...(users?.docs || []).map((doc) => ({ path: doc.ref.path, source: 'users' })),
    ...(approvedPhones?.docs || []).map((doc) => ({ path: doc.ref.path, source: 'approvedPhones' })),
    ...(directory?.docs || []).map((doc) => ({ path: doc.ref.path, source: 'approvedPhoneDirectory' }))
  ];
}

const systemAdmins = await readSystemAdmins();

const [directoryAdmins, approvedPhoneAdmins, tenantUserAdmins] = await Promise.all([
  readDirectoryAdmins(),
  readApprovedPhoneAdmins(),
  readTenantUserAdmins()
]);

if (asJson) {
  console.log(JSON.stringify({
    approvedPhoneAdmins,
    directoryAdmins,
    systemAdmins,
    tenantUserAdmins
  }, null, 2));
  process.exit(0);
}

const allRows = [...directoryAdmins, ...approvedPhoneAdmins, ...tenantUserAdmins];
const byTenant = groupByTenant(allRows);

console.log(`Organization admins across ${byTenant.size} tenant(s)`);
console.log(`  approvedPhoneDirectory: ${directoryAdmins.length}`);
console.log(`  approvedPhones:         ${approvedPhoneAdmins.length}`);
console.log(`  users (live accounts):  ${tenantUserAdmins.length}`);
console.log('');

[...byTenant.keys()].sort().forEach((tenantId) => {
  const rows = byTenant.get(tenantId) || [];

  console.log(`${tenantId}`);

  rows.forEach((row) => {
    const who = row.displayName || row.uid || row.approvedPhoneId;
    const where = row.departmentName || row.departmentId || 'no department';
    const invited = row.invitedBy ? ` invitedBy=${row.invitedBy}` : '';
    const asRole = row.roleName ? ` roleName="${row.roleName}"` : '';

    console.log(`  [${row.source}] ${who} status=${row.status || 'unknown'} dept=${where}${asRole}${invited}`);
  });

  console.log('');
});

console.log('Confirm each one was intended. An admin whose roleName is an ordinary');
console.log('job title was almost certainly escalated by the Human Resources rule.');
console.log('');

if (systemAdmins.length) {
  console.log(`WARNING: ${systemAdmins.length} record(s) carry SYSTEM_ADMIN.`);
  systemAdmins.forEach((record) => console.log(`  [${record.source}] ${record.path}`));
  console.log('');
  console.log('Nothing in the product assigns that role, and a session presenting it is');
  console.log('now refused. These accounts will lose access on the next deploy. Work out');
  console.log('how they came to hold it before deploying, not after.');
} else {
  console.log('No record carries SYSTEM_ADMIN, which is what should be true.');
}
