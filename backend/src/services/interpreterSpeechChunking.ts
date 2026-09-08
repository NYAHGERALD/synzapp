/**
 * Splitting long text for text-to-speech.
 *
 * OpenAI's speech endpoint accepts at most 4096 characters in one request. The
 * interpreter sent whole transcripts and summaries in a single call with no
 * length check, so anything long simply failed — which is why the problem only
 * showed up on the longest and most valuable recordings.
 *
 * Splitting also makes long text much faster, because the pieces are generated
 * at the same time rather than one after another.
 *
 * Kept free of network calls so the splitting rules can be tested directly.
 */

/** The endpoint's own limit, with room for safety. */
export const MAX_SPEECH_INPUT_CHARACTERS = 3800;

/**
 * Splits text into pieces small enough to speak.
 *
 * Broken at paragraphs first, then sentences, then words — in that order,
 * because a cut in the middle of a sentence is audible. A listener hears the
 * join as a stumble, and on a legal or medical recording that sounds like the
 * recording itself is damaged.
 */
export function splitTextForSpeech(
  text: string,
  maxCharacters = MAX_SPEECH_INPUT_CHARACTERS
): string[] {
  const cleaned = text.trim();

  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= maxCharacters) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }

    current = '';
  };

  for (const paragraph of cleaned.split(/\n\s*\n/)) {
    const block = paragraph.trim();

    if (!block) {
      continue;
    }

    if (block.length > maxCharacters) {
      flush();

      for (const sentence of splitOversizedBlock(block, maxCharacters)) {
        if ((current + ' ' + sentence).trim().length > maxCharacters) {
          flush();
        }

        current = current ? `${current} ${sentence}` : sentence;
      }

      continue;
    }

    if ((current + '\n\n' + block).trim().length > maxCharacters) {
      flush();
    }

    current = current ? `${current}\n\n${block}` : block;
  }

  flush();

  return chunks;
}

/** Sentences, falling back to words for text with no sentence breaks. */
function splitOversizedBlock(block: string, maxCharacters: number): string[] {
  const sentences = block.match(/[^.!?。！？]+[.!?。！？]+["'”’)]*\s*|[^.!?。！？]+$/g) || [block];
  const parts: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.length <= maxCharacters) {
      parts.push(trimmed);

      continue;
    }

    // A single sentence longer than the limit. Unusual, but it happens with
    // transcripts that were never punctuated, and it must not be dropped.
    let remaining = trimmed;

    while (remaining.length > maxCharacters) {
      const cut = remaining.lastIndexOf(' ', maxCharacters);
      const at = cut > maxCharacters * 0.6 ? cut : maxCharacters;

      parts.push(remaining.slice(0, at).trim());
      remaining = remaining.slice(at).trim();
    }

    if (remaining) {
      parts.push(remaining);
    }
  }

  return parts;
}

/**
 * Runs the pieces a few at a time.
 *
 * All at once would be faster still, but a long recording can produce dozens of
 * pieces and firing every one of them together gets the account rate limited —
 * which fails the whole recording rather than making it slow.
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;

      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      // Written back by index, so the pieces stay in the order they were spoken
      // however they finish. Out-of-order audio would be worse than slow audio.
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);

  return results;
}
