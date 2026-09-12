/**
 * Cutting a transcript into the segments it will be read in.
 *
 * **Every piece is located by offset into the original text and sliced from it.**
 * The previous attempt asked a formatter for a piece and then used that piece's
 * *length* to find the rest, which is wrong the moment the formatter rewrites
 * whitespace — it did, and every seam repeated a few characters of the one
 * before. Offsets cannot drift.
 *
 * Kept free of network calls so the rules can be tested directly.
 */

/** How much text goes in one segment after the first. */
export const READ_ALOUD_SEGMENT_CHARACTERS = 1800;

/**
 * The opening segment is deliberately short.
 *
 * It alone decides how long somebody waits after tapping Play. Everything after
 * it is longer, because by then the reading is running and the only job is
 * staying ahead of the listening.
 */
export const READ_ALOUD_OPENING_CHARACTERS = 260;

export interface ReadAloudSegment {
  /** Where this segment ends in the source, exclusive. */
  endOffset: number;
  /** Playback order, from 0. */
  index: number;
  /** Where this segment starts in the source. */
  startOffset: number;
  /** `source.slice(startOffset, endOffset)`, and nothing else. */
  text: string;
}

/**
 * Splits at the last sentence or paragraph break before the limit.
 *
 * A cut inside a sentence is audible: the reader drops its pitch at the end of
 * the segment and starts a new thought at the beginning of the next one, and
 * the listener hears a stumble in the middle of a sentence. Falling back to a
 * word break, and finally to the hard limit, keeps text that has no punctuation
 * at all — untranscribed speech often does — from being dropped.
 */
function findSplitOffset(source: string, from: number, limit: number): number {
  const hardEnd = Math.min(source.length, from + limit);

  if (hardEnd >= source.length) {
    return source.length;
  }

  const window = source.slice(from, hardEnd);
  const minimum = Math.floor(limit * 0.45);

  const paragraph = window.lastIndexOf('\n\n');

  if (paragraph >= minimum) {
    return from + paragraph + 2;
  }

  const sentence = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! '),
    window.lastIndexOf('。'),
    window.lastIndexOf('\n')
  );

  if (sentence >= minimum) {
    return from + sentence + 1;
  }

  const word = window.lastIndexOf(' ');

  if (word >= minimum) {
    return from + word + 1;
  }

  return hardEnd;
}

export function splitTranscriptIntoReadAloudSegments(
  source: string,
  options: {
    openingCharacters?: number;
    segmentCharacters?: number;
  } = {}
): ReadAloudSegment[] {
  if (!source) {
    return [];
  }

  const openingCharacters = options.openingCharacters ?? READ_ALOUD_OPENING_CHARACTERS;
  const segmentCharacters = options.segmentCharacters ?? READ_ALOUD_SEGMENT_CHARACTERS;
  const segments: ReadAloudSegment[] = [];

  let offset = 0;

  while (offset < source.length) {
    const limit = segments.length === 0 ? openingCharacters : segmentCharacters;
    const end = findSplitOffset(source, offset, limit);
    const text = source.slice(offset, end);

    // Whitespace between segments belongs to the one before it, so that
    // rejoining the segments reproduces the source character for character.
    if (text.trim()) {
      segments.push({
        endOffset: end,
        index: segments.length,
        startOffset: offset,
        text
      });
    } else if (segments.length) {
      const previous = segments[segments.length - 1];

      segments[segments.length - 1] = {
        ...previous,
        endOffset: end,
        text: source.slice(previous.startOffset, end)
      };
    }

    if (end <= offset) {
      break;
    }

    offset = end;
  }

  return segments;
}

/**
 * The text either side of a segment, for the reader to take its tone from.
 *
 * This is the technique the long-form speech platforms document: a segment
 * rendered in ignorance of its neighbours starts cold and closes off, so a long
 * reading arrives as a series of separate announcements. Given the words that
 * come before and after — to be read from, not read out — the delivery carries
 * across the join.
 */
export function getReadAloudNeighbourText(
  segments: ReadAloudSegment[],
  index: number,
  characters = 240
): { nextText: string; previousText: string } {
  const previous = segments[index - 1];
  const next = segments[index + 1];

  return {
    nextText: next ? next.text.slice(0, characters).trim() : '',
    previousText: previous ? previous.text.slice(-characters).trim() : ''
  };
}
