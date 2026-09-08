import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/**
 * Removing someone from a company must keep them out.
 *
 * Written because the phone was changed to let a session the server confirms
 * clear a block the device had written about itself. That change is only safe
 * if the server never confirms a removed employee, so this runs the real
 * session builder against real records and checks exactly that.
 *
 * Nothing here reads the source and looks for reassuring words. It seeds an
 * employee, removes them the way the product removes them, and asks the same
 * function the sign-in route asks.
 */

const EMULATOR_PROJECT_ID = 'synzapp-rules-test';
const TENANT_ID = 'tenant_removal_test';
const EMPLOYEE_UID = 'user_removed_employee';
const EMPLOYEE_PHONE = '+15550001234';

let firestore: typeof import('../src/config/firebaseAdmin.js')['firestore'];
let authSession: typeof import('../src/services/authSessionService.js');
let hashPhoneNumber: typeof import('../src/utils/phoneHash.js')['hashPhoneNumber'];

/** A token that was issued before anything happened in these tests. */
function tokenFor(uid: string, issuedSecondsAgo = 3600) {
  return {
    aud: EMULATOR_PROJECT_ID,
    auth_time: Math.floor(Date.now() / 1000) - issuedSecondsAgo,
    exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: { identities: {}, sign_in_provider: 'phone' },
    iat: Math.floor(Date.now() / 1000) - issuedSecondsAgo,
    iss: `https://securetoken.google.com/${EMULATOR_PROJECT_ID}`,
    phone_number: EMPLOYEE_PHONE,
    sub: uid,
    uid
  } as unknown as import('firebase-admin/auth').DecodedIdToken;
}

describe('an employee the company removed', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID ||= EMULATOR_PROJECT_ID;
    process.env.FIREBASE_STORAGE_BUCKET ||= `${EMULATOR_PROJECT_ID}.appspot.com`;

    const admin = await import('../src/config/firebaseAdmin.js');
    firestore = admin.firestore;

    // The active path refreshes the sign-in claims, which needs the account to
    // exist. Without it the control test fails for a reason that has nothing to
    // do with what is being checked.
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth().createUser({ phoneNumber: EMPLOYEE_PHONE, uid: EMPLOYEE_UID }).catch(() => undefined);
    authSession = await import('../src/services/authSessionService.js');
    ({ hashPhoneNumber } = await import('../src/utils/phoneHash.js'));

    for (const path of ['identityDirectory', 'approvedPhoneDirectory']) {
      const docs = await firestore.collection(path).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }

    // An ordinary employee, in good standing.
    await firestore.collection('identityDirectory').doc(EMPLOYEE_UID).set({
      permissions: ['chat.send'],
      profileComplete: true,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT_ID
    });
    await firestore.collection('approvedPhoneDirectory').doc(hashPhoneNumber(EMPLOYEE_PHONE)).set({
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      tenantId: TENANT_ID
    });
  });

  it('is refused after being deactivated', async () => {
    await firestore.collection('identityDirectory').doc(EMPLOYEE_UID).update({
      permissions: [],
      status: 'DEACTIVATED'
    });

    const session = await authSession.buildAuthSession(tokenFor(EMPLOYEE_UID));

    assert.equal(session.access, 'BLOCKED', 'a deactivated employee must not be let in');
    assert.equal(session.nextStep, 'CONTACT_ADMIN');
  });

  it('is refused after being archived or deleted', async () => {
    for (const status of ['ARCHIVED', 'DELETED', 'SUSPENDED']) {
      await firestore.collection('identityDirectory').doc(EMPLOYEE_UID).update({ status });

      const session = await authSession.buildAuthSession(tokenFor(EMPLOYEE_UID));

      assert.equal(session.access, 'BLOCKED', `status ${status} must refuse access`);
    }
  });

  it('is refused while holding a token issued before they were removed', async () => {
    // Revoking access has to beat a token the phone already had in its pocket.
    await firestore.collection('identityDirectory').doc(EMPLOYEE_UID).update({
      authRevokedAt: new Date(),
      status: 'ACTIVE'
    });

    const session = await authSession.buildAuthSession(tokenFor(EMPLOYEE_UID, 7200));

    assert.equal(session.access, 'BLOCKED', 'a token older than the removal must not work');
  });

  it('gets no company back after a permanent delete, even signing in fresh', async () => {
    // A permanent delete removes both records. The person can still reach the
    // app, as any stranger can, but arrives with no organization attached.
    await firestore.collection('identityDirectory').doc(EMPLOYEE_UID).delete();
    await firestore.collection('approvedPhoneDirectory').doc(hashPhoneNumber(EMPLOYEE_PHONE)).delete();

    const session = await authSession.buildAuthSession(tokenFor(EMPLOYEE_UID));

    assert.notEqual(session.access, 'ACTIVE', 'a deleted employee must never come back as active');
    assert.equal(session.user.tenantId, undefined, 'and must carry no company with them');
    assert.deepEqual(session.user.permissions, [], 'and no permissions');
  });

  it('still lets a current employee in, so the checks above mean something', async () => {
    // Without this, every assertion above would pass on a broken build that
    // refused everybody.
    const session = await authSession.buildAuthSession(tokenFor(EMPLOYEE_UID));

    assert.equal(session.access, 'ACTIVE');
    assert.equal(session.user.tenantId, TENANT_ID);
  });
});
