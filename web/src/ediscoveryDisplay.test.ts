import { describe, expect, it } from 'vitest';
import type { ArchivedMessageHit, ComplianceExportSummary } from './complianceApi';
import {
  describeExport,
  describeExportProgress,
  exportProgressFraction,
  isExportInProgress,
  formatElapsed,
  formatPickedDate,
  toDateOnlyValue,
  formatBytes,
  formatSentAt,
  formatUnreadableReason,
  nameForUid,
  toSearchHitRow,
  validateSearchCriteria
} from './ediscoveryDisplay';

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0);

function hit(overrides: Partial<ArchivedMessageHit> = {}): ArchivedMessageHit {
  return {
    conversationId: 'chat-1',
    conversationKind: 'DIRECT',
    envelopeId: 'env-1',
    media: [],
    recipientUid: 'user-2',
    senderUid: 'user-1',
    sentAtMs: Date.UTC(2026, 5, 1, 9, 30),
    text: 'The invoice was approved on Tuesday.',
    unreadableReason: null,
    ...overrides
  };
}

function exportSummary(overrides: Partial<ComplianceExportSummary> = {}): ComplianceExportSummary {
  return {
    completeness: 'COMPLETE',
    createdAtMs: NOW,
    createdByUid: 'admin-1',
    excludedMediaFiles: 0,
    excludedMessages: 0,
    expiresAtMs: NOW + 30 * 24 * 60 * 60 * 1000,
    id: 'export-1',
    includedMediaFiles: 0,
    includedMessages: 12,
    matchedMessages: 12,
    processedMessages: 12,
    sizeBytes: 2048,
    stage: 'Ready to download',
    state: 'READY',
    totalMessages: 12,
    ...overrides
  };
}

describe('toSearchHitRow', () => {
  it('shows the message text when it could be read', () => {
    const row = toSearchHitRow(hit(), NOW);

    expect(row.isReadable).toBe(true);
    expect(row.preview).toBe('The invoice was approved on Tuesday.');
  });

  it('shows why a message could not be read instead of leaving the row blank', () => {
    const row = toSearchHitRow(hit({ text: null, unreadableReason: 'NOT_ARCHIVED' }), NOW);

    expect(row.isReadable).toBe(false);
    expect(row.preview).toMatch(/cannot be recovered/i);
  });

  it('says so when a message carries only an attachment', () => {
    const row = toSearchHitRow(hit({
      media: [{ fileName: 'clip.mp4', kind: 'video', mediaId: 'm1', sizeBytes: 10 }],
      text: ''
    }), NOW);

    expect(row.preview).toBe('(no text, attachment only)');
    expect(row.attachments).toBe('1 file');
  });

  it('counts several attachments', () => {
    const row = toSearchHitRow(hit({
      media: [
        { fileName: 'a.jpg', kind: 'image', mediaId: 'm1', sizeBytes: 10 },
        { fileName: 'b.jpg', kind: 'image', mediaId: 'm2', sizeBytes: 10 }
      ]
    }), NOW);

    expect(row.attachments).toBe('2 files');
  });

  it('shortens a long message rather than breaking the row', () => {
    const row = toSearchHitRow(hit({ text: 'x'.repeat(400) }), NOW);

    expect(row.preview.length).toBe(160);
    expect(row.preview.endsWith('…')).toBe(true);
  });
});

describe('formatUnreadableReason', () => {
  it('separates a permanent gap from a fault to report', () => {
    expect(formatUnreadableReason('NOT_ARCHIVED')).toMatch(/cannot be recovered/i);
    expect(formatUnreadableReason('DECRYPT_FAILED')).toMatch(/report this/i);
  });
});

describe('describeExport', () => {
  it('leads with Complete when nothing was left out', () => {
    expect(describeExport(exportSummary())).toMatch(/^Complete:/);
  });

  it('leads with Incomplete and says what is missing', () => {
    const text = describeExport(exportSummary({
      completeness: 'PARTIAL',
      excludedMediaFiles: 2,
      excludedMessages: 3
    }));

    expect(text).toMatch(/^Incomplete:/);
    expect(text).toContain('3 messages and 2 files could not be included');
    expect(text).toMatch(/manifest inside says why/i);
  });

  it('uses singular wording for one missing message', () => {
    const text = describeExport(exportSummary({ completeness: 'PARTIAL', excludedMessages: 1 }));

    expect(text).toContain('1 message could not be included');
  });
});

describe('formatBytes', () => {
  it('reads as a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(1536 * 1024 * 1024)).toBe('1.5 GB');
  });
});

describe('formatSentAt', () => {
  it('says Today for a message from the last day', () => {
    expect(formatSentAt(NOW - 60 * 60 * 1000, NOW)).toMatch(/^Today /);
  });

  it('gives the date for anything older', () => {
    expect(formatSentAt(Date.UTC(2026, 0, 5, 10, 0), NOW)).not.toMatch(/^Today /);
  });
});

describe('validateSearchCriteria', () => {
  it('catches a reversed date range before the search runs', () => {
    expect(validateSearchCriteria({ fromMs: NOW, toMs: NOW - DAY })).toBe(
      'The start date is after the end date.'
    );
  });

  it('allows a search with no dates at all', () => {
    expect(validateSearchCriteria({ fromMs: null, toMs: null })).toBeNull();
  });
});

const DAY = 24 * 60 * 60 * 1000;

describe('nameForUid', () => {
  const people = [
    { displayName: 'Amara Obi', uid: 'user-1' },
    { displayName: 'Tom Reid', uid: 'user-2' }
  ];

  it('shows the name for someone in the staff list', () => {
    expect(nameForUid(people, 'user-2')).toBe('Tom Reid');
  });

  it('falls back to the id for someone who has left', () => {
    // Blank would be worse: the row would look like it had no sender.
    expect(nameForUid(people, 'user-9')).toBe('user-9');
  });
})

describe('formatElapsed', () => {
  it('counts seconds, then minutes', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(45)).toBe('45s');
    expect(formatElapsed(60)).toBe('1m');
    expect(formatElapsed(135)).toBe('2m 15s');
  });
});

describe('toDateOnlyValue', () => {
  it('keeps the day the user actually clicked', () => {
    // Built from local parts: toISOString shifts to UTC and can land a picked
    // date on the day before for anyone west of Greenwich.
    const picked = new Date(2026, 7, 30, 23, 30);

    expect(toDateOnlyValue(picked)).toBe('2026-08-30');
  });

  it('pads single-digit months and days', () => {
    expect(toDateOnlyValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatPickedDate', () => {
  it('shows nothing for an empty value', () => {
    expect(formatPickedDate('')).toBe('');
  });

  it('reads as a date, not as mm/dd/yyyy', () => {
    expect(formatPickedDate('2026-08-30')).toMatch(/2026/);
    expect(formatPickedDate('2026-08-30')).not.toBe('2026-08-30');
  });
});

describe('export progress is real, or absent', () => {
  it('shows nothing until the work has been measured', () => {
    // During the search nobody knows how many messages there are. A bar moving
    // before then is a guess dressed as a fact.
    expect(exportProgressFraction({ state: 'RUNNING', totalMessages: 0 })).toBeNull();
  });

  it('reports the real fraction once the total is known', () => {
    expect(exportProgressFraction({
      processedMessages: 25,
      state: 'RUNNING',
      totalMessages: 100
    })).toBe(0.25);
  });

  it('holds just short of complete while the file is still being written', () => {
    // Showing 100% before the download exists invites a click that fails.
    expect(exportProgressFraction({
      processedMessages: 100,
      state: 'RUNNING',
      totalMessages: 100
    })).toBe(0.99);
  });

  it('is complete only when the export is ready', () => {
    expect(exportProgressFraction({ state: 'READY', totalMessages: 100 })).toBe(1);
  });

  it('never exceeds the total even if the count runs ahead', () => {
    expect(exportProgressFraction({
      processedMessages: 500,
      state: 'RUNNING',
      totalMessages: 100
    })).toBe(0.99);
  });
});

describe('isExportInProgress', () => {
  it('keeps polling while pending or running', () => {
    expect(isExportInProgress({ state: 'PENDING' })).toBe(true);
    expect(isExportInProgress({ state: 'RUNNING' })).toBe(true);
  });

  it('stops once finished or failed', () => {
    expect(isExportInProgress({ state: 'READY' })).toBe(false);
    expect(isExportInProgress({ state: 'FAILED' })).toBe(false);
  });
});

describe('describeExportProgress', () => {
  it('gives the failure reason rather than leaving it running for ever', () => {
    expect(describeExportProgress({ error: 'Storage refused the file', state: 'FAILED' }))
      .toBe('Storage refused the file');
  });

  it('counts messages once the total is known', () => {
    expect(describeExportProgress({
      processedMessages: 40,
      stage: 'Packaging 200 messages',
      state: 'RUNNING',
      totalMessages: 200
    })).toBe('Packaging 200 messages: 40 of 200.');
  });

  it('falls back to the stage while the total is unknown', () => {
    expect(describeExportProgress({ stage: 'Searching conversations', state: 'RUNNING' }))
      .toBe('Searching conversations');
  });
});
