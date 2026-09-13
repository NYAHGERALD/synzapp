import { describe, expect, it } from 'vitest';

import { parseInlineSpans, parseRcaAnswer } from './rcaAnswerFormat';

describe('reading the guide’s markdown', () => {
  it('turns a hash heading into a heading, without the hashes', () => {
    const [block] = parseRcaAnswer('## Synzapp RCA process');

    expect(block).toEqual({
      level: 2,
      spans: [{ bold: false, text: 'Synzapp RCA process' }],
      type: 'heading'
    });
  });

  it('keeps a numbered item’s own number, rather than renumbering it', () => {
    // The model writes the sequence; re-deriving it would disagree the moment
    // a stream is cut short or a list restarts.
    const [block] = parseRcaAnswer('7. Test each likely cause');

    expect(block).toEqual({
      depth: 0,
      marker: '7.',
      spans: [{ bold: false, text: 'Test each likely cause' }],
      type: 'listItem'
    });
  });

  it('reads indentation as nesting', () => {
    const blocks = parseRcaAnswer('- top\n  - nested\n    - deeper');

    expect(blocks.map((block) => (block.type === 'listItem' ? block.depth : -1))).toEqual([0, 1, 2]);
  });

  it('joins wrapped lines into one paragraph, and splits on a blank line', () => {
    const blocks = parseRcaAnswer('one line\nsame paragraph\n\nsecond paragraph');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      spans: [{ bold: false, text: 'one line same paragraph' }],
      type: 'paragraph'
    });
  });

  it('marks bold without leaving the stars behind', () => {
    expect(parseInlineSpans('Use **Node Details** here')).toEqual([
      { bold: false, text: 'Use ' },
      { bold: true, text: 'Node Details' },
      { bold: false, text: ' here' }
    ]);
  });

  it('leaves an unfinished bold alone, because a stream arrives mid-word', () => {
    expect(parseInlineSpans('Create the **war-roo')).toEqual([
      { bold: false, text: 'Create the **war-roo' }
    ]);
  });

  it('answers with nothing for nothing', () => {
    expect(parseRcaAnswer('')).toEqual([]);
  });
});
