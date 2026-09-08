#!/usr/bin/env node
/**
 * Puts somebody on the Synzapp staff list.
 *
 * Exists because the staff gate has no way in on its own: access requires a
 * record on the list, and nothing creates the first record. Rather than adding
 * a bootstrap route — a permanent hole kept open for one day's use — the first
 * entries are made from a machine that already holds project credentials.
 *
 * The person must sign in once first. Google creates their account at that
 * moment; their attempt is refused, and this then admits them.
 *
 * Usage:
 *   node scripts/addStaffMember.mjs someone@synzapp.com ADMIN
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [, , emailArg, roleArg = 'SUPPORT'] = process.argv;
const email = (emailArg || '').trim().toLowerCase();
const role = roleArg === 'ADMIN' ? 'ADMIN' : 'SUPPORT';

if (!email) {
  console.error('Usage: node scripts/addStaffMember.mjs <email> [ADMIN|SUPPORT]');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId }
  : { projectId });

const auth = getAuth();
const firestore = getFirestore();

try {
  const user = await auth.getUserByEmail(email);

  await firestore.collection('synzappStaff').doc(user.uid).set({
    createdAtMs: Date.now(),
    displayName: user.displayName || email,
    email,
    role,
    status: 'ACTIVE',
    uid: user.uid
  }, { merge: true });

  console.log(`Added ${email} as ${role}. They can sign in now.`);
} catch (error) {
  if (error?.code === 'auth/user-not-found') {
    console.error(
      `No account yet for ${email}.\n`
      + 'Ask them to open the staff console and sign in with Google once. Their\n'
      + 'attempt will be refused, which is expected — it creates the account.\n'
      + 'Then run this again.'
    );
    process.exit(2);
  }

  console.error('Could not add staff member:', error?.message || error);
  process.exit(1);
}
