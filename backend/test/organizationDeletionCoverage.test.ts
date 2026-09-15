import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const deletionService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'organizationDeletionService.ts'),
  'utf8'
);

/**
 * A guard. Offboarding reaches Firestore and Storage, so what it covers can only
 * be asserted by reading it — and what it missed was invisible precisely because
 * it lived under a different prefix from everything else.
 */
describe('offboarding leaves nothing behind', () => {
  it('deletes the compliance export prefix, not only the organization one', () => {
    /**
     * An export bundle is a plain zip of decrypted message bodies and files, up
     * to four gigabytes, written to complianceExports/{tenantId}/. Deleting an
     * organization removed organizations/{tenantId}/ and left those standing —
     * and nothing would ever have come back for them, because their thirty day
     * purge only runs for tenants the nightly sweep can enumerate, and it
     * enumerates organizations.
     */
    assert.match(deletionService, /prefix: `organizations\/\$\{tenantId\}\//);
    assert.match(
      deletionService,
      /prefix: `complianceExports\/\$\{tenantId\}\//,
      'Offboarding must delete the compliance exports, which are readable chat history.'
    );
  });

  it('deletes the tenants document tree as well as the organization', () => {
    // Legal holds, disposition items, export records and retention policies live
    // under tenants/{tenantId}, which nothing in this flow ever touched.
    assert.match(
      deletionService,
      /recursiveDelete\(firestore\.collection\('tenants'\)\.doc\(context\.tenantId\)\)/
    );
  });

  it('still refuses to delete a tenant under a legal hold', () => {
    // The order matters: what the new deletion removes includes the hold records
    // themselves, so the refusal has to come first.
    const holdCheck = deletionService.indexOf('assertTenantDeletableUnderHolds');
    const tenantDelete = deletionService.indexOf("recursiveDelete(firestore.collection('tenants')");

    assert.ok(holdCheck > 0, 'Expected a legal hold check before deletion.');
    assert.ok(holdCheck < tenantDelete, 'The hold check must run before anything is removed.');
  });
});
