import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SPEECH_INPUT_CHARACTERS,
  mapWithConcurrency,
  splitTextForSpeech
} from '../src/services/interpreterSpeechChunking.ts';

describe('long text is split so it can be spoken at all', () => {
  it('leaves short text alone', () => {
    assert.deepEqual(splitTextForSpeech('A short line.'), ['A short line.']);
  });

  it('returns nothing for empty text', () => {
    assert.deepEqual(splitTextForSpeech('   '), []);
  });

  it('splits text longer than the endpoint accepts', () => {
    // The whole reason this exists: one request over the limit failed, so the
    // longest and most valuable recordings were the ones that broke.
    const long = Array.from({ length: 400 }, (_v, i) => `Sentence number ${i} of the meeting.`).join(' ');
    const pieces = splitTextForSpeech(long);

    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((piece) => piece.length <= MAX_SPEECH_INPUT_CHARACTERS));
  });

  it('loses no words', () => {
    const long = Array.from({ length: 300 }, (_v, i) => `Point ${i} matters.`).join(' ');
    const rejoined = splitTextForSpeech(long).join(' ').replace(/\s+/g, ' ');

    assert.equal(rejoined, long.replace(/\s+/g, ' '));
  });

  it('breaks at paragraphs before sentences', () => {
    const paragraph = `${'word '.repeat(500)}`.trim();
    const pieces = splitTextForSpeech(`${paragraph}\n\n${paragraph}`);

    assert.ok(pieces.length >= 2);
  });

  it('handles a very long sentence with no punctuation', () => {
    // Transcripts of natural speech are often unpunctuated. A sentence longer
    // than the limit must still be spoken, not dropped.
    const runOn = 'word '.repeat(2000).trim();
    const pieces = splitTextForSpeech(runOn);

    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((piece) => piece.length <= MAX_SPEECH_INPUT_CHARACTERS));
    assert.equal(pieces.join(' ').split(' ').length, 2000);
  });

  it('does not cut in the middle of a word', () => {
    const pieces = splitTextForSpeech('supercalifragilistic '.repeat(400).trim());

    assert.ok(pieces.every((piece) => !/\bsupercalifragilisti$|^c\b/.test(piece)));
  });
});

describe('pieces are spoken at the same time, in order', () => {
  it('keeps results in the original order however they finish', async () => {
    // Out-of-order audio would be worse than slow audio: the recording would
    // sound rearranged, which on a legal record is unusable.
    const delays = [40, 5, 25, 1];
    const result = await mapWithConcurrency(delays, 4, async (delay, index) => {
      await new Promise((resolve) => setTimeout(resolve, delay));

      return index;
    });

    assert.deepEqual(result, [0, 1, 2, 3]);
  });

  it('runs several at once rather than one after another', async () => {
    const startedAt = Date.now();

    await mapWithConcurrency([30, 30, 30, 30], 4, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));

      return delay;
    });

    // Four 30ms pieces one at a time would take 120ms.
    assert.ok(Date.now() - startedAt < 100);
  });

  it('does not fire everything at once', async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_v, i) => i), 4, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;

      return null;
    });

    assert.ok(peak <= 4, `expected at most 4 at once, saw ${peak}`);
  });
});
