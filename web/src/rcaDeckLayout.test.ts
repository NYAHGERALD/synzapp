import { describe, expect, it } from 'vitest';

import {
  RCA_DECK_SHORT_ROW_HEIGHT,
  RCA_DECK_WIDE_ROW_HEIGHT,
  clipRcaDeckValue,
  getRcaDeckContinuationLabel,
  isRcaDeckEmbeddableImage,
  paginateRcaDeckRows,
  planRcaDeckFieldPages,
  planRcaDeckRows
} from './rcaDeckLayout';

const short = (n: number) => ({ label: `L${n}`, value: `v${n}` });
const wide = (n: number) => ({ label: `L${n}`, value: 'x'.repeat(200) });

describe('packing fields into rows', () => {
  it('pairs short fields into one row', () => {
    const rows = planRcaDeckRows([short(1), short(2)]);

    expect(rows).toHaveLength(1);
    expect(rows[0].fields).toHaveLength(2);
    expect(rows[0].height).toBe(RCA_DECK_SHORT_ROW_HEIGHT);
  });

  it('gives a long value a row of its own, and a taller one', () => {
    const rows = planRcaDeckRows([wide(1)]);

    expect(rows[0].isWide).toBe(true);
    expect(rows[0].height).toBe(RCA_DECK_WIDE_ROW_HEIGHT);
  });

  it('closes a half-built pair before starting a wide row', () => {
    // Otherwise a long value sat beside a one-word field, which is what made
    // the old slides look ragged.
    const rows = planRcaDeckRows([short(1), wide(2), short(3)]);

    expect(rows.map((row) => row.fields.length)).toEqual([1, 1, 1]);
    expect(rows[1].isWide).toBe(true);
  });

  it('never loses a trailing unpaired field', () => {
    expect(planRcaDeckRows([short(1), short(2), short(3)]).flatMap((row) => row.fields))
      .toHaveLength(3);
  });
});

describe('filling slides by height rather than by count', () => {
  it('breaks when the next row would not fit', () => {
    // Deciding "twelve fields fit" is what ran six rows through the footer.
    const rows = planRcaDeckRows(Array.from({ length: 12 }, (unused, i) => short(i)));
    const pages = paginateRcaDeckRows(rows, RCA_DECK_SHORT_ROW_HEIGHT * 3);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(3);
  });

  it('keeps every field across the pages it needs', () => {
    const fields = Array.from({ length: 41 }, (unused, i) => short(i));
    const pages = planRcaDeckFieldPages(fields, 3.4);

    expect(pages.flatMap((page) => page.flatMap((row) => row.fields))).toHaveLength(41);
  });

  it('still places a row taller than a whole slide', () => {
    const pages = paginateRcaDeckRows(planRcaDeckRows([wide(1)]), 0.5);

    expect(pages).toHaveLength(1);
  });

  it('returns nothing for nothing', () => {
    expect(planRcaDeckFieldPages([], 4)).toEqual([]);
  });
});

describe('what may be embedded as a picture', () => {
  it('accepts the image types PowerPoint opens', () => {
    expect(isRcaDeckEmbeddableImage('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isRcaDeckEmbeddableImage('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
  });

  it('refuses anything that is not a picture', () => {
    /**
     * addImage embeds any base64 without complaint, so a PDF evidence record —
     * or a fetch that returned an error page — produced a file PowerPoint would
     * only offer to repair. A missing thumbnail beats an unopenable deck.
     */
    expect(isRcaDeckEmbeddableImage('data:application/pdf;base64,JVBERi0=')).toBe(false);
    expect(isRcaDeckEmbeddableImage('data:text/html;base64,PGh0bWw+')).toBe(false);
    expect(isRcaDeckEmbeddableImage('iVBORw0KGgo=')).toBe(false);
    expect(isRcaDeckEmbeddableImage('')).toBe(false);
    expect(isRcaDeckEmbeddableImage(null)).toBe(false);
  });
});

describe('telling the reader where they are', () => {
  it('says which slide of how many, and stays quiet for a single one', () => {
    expect(getRcaDeckContinuationLabel(1, 3)).toBe('2 of 3');
    expect(getRcaDeckContinuationLabel(0, 1)).toBe('');
  });
});

describe('trimming a value for a slide', () => {
  it('cuts on a word boundary and collapses textarea whitespace', () => {
    expect(clipRcaDeckValue('the scanner on line three was offline', 20)).toBe('the scanner on line…');
    expect(clipRcaDeckValue('  two   lines\n here ', 40)).toBe('two lines here');
  });
});
