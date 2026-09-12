import { describe, expect, it } from 'vitest';
import { buildInterpreterExportFileName } from './interpreterExportFileName';

describe('buildInterpreterExportFileName', () => {
  it('says which meeting, what it is, and in which language', () => {
    expect(buildInterpreterExportFileName('Line 3 changeover', 'summary', 'es-MX'))
      .toBe('Line-3-changeover-summary-es-MX');
  });

  it('keeps only characters every system accepts', () => {
    // A slash in a file name is a folder on most systems, and a colon breaks
    // the file outright on some.
    expect(buildInterpreterExportFileName('Q3: safety / rework', 'transcript', 'en-US'))
      .toBe('Q3-safety-rework-transcript-en-US');
  });

  it('never starts or ends with a separator', () => {
    expect(buildInterpreterExportFileName('  ...review...  ', 'summary', 'en-US'))
      .toBe('review-summary-en-US');
  });

  it('keeps a very long meeting name to a workable length', () => {
    const name = buildInterpreterExportFileName('x'.repeat(200), 'summary', 'en-US');

    expect(name.length).toBeLessThan(90);
  });

  it('still produces a usable name when the meeting has none', () => {
    expect(buildInterpreterExportFileName('', 'summary', 'en-US')).toBe('meeting-summary-en-US');
    expect(buildInterpreterExportFileName('!!!', 'transcript', '')).toBe('meeting-transcript-unknown');
  });
});
