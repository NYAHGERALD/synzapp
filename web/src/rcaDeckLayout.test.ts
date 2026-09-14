import { describe, expect, it } from 'vitest';

import {
  chunkRcaDeckFields,
  clipRcaDeckValue,
  getRcaDeckContinuationLabel,
  getRcaDeckFieldWeight
} from './rcaDeckLayout';

const field = (value: string, label = 'Field') => ({ label, value });

describe('dividing a node across slides', () => {
  it('keeps every field, rather than fitting what it can', () => {
    // The deck this replaced showed four and reported the rest as a count.
    const fields = Array.from({ length: 30 }, (unused, index) => field(`v${index}`));
    const pages = chunkRcaDeckFields(fields);

    expect(pages.flat()).toHaveLength(30);
  });

  it('fills a slide before starting another', () => {
    const pages = chunkRcaDeckFields(Array.from({ length: 13 }, () => field('short')));

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(12);
    expect(pages[1]).toHaveLength(1);
  });

  it('gives a long value the room it needs', () => {
    const long = field('x'.repeat(200));

    expect(getRcaDeckFieldWeight(long)).toBe(2);
    expect(getRcaDeckFieldWeight(field('short'))).toBe(1);
  });

  it('never returns an empty page, and never loses a lone field', () => {
    expect(chunkRcaDeckFields([])).toEqual([]);
    expect(chunkRcaDeckFields([field('one')])).toHaveLength(1);
  });

  it('still places a field larger than the whole budget', () => {
    // Otherwise a single very long value would loop or vanish.
    const pages = chunkRcaDeckFields([field('x'.repeat(500))], 1);

    expect(pages).toEqual([[field('x'.repeat(500))]]);
  });
});

describe('telling the reader where they are', () => {
  it('says which slide of how many, and stays quiet for a single one', () => {
    expect(getRcaDeckContinuationLabel(1, 3)).toBe('2 of 3');
    expect(getRcaDeckContinuationLabel(0, 1)).toBe('');
  });
});

describe('trimming a value for a slide', () => {
  it('leaves a short value alone', () => {
    expect(clipRcaDeckValue('Line 3 scanner', 40)).toBe('Line 3 scanner');
  });

  it('cuts on a word boundary rather than mid-word', () => {
    expect(clipRcaDeckValue('the scanner on line three was offline', 20)).toBe('the scanner on line…');
  });

  it('collapses the whitespace a textarea leaves behind', () => {
    expect(clipRcaDeckValue('  two   lines\n here ', 40)).toBe('two lines here');
  });
});
