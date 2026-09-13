import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/**
 * Revoking a device, run for real against a Firestore emulator.
 *
 * Two things are checked that source-reading cannot settle: that a revoke
 * finishes even when the device's two mirrored documents disagree, and that it
 * leaves behind the order telling the handset to destroy its copy of company
 * data.
 *
 * Both were shipped defects. A device revoked in one copy and active in the
 * other could never be finished off, because the revoke returned early if
 * *either* copy was already revoked — and the copies do drift, since dormancy
 * retirement and push-token cleanup write them separately. Meanwhile only the
 * admin path ever wrote a wipe order, so revoking your own lost phone left
 * everything on it readable.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT = 'tenant_device_revoke';
const OWNER = 'user_device_owner';

const CURRENT_DEVICE = 'device_in_hand';
const TARGET_DEVICE = 'device_left_behind';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let devices: typeof import('../src/services/deviceIdentityService.js');

function tokenFor(uid: string) {
  return { tenantId: TENANT, uid } as unknown as import('firebase-admin/auth').DecodedIdToken;
}

function deviceRecord(deviceId: string, status: string) {
  return {
    cryptoProvider: 'nacl',
    deviceId,
    keyVersion: 1,
    platform: 'ios',
    protocolVersion: '1',
    status,
    tenantId: TENANT,
    uid: OWNER
  };
}

async function seedDevice(deviceId: string, input: { tenantStatus: string; userStatus: string }) {
  const organizationRef = firestore.collection('organizations').doc(TENANT);

  await Promise.all([
    organizationRef.collection('deviceKeys').doc(deviceId)
      .set(deviceRecord(deviceId, input.tenantStatus)),
    organizationRef.collection('users').doc(OWNER).collection('devices').doc(deviceId)
      .set(deviceRecord(deviceId, input.userStatus))
  ]);
}

async function readStatuses(deviceId: string) {
  const organizationRef = firestore.collection('organizations').doc(TENANT);
  const [tenantSnapshot, userSnapshot] = await Promise.all([
    organizationRef.collection('deviceKeys').doc(deviceId).get(),
    organizationRef.collection('users').doc(OWNER).collection('devices').doc(deviceId).get()
  ]);

  return {
    tenant: (tenantSnapshot.data() || {}).status,
    user: (userSnapshot.data() || {}).status
  };
}

describe('revoking a device, run against real data', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    devices = await import('../src/services/deviceIdentityService.js');

    await firestore.collection('identityDirectory').doc(OWNER).set({
      permissions: [],
      profileComplete: true,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });
    await firestore.collection('organizations').doc(TENANT).collection('users').doc(OWNER).set({
      displayName: 'Device Owner',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });

    const commands = await firestore
      .collection('organizations').doc(TENANT)
      .collection('companyDataWipeCommands')
      .listDocuments();

    await Promise.all(commands.map((doc) => doc.delete()));
  });

  it('finishes a revoke when the two copies disagree', async () => {
    // The drift case: already revoked tenant-side, still active for the user.
    await seedDevice(CURRENT_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'ACTIVE' });
    await seedDevice(TARGET_DEVICE, { tenantStatus: 'REVOKED', userStatus: 'ACTIVE' });

    await devices.revokeCurrentUserDevice(tokenFor(OWNER), TARGET_DEVICE, CURRENT_DEVICE);

    assert.deepEqual(await readStatuses(TARGET_DEVICE), {
      tenant: 'REVOKED',
      user: 'REVOKED'
    });
  });

  it('finishes a revoke when the drift is the other way round', async () => {
    await seedDevice(CURRENT_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'ACTIVE' });
    await seedDevice(TARGET_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'REVOKED' });

    await devices.revokeCurrentUserDevice(tokenFor(OWNER), TARGET_DEVICE, CURRENT_DEVICE);

    assert.deepEqual(await readStatuses(TARGET_DEVICE), {
      tenant: 'REVOKED',
      user: 'REVOKED'
    });
  });

  it('leaves a wipe order for the revoked handset', async () => {
    await seedDevice(CURRENT_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'ACTIVE' });
    await seedDevice(TARGET_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'ACTIVE' });

    await devices.revokeCurrentUserDevice(tokenFor(OWNER), TARGET_DEVICE, CURRENT_DEVICE);

    const commands = await firestore
      .collection('organizations').doc(TENANT)
      .collection('companyDataWipeCommands')
      .where('deviceId', '==', TARGET_DEVICE)
      .get();

    assert.equal(commands.size, 1, 'Revoking a device must order it to wipe itself.');
    assert.equal(commands.docs[0].data().uid, OWNER);
  });

  it('still reads as owned once revoked, so it can collect that order', async () => {
    await seedDevice(TARGET_DEVICE, { tenantStatus: 'REVOKED', userStatus: 'REVOKED' });

    const owned = await devices.verifyOwnedRegisteredDevice(tokenFor(OWNER), TARGET_DEVICE);

    assert.equal(owned.deviceId, TARGET_DEVICE);
    assert.equal(owned.status, 'REVOKED');
  });

  it('refuses a device belonging to somebody else', async () => {
    await seedDevice(TARGET_DEVICE, { tenantStatus: 'ACTIVE', userStatus: 'ACTIVE' });

    await assert.rejects(
      () => devices.verifyOwnedRegisteredDevice(tokenFor('user_somebody_else'), TARGET_DEVICE),
      /not authorized/i
    );
  });
});
