#!/usr/bin/env node
/**
 * Loads the prepared privacy and terms text as drafts.
 *
 * Drafts, never published. Publishing is a legal act — it fixes the document
 * the company is held to — and it belongs to a person who has read the text and
 * decided, not to a script.
 *
 * Run again to replace the current drafts; already-published versions are never
 * touched.
 *
 *   node scripts/loadPolicyDrafts.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const projectId = process.env.FIREBASE_PROJECT_ID || 'synzapp-a7ee3';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

initializeApp(serviceAccountJson
  ? { credential: cert(JSON.parse(serviceAccountJson)), projectId }
  : { projectId });

const firestore = getFirestore();

const documents = [
  {
    file: 'privacy.txt',
    slug: 'privacy',
    summary: 'First full version. Describes encryption, the compliance archive, retention, and the two companies that process data on our behalf.',
    title: 'Privacy Policy'
  },
  {
    file: 'terms.txt',
    slug: 'terms',
    summary: 'First full version. Availability, security, termination, legal holds and liability.',
    title: 'Terms of Service'
  }
];

for (const document of documents) {
  const body = readFileSync(join(here, 'policyDrafts', document.file), 'utf8');
  const versions = firestore.collection('synzappPolicies').doc(document.slug).collection('versions');

  const existing = await versions.orderBy('version', 'desc').limit(20).get();
  const rows = existing.docs.map((doc) => doc.data());
  const draft = rows.find((row) => row.state === 'DRAFT');
  const version = draft?.version ?? ((rows[0]?.version || 0) + 1);

  await versions.doc(String(version)).set({
    body,
    effectiveFromMs: 0,
    publishedAtMs: null,
    publishedByEmail: null,
    slug: document.slug,
    state: 'DRAFT',
    summary: document.summary,
    title: document.title,
    version
  });

  console.log(`Loaded ${document.slug} as draft version ${version} (${body.length} characters).`);
}

console.log('\nOpen the staff console, read them, then publish when you are ready.');
