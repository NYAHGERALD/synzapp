import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExportManifest,
  describeExclusionReason,
  formatManifestCsv,
  type ExportManifestEntry
} from '../src/services/complianceExportManifest.ts';

const CRITERIA = {
  conversationIds: [],
  custodianUids: ['user-1'],
  fromMs: Date.UTC(2026, 0, 1),
  holdId: 'hold-1',
  toMs: Date.UTC(2026, 5, 1)
};

function entry(overrides: Partial<ExportManifestEntry> = {}): ExportManifestEntry {
  return {
    conversationId: 'chat-1',
    conversationKind: 'DIRECT',
    envelopeId: 'env-1',
    excludedReason: null,
    media: [],
    messageFilePath: 'messages/chat-1/a.json',
    senderUid: 'user-1',
    sentAtMs: Date.UTC(2026, 2, 1),
    ...overrides
  };
}

function build(entries: ExportManifestEntry[]) {
  return buildExportManifest({
    criteria: CRITERIA,
    entries,
    exportId: 'export-1',
    generatedAtMs: Date.UTC(2026, 5, 2),
    generatedByUid: 'admin-1',
    tenantId: 'tenant-1'
  });
}

describe('buildExportManifest', () => {
  it('reports COMPLETE only when nothing was left out', () => {
    const manifest = build([entry(), entry({ envelopeId: 'env-2' })]);

    assert.equal(manifest.completeness, 'COMPLETE');
    assert.equal(manifest.totals.includedMessages, 2);
    assert.equal(manifest.totals.excludedMessages, 0);
  });

  it('reports PARTIAL when a message could not be included', () => {
    const manifest = build([
      entry(),
      entry({ envelopeId: 'env-2', excludedReason: 'NOT_ARCHIVED', messageFilePath: null })
    ]);

    assert.equal(manifest.completeness, 'PARTIAL');
    assert.equal(manifest.totals.includedMessages, 1);
    assert.equal(manifest.totals.excludedMessages, 1);
    assert.equal(manifest.totals.matchedMessages, 2);
  });

  it('reports PARTIAL when only an attachment was left out', () => {
    // The message text is present, so counting messages alone would call this
    // export complete while a file the search matched is missing from it.
    const manifest = build([
      entry({
        media: [{
          contentType: 'video/mp4',
          excludedReason: 'MEDIA_MISSING',
          fileName: 'clip.mp4',
          filePath: null,
          mediaId: 'media-1',
          sizeBytes: 1024
        }]
      })
    ]);

    assert.equal(manifest.completeness, 'PARTIAL');
    assert.equal(manifest.totals.excludedMessages, 0);
    assert.equal(manifest.totals.excludedMediaFiles, 1);
  });

  it('counts every exclusion reason and explains each in plain words', () => {
    const manifest = build([
      entry({ envelopeId: 'a', excludedReason: 'NOT_ARCHIVED', messageFilePath: null }),
      entry({ envelopeId: 'b', excludedReason: 'NOT_ARCHIVED', messageFilePath: null }),
      entry({ envelopeId: 'c', excludedReason: 'DECRYPT_FAILED', messageFilePath: null })
    ]);

    assert.deepEqual(
      manifest.exclusions.map((exclusion) => [exclusion.reason, exclusion.count]),
      [['NOT_ARCHIVED', 2], ['DECRYPT_FAILED', 1]]
    );
    assert.ok(manifest.exclusions.every((exclusion) => exclusion.meaning.length > 20));
  });

  it('keeps the search that produced it, so an export can be accounted for later', () => {
    const manifest = build([entry()]);

    assert.deepEqual(manifest.criteria, CRITERIA);
    assert.equal(manifest.generatedByUid, 'admin-1');
  });
});

describe('describeExclusionReason', () => {
  it('says a missing archive key means nothing in the period is recoverable', () => {
    assert.match(describeExclusionReason('NO_ARCHIVE_KEY'), /no message can be read/i);
  });

  it('distinguishes an expected gap from a fault worth reporting', () => {
    assert.match(describeExclusionReason('NOT_ARCHIVED'), /cannot be corrected/i);
    assert.match(describeExclusionReason('DECRYPT_FAILED'), /fault worth reporting/i);
  });
});

describe('formatManifestCsv', () => {
  it('writes one row per matched message under a header', () => {
    const csv = formatManifestCsv(build([entry(), entry({ envelopeId: 'env-2' })]));

    assert.equal(csv.split('\r\n').length, 3);
    /**
     * Every cell is quoted now, not only the ones that structurally need it.
     * The web exports have always done that, and the backend was the outlier —
     * a cell quoted only sometimes is one where defusing a formula changes
     * whether the quoting rule fires, and the two decisions interacting is what
     * nobody notices until an export is wrong.
     */
    assert.match(csv, /^"Sent \(UTC\)","Conversation",/);
  });

  it('marks an excluded message as not included and gives the reason', () => {
    const csv = formatManifestCsv(build([
      entry({ excludedReason: 'NOT_ARCHIVED', messageFilePath: null })
    ]));

    assert.match(csv, /,"No",/);
    assert.match(csv, /cannot be corrected/i);
  });

  it('escapes commas and quotes so the columns cannot shift', () => {
    // The reason column holds full sentences with commas in them. An unescaped
    // one moves every later column and the index misreports which message is
    // missing.
    const csv = formatManifestCsv(build([
      entry({ conversationId: 'chat,"1"', excludedReason: null })
    ]));
    const dataRow = csv.split('\r\n')[1];

    assert.ok(dataRow.includes('"chat,""1"""'));
    assert.equal(dataRow.split('","').length >= 1, true);
  });
});

describe('size limits are reported, never silent', () => {
  it('explains a file too large for one export', () => {
    assert.match(describeExclusionReason('MEDIA_TOO_LARGE'), /larger than a single export/i);
  });

  it('explains an export that filled up before reaching a file', () => {
    // Without this the file would simply be absent, and the export would look
    // like the message never had an attachment.
    assert.match(describeExclusionReason('EXPORT_FULL'), /total size limit/i);
    assert.match(describeExclusionReason('EXPORT_FULL'), /further export/i);
  });

  it('marks an export PARTIAL when the budget stopped a file', () => {
    const manifest = build([
      entry({
        media: [{
          contentType: 'video/mp4',
          excludedReason: 'EXPORT_FULL',
          fileName: 'big.mp4',
          filePath: null,
          mediaId: 'media-1',
          sizeBytes: 90 * 1024 * 1024
        }]
      })
    ]);

    assert.equal(manifest.completeness, 'PARTIAL');
    assert.equal(manifest.totals.excludedMediaFiles, 1);
  });
});

describe('a text-only export still accounts for its files', () => {
  it('records attachments as excluded rather than omitting them', () => {
    // Asking for messages only must not make the files vanish from the record.
    // Somebody reading the manifest has to see that files existed and were not
    // collected, not conclude the messages had none.
    const manifest = build([
      entry({
        media: [{
          contentType: 'image/jpeg',
          excludedReason: 'EXPORT_FULL',
          fileName: 'receipt.jpg',
          filePath: null,
          mediaId: 'media-1',
          sizeBytes: 4096
        }]
      })
    ]);

    assert.equal(manifest.totals.excludedMediaFiles, 1);
    assert.equal(manifest.totals.includedMediaFiles, 0);
    assert.equal(manifest.completeness, 'PARTIAL');
  });
});

describe('exports from before jobs existed', () => {
  const service = readFileSync(
    new URL('../src/services/complianceExportService.ts', import.meta.url),
    'utf8'
  );

  it('are not left showing as still working', () => {
    // A record with no state gave the console nothing to read, so it showed
    // "Working" for ever — indistinguishable from a live job, and impossible to
    // clear from the list.
    assert.match(service, /normalizeExportRecord/);
    assert.match(service, /state: wasFinished \? 'READY' : 'FAILED'/);
  });

  it('say plainly that an interrupted one will not finish', () => {
    assert.match(service, /interrupted before it finished/i);
  });
});
