import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getReadAloudNeighbourText,
  READ_ALOUD_OPENING_CHARACTERS,
  splitTranscriptIntoReadAloudSegments
} from '../src/services/interpreterReadAloudSegments.js';

/**
 * A transcript's whitespace, not the tidy kind. The bug that shipped survived
 * because the test built its input with join('\n\n') and so round-tripped
 * perfectly — it tested the formatter's own output rather than a transcript.
 */
const messyTranscript = [
  'So it was a chaotic scene in Chicago over the Labor holiday weekend.',
  '   ',
  'You had gun violence ringing out across that city, at least 38 people shot.',
  '',
  '  Eight of them are dead. Raymond Lopez is a Chicago alderman. Sir, how you doing?',
  '',
  '',
  'Here we go again, right? They are saying it was better than last year.',
  '\t',
  'The president said this: the city will die if the federal government is not invited in.'
].join('\n') + '\n\n' + Array.from({ length: 60 }, (_item, index) =>
  `Sentence number ${index} carries on the same thought without a paragraph break.`
).join(' ');

describe('splitTranscriptIntoReadAloudSegments', () => {
  it('reproduces the source exactly when the segments are rejoined', () => {
    // The single most important property. Anything else being wrong is a
    // disappointment; this being wrong repeats or drops words in a recording
    // somebody may rely on.
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    assert.equal(segments.map((segment) => segment.text).join(''), messyTranscript);
  });

  it('never overlaps one segment with the next', () => {
    // This is the exact fault that shipped: part one ended "...alderman." and
    // part two began "rman.".
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    segments.forEach((segment, index) => {
      if (index === 0) {
        assert.equal(segment.startOffset, 0);

        return;
      }

      assert.equal(segment.startOffset, segments[index - 1].endOffset);
    });
  });

  it('slices only from the source, never from a rewritten copy', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    for (const segment of segments) {
      assert.equal(segment.text, messyTranscript.slice(segment.startOffset, segment.endOffset));
    }
  });

  it('opens with a short segment so speech starts quickly', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    assert.ok(segments.length > 2);
    assert.ok(segments[0].text.length <= READ_ALOUD_OPENING_CHARACTERS);
    assert.ok(segments[1].text.length > segments[0].text.length);
  });

  it('cuts at sentence and paragraph breaks rather than mid-word', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    for (const segment of segments.slice(0, -1)) {
      const tail = segment.text.trimEnd();

      assert.ok(
        /[.!?。\n]$/.test(tail) || tail.endsWith(' ') || segment.text.endsWith(' '),
        `segment ${segment.index} ends mid-word: ${JSON.stringify(tail.slice(-40))}`
      );
    }
  });

  it('numbers the segments in reading order', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    assert.deepEqual(
      segments.map((segment) => segment.index),
      segments.map((_segment, index) => index)
    );
  });

  it('keeps a short transcript in one segment', () => {
    const segments = splitTranscriptIntoReadAloudSegments('We increased throughput.');

    assert.equal(segments.length, 1);
    assert.equal(segments[0].text, 'We increased throughput.');
  });

  it('answers nothing for an empty transcript', () => {
    assert.deepEqual(splitTranscriptIntoReadAloudSegments(''), []);
  });

  it('splits text that has no punctuation at all', () => {
    // Untranscribed speech often arrives with no sentence breaks whatsoever,
    // and it must not be dropped.
    const source = Array.from({ length: 400 }, (_item, index) => `word${index}`).join(' ');
    const segments = splitTranscriptIntoReadAloudSegments(source, {
      openingCharacters: 100,
      segmentCharacters: 200
    });

    assert.ok(segments.length > 3);
    assert.equal(segments.map((segment) => segment.text).join(''), source);
  });

  it('does not spin on text it cannot break', () => {
    const source = 'x'.repeat(5000);
    const segments = splitTranscriptIntoReadAloudSegments(source, {
      openingCharacters: 100,
      segmentCharacters: 200
    });

    assert.equal(segments.map((segment) => segment.text).join(''), source);
  });
});

describe('getReadAloudNeighbourText', () => {
  it('gives a segment the words either side of it', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);
    const neighbours = getReadAloudNeighbourText(segments, 1);

    assert.ok(neighbours.previousText.length > 0);
    assert.ok(neighbours.nextText.length > 0);
    assert.ok(segments[0].text.trimEnd().endsWith(neighbours.previousText.slice(-20)));
  });

  it('gives the first segment nothing before it and the last nothing after', () => {
    const segments = splitTranscriptIntoReadAloudSegments(messyTranscript);

    assert.equal(getReadAloudNeighbourText(segments, 0).previousText, '');
    assert.equal(getReadAloudNeighbourText(segments, segments.length - 1).nextText, '');
  });
});
