import { describe, expect, it } from 'vitest';
import { buildDownloadFileName } from './downloadBlobFile';

describe('naming a downloaded evidence file', () => {
  it('keeps an ordinary name', () => {
    expect(buildDownloadFileName('guard-removed.jpg')).toBe('guard-removed.jpg');
  });

  it('strips path separators', () => {
    // A name of ../../thing is a directory traversal on some platforms, and the
    // browser is not obliged to stop it.
    expect(buildDownloadFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(buildDownloadFileName('a\\b/c')).toBe('a-b-c');
  });

  it('strips the characters Windows refuses', () => {
    expect(buildDownloadFileName('a:b*c?d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('drops a leading dot or dash', () => {
    // A name beginning with a dot is a hidden file on Unix; one beginning with
    // a dash is read as a flag by some command line tools.
    expect(buildDownloadFileName('.hidden.jpg')).toBe('hidden.jpg');
    expect(buildDownloadFileName('-rf.jpg')).toBe('rf.jpg');
  });

  it('falls back rather than producing an empty or meaningless name', () => {
    expect(buildDownloadFileName('')).toBe('evidence');
    expect(buildDownloadFileName('   ')).toBe('evidence');
    expect(buildDownloadFileName('///')).toBe('evidence');
    expect(buildDownloadFileName('...')).toBe('evidence');
  });
});
