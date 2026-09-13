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

/**
 * One phone holds chat for an account.
 *
 * The security properties matter more than the happy path here: a claim is a
 * destructive call, so it must not be reachable with a stale token, and it must
 * never be able to name somebody else's handset.
 */
describe('the mobile seat, run against real data', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  const SECOND_PHONE = 'device_new_phone';

  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    devices = await import('../src/services/deviceIdentityService.js');

    // Every case starts with no seat held and no devices registered, so one test
    // cannot decide what the next one sees.
    const organizationRef = firestore.collection('organizations').doc(TENANT);

    await organizationRef.set({ status: 'ACTIVE' }, { merge: true });
    await firestore.collection('identityDirectory').doc(OWNER).set({
      permissions: [],
      profileComplete: true,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });
    await organizationRef.collection('users').doc(OWNER).set({
      displayName: 'Device Owner',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });

    const [ownedDevices, tenantDevices, commands] = await Promise.all([
      organizationRef.collection('users').doc(OWNER).collection('devices').listDocuments(),
      organizationRef.collection('deviceKeys').listDocuments(),
      organizationRef.collection('companyDataWipeCommands').listDocuments()
    ]);

    await Promise.all([
      ...ownedDevices.map((doc) => doc.delete()),
      ...tenantDevices.map((doc) => doc.delete()),
      ...commands.map((doc) => doc.delete())
    ]);
  });

  function registrationInput(deviceId: string, claimFrom?: string) {
    return {
      appInstallationId: `install_${deviceId}`,
      ...(claimFrom ? { claimFromMobileDeviceId: claimFrom } : {}),
      cryptoProvider: 'nacl',
      deviceId,
      identityPublicKey: 'a'.repeat(44),
      keyAgreementPublicKey: 'b'.repeat(44),
      keyVersion: 1,
      platform: 'ios' as const,
      protocolVersion: '1.0',
      signingPublicKey: 'c'.repeat(44)
    };
  }

  function freshToken(uid: string) {
    return {
      auth_time: Math.floor(Date.now() / 1000),
      tenantId: TENANT,
      uid
    } as unknown as import('firebase-admin/auth').DecodedIdToken;
  }

  function staleToken(uid: string) {
    return {
      auth_time: Math.floor((Date.now() - 60 * 60 * 1000) / 1000),
      tenantId: TENANT,
      uid
    } as unknown as import('firebase-admin/auth').DecodedIdToken;
  }

  it('lets the first phone take the seat with no confirmation', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    const identity = await firestore.collection('identityDirectory').doc(OWNER).get();

    assert.equal((identity.data() || {}).activeMobileSeat?.deviceId, CURRENT_DEVICE);
  });

  it('refuses a second phone until it says which one it replaces', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    await assert.rejects(
      () => devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(SECOND_PHONE)),
      (error: Error & { code?: string; details?: { deviceId?: string } }) => {
        assert.equal(error.code, 'MOBILE_SEAT_HELD');
        assert.equal(error.details?.deviceId, CURRENT_DEVICE);

        return true;
      }
    );
  });

  it('moves the seat and revokes the old phone once confirmed', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(SECOND_PHONE, CURRENT_DEVICE)
    );

    const identity = await firestore.collection('identityDirectory').doc(OWNER).get();

    assert.equal((identity.data() || {}).activeMobileSeat?.deviceId, SECOND_PHONE);
    assert.deepEqual(await readStatuses(CURRENT_DEVICE), {
      tenant: 'REVOKED',
      user: 'REVOKED'
    });
  });

  it('orders the displaced phone to wipe itself', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(SECOND_PHONE, CURRENT_DEVICE)
    );

    const commands = await firestore
      .collection('organizations').doc(TENANT)
      .collection('companyDataWipeCommands')
      .where('deviceId', '==', CURRENT_DEVICE)
      .get();

    assert.equal(commands.size, 1);
  });

  it('refuses a claim made with a stale sign-in', async () => {
    // A token outlives a session in the keychain. Without this, anybody holding
    // a lifted one could evict the real user and order their handset wiped.
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    await assert.rejects(
      () => devices.registerDeviceIdentity(
        staleToken(OWNER),
        registrationInput(SECOND_PHONE, CURRENT_DEVICE)
      ),
      /verify your phone number again/i
    );

    assert.deepEqual(await readStatuses(CURRENT_DEVICE), {
      tenant: 'ACTIVE',
      user: 'ACTIVE'
    });
  });

  it('cannot be pointed at a colleague’s phone', async () => {
    // Any active member can read deviceKeys and learn a colleague's device id.
    // Naming one here must revoke nothing.
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    await firestore.collection('identityDirectory').doc('user_colleague').set({
      permissions: [],
      profileComplete: true,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });
    await firestore.collection('organizations').doc(TENANT)
      .collection('users').doc('user_colleague')
      .set({ displayName: 'Colleague', role: 'EMPLOYEE', status: 'ACTIVE', tenantId: TENANT });

    await assert.rejects(
      () => devices.registerDeviceIdentity(
        freshToken('user_colleague'),
        registrationInput('device_colleague_phone', CURRENT_DEVICE)
      ),
      /already registered|not authorized|another phone/i
    );

    assert.deepEqual(await readStatuses(CURRENT_DEVICE), {
      tenant: 'ACTIVE',
      user: 'ACTIVE'
    });
  });

  it('re-registering the same phone keeps its own seat', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    const identity = await firestore.collection('identityDirectory').doc(OWNER).get();

    assert.equal((identity.data() || {}).activeMobileSeat?.deviceId, CURRENT_DEVICE);
  });
});

/**
 * Moving chat away must never lock the old phone out for good.
 *
 * It did. A revoked device may only re-register if the rule recognises why it
 * was revoked, and that rule matches the *wording* of the reason. The seat move
 * wrote a reason that said something true and matched nothing, so somebody who
 * moved chat to a new phone could never go back — the old one answered "this
 * device is not authorized" for ever.
 */
describe('coming back to a phone chat was moved away from', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  const OTHER_PHONE = 'device_other_phone';

  function registrationInput(deviceId: string, claimFrom?: string) {
    return {
      appInstallationId: `install_${deviceId}`,
      ...(claimFrom ? { claimFromMobileDeviceId: claimFrom } : {}),
      cryptoProvider: 'nacl',
      deviceId,
      identityPublicKey: 'a'.repeat(44),
      keyAgreementPublicKey: 'b'.repeat(44),
      keyVersion: 1,
      platform: 'android' as const,
      protocolVersion: '1.0',
      signingPublicKey: 'c'.repeat(44)
    };
  }

  function freshToken(uid: string) {
    return {
      auth_time: Math.floor(Date.now() / 1000),
      tenantId: TENANT,
      uid
    } as unknown as import('firebase-admin/auth').DecodedIdToken;
  }

  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;
    devices = await import('../src/services/deviceIdentityService.js');

    const organizationRef = firestore.collection('organizations').doc(TENANT);

    await organizationRef.set({ status: 'ACTIVE' }, { merge: true });
    await firestore.collection('identityDirectory').doc(OWNER).set({
      permissions: [],
      profileComplete: true,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });
    await organizationRef.collection('users').doc(OWNER).set({
      displayName: 'Device Owner',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT
    });

    const [ownedDevices, tenantDevices] = await Promise.all([
      organizationRef.collection('users').doc(OWNER).collection('devices').listDocuments(),
      organizationRef.collection('deviceKeys').listDocuments()
    ]);

    await Promise.all([
      ...ownedDevices.map((doc) => doc.delete()),
      ...tenantDevices.map((doc) => doc.delete())
    ]);
  });

  it('lets the first phone take chat back', async () => {
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(OTHER_PHONE, CURRENT_DEVICE)
    );

    // The old phone is revoked at this point. Going back to it must work.
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(CURRENT_DEVICE, OTHER_PHONE)
    );

    const identity = await firestore.collection('identityDirectory').doc(OWNER).get();

    assert.equal((identity.data() || {}).activeMobileSeat?.deviceId, CURRENT_DEVICE);
    assert.deepEqual(await readStatuses(CURRENT_DEVICE), {
      tenant: 'ACTIVE',
      user: 'ACTIVE'
    });
  });

  it('clears the revocation marks when it comes back', async () => {
    // A record that is ACTIVE and still carries why it was revoked reads as two
    // contradictory things, and the next rule to consult it would get it wrong.
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(OTHER_PHONE, CURRENT_DEVICE)
    );
    await devices.registerDeviceIdentity(
      freshToken(OWNER),
      registrationInput(CURRENT_DEVICE, OTHER_PHONE)
    );

    const device = await firestore
      .collection('organizations').doc(TENANT)
      .collection('deviceKeys').doc(CURRENT_DEVICE)
      .get();
    const record = device.data() || {};

    assert.equal(record.status, 'ACTIVE');
    assert.equal(record.revocationCode, null);
    assert.equal(record.revocationReason, null);
  });

  it('still refuses a phone an administrator revoked', async () => {
    // Only a seat move is reversible by the person. An administrator signing a
    // phone out must not be undone by signing in on it again.
    await devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE));

    const organizationRef = firestore.collection('organizations').doc(TENANT);
    const revoked = {
      revocationReason: 'Signed out by an administrator',
      status: 'REVOKED'
    };

    await Promise.all([
      organizationRef.collection('deviceKeys').doc(CURRENT_DEVICE).set(revoked, { merge: true }),
      organizationRef.collection('users').doc(OWNER).collection('devices').doc(CURRENT_DEVICE)
        .set(revoked, { merge: true })
    ]);

    await assert.rejects(
      () => devices.registerDeviceIdentity(freshToken(OWNER), registrationInput(CURRENT_DEVICE)),
      /not authorized/i
    );
  });
});
