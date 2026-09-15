import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const exportService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'complianceExportService.ts'),
  'utf8'
);
const complianceRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'complianceRoutes.ts'),
  'utf8'
);

describe('an export bundle can be verified after handover', () => {
  it('digests the archive as it is written', () => {
    /**
     * Without a digest the receiver cannot show the file they hold is the file
     * that was handed over, and neither can you — which is most of what an
     * eDiscovery bundle is produced for. The same codebase already does this
     * for the interpreter, where the comment reads "the digest is what makes a
     * dispute settleable".
     */
    assert.match(exportService, /createHash\('sha256'\)/);
    assert.match(exportService, /archiveSha256/);
  });

  it('takes the digest in transit rather than by reading the file back', () => {
    // The archive is already being streamed to Storage, so this costs one pass
    // over bytes that are passing anyway - not a second download of gigabytes.
    assert.match(exportService, /Transform/);
    assert.match(exportService, /\.pipe\(digestTap\)/);
  });

  it('hands the digest over with the link', () => {
    // A digest nobody is given is a digest nobody checks.
    assert.match(complianceRoutes, /archiveSha256: link\.archiveSha256/);
  });
});

describe('the download link is a bearer credential and is treated as one', () => {
  it('lives for an hour, not a day', () => {
    /**
     * A signed URL bypasses every Storage rule, and anybody holding the string
     * can fetch an unencrypted zip of a company's decrypted chat history.
     * Twenty-four hours of that sat in browser history, proxy logs and whatever
     * the link was pasted into. An hour is the window to start a download, not
     * to finish one, so a large bundle is unaffected.
     */
    assert.match(exportService, /const EXPORT_DOWNLOAD_TTL_MS = 60 \* 60 \* 1000;/);
    assert.doesNotMatch(exportService, /EXPORT_DOWNLOAD_TTL_MS = 24 \*/);
  });
});
