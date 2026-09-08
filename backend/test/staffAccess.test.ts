import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Comments are stripped before asserting.
 *
 * These files explain at length why the customer `SYSTEM_ADMIN` role is not
 * used here, so a plain text search finds the words in the explanation and
 * reports a problem that does not exist. A test that cries wolf is worse than
 * no test — people learn to ignore it.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const service = withoutComments(readFileSync(
  new URL('../src/services/staffAccessService.ts', import.meta.url),
  'utf8'
));
const routes = withoutComments(readFileSync(
  new URL('../src/routes/staffRoutes.ts', import.meta.url),
  'utf8'
));
const policies = withoutComments(readFileSync(
  new URL('../src/services/policyDocumentService.ts', import.meta.url),
  'utf8'
));

describe('the staff gate fails closed', () => {
  it('denies everyone when the domain is not configured', () => {
    // Treating unset configuration as "no restriction" would open the console
    // to any Google account on the internet.
    assert.match(service, /if \(!domain\) \{[\s\S]*?throw authorizationError/);
  });

  it('requires a verified address, not just any token', () => {
    assert.match(service, /decodedToken\.email_verified !== true/);
  });

  it('requires the company domain', () => {
    assert.match(service, /endsWith\(`@\$\{domain\}`\)/);
  });

  it('requires Google sign-in, so the customer phone login cannot reach it', () => {
    assert.match(service, /sign_in_provider !== 'google\.com'/);
  });

  it('requires a record on the staff list as well as the domain', () => {
    // The domain alone fails the day a lookalike account is registered or an
    // old address is recycled — and it fails silently.
    assert.match(service, /if \(!snapshot\.exists\)/);
    assert.match(service, /member\.status !== 'ACTIVE'/);
  });

  it('checks the stored address matches the signed-in one', () => {
    // A recycled or changed address must not inherit somebody else's access.
    assert.match(service, /member\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== email/);
  });

  it('does not use the customer SYSTEM_ADMIN role anywhere', () => {
    assert.doesNotMatch(service, /SYSTEM_ADMIN/);
    assert.doesNotMatch(routes, /SYSTEM_ADMIN/);
  });
});

describe('no staff route can reach customer content', () => {
  it('never touches chats, envelopes, interpreter or compliance data', () => {
    // Enforced by which routes exist, not by a filter somebody could forget.
    for (const forbidden of [
      'encryptedEnvelopes',
      'directChats',
      'mediaAttachments',
      'interpreter',
      'complianceExports',
      'archiveKeys'
    ]) {
      assert.doesNotMatch(routes, new RegExp(forbidden), `staff routes must not reference ${forbidden}`);
    }
  });

  it('records who looked at the support inbox', () => {
    // Support access nobody can account for later is indistinguishable from
    // browsing customers' business.
    assert.match(routes, /STAFF_INBOX_VIEWED/);
  });

  it('records replies and state changes', () => {
    assert.match(routes, /STAFF_SUPPORT_REPLIED/);
    assert.match(routes, /STAFF_SUPPORT_STATE_CHANGED/);
  });
});

describe('a published policy is evidence, so it cannot be edited', () => {
  it('publishing creates a version and moves a pointer, in one transaction', () => {
    // A half-applied publish would show the old policy while claiming the new
    // one, or the reverse.
    assert.match(policies, /runTransaction/);
    assert.match(policies, /publishedVersion: draft\.version/);
  });

  it('only a draft can be saved over', () => {
    assert.match(policies, /state: 'DRAFT'/);
    assert.match(policies, /getPolicyDraft/);
  });

  it('records who published it and when', () => {
    assert.match(policies, /publishedByEmail/);
    assert.match(policies, /publishedAtMs/);
  });

  it('publishing needs an administrator, not any support account', () => {
    assert.match(routes, /requireStaffAdmin\(context\)/);
  });

  it('requires a summary of what changed', () => {
    // A history of twenty versions with no summaries is unusable.
    assert.match(policies, /Say what changed in this version/);
  });
});
