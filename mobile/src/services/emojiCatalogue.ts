/**
 * The emoji people can pick from, and how a search finds one.
 *
 * One list, used in both places emoji are chosen: reacting to somebody's
 * message, and writing your own. It was written for reactions first and then
 * copied nowhere — a second copy would drift, and the day somebody adds an
 * emoji to one list is the day the two stop agreeing.
 *
 * The set is deliberately a working set rather than every emoji Unicode
 * defines. A grid of three thousand is not something anybody scrolls; these are
 * the ones people reach for at work, grouped so a thumb can find them, and each
 * carries the words somebody would actually search it by ("done", "risk",
 * "thanks") rather than only its official name.
 */

export interface EmojiOption {
  emoji: string;
  keywords: string;
}

export interface EmojiGroup {
  options: EmojiOption[];
  title: string;
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    title: 'Frequently used',
    options: [
      { emoji: '👏', keywords: 'clap applause well done' },
      { emoji: '👍', keywords: 'thumbs up agree approved good' },
      { emoji: '❤️', keywords: 'heart love appreciate' },
      { emoji: '😂', keywords: 'laugh funny joy' },
      { emoji: '😮', keywords: 'surprised wow shocked' },
      { emoji: '😢', keywords: 'sad sorry empathy' },
      { emoji: '🙏', keywords: 'thanks prayer please' },
      { emoji: '✅', keywords: 'done complete approved check' },
      { emoji: '💡', keywords: 'idea insight suggestion' }
    ]
  },
  {
    title: 'Smileys',
    options: [
      { emoji: '😀', keywords: 'smile happy' },
      { emoji: '😃', keywords: 'happy smile' },
      { emoji: '😄', keywords: 'happy smile grin' },
      { emoji: '😁', keywords: 'grin pleased' },
      { emoji: '😆', keywords: 'laugh excited' },
      { emoji: '🥹', keywords: 'touched grateful emotional' },
      { emoji: '😊', keywords: 'warm smile pleased' },
      { emoji: '😇', keywords: 'kind innocent' },
      { emoji: '🙂', keywords: 'smile okay' },
      { emoji: '🙃', keywords: 'playful upside down' },
      { emoji: '😉', keywords: 'wink playful' },
      { emoji: '😌', keywords: 'relieved calm' },
      { emoji: '😍', keywords: 'love impressed' },
      { emoji: '🥰', keywords: 'appreciate love' },
      { emoji: '😘', keywords: 'kiss thanks' },
      { emoji: '😗', keywords: 'kiss' },
      { emoji: '😙', keywords: 'kiss smile' },
      { emoji: '😋', keywords: 'nice playful' },
      { emoji: '😛', keywords: 'playful fun' },
      { emoji: '😜', keywords: 'playful wink' },
      { emoji: '🤪', keywords: 'silly playful' },
      { emoji: '🤨', keywords: 'question skeptical' },
      { emoji: '🧐', keywords: 'inspect review curious' },
      { emoji: '🤓', keywords: 'smart detail' },
      { emoji: '😎', keywords: 'cool confident' },
      { emoji: '🥳', keywords: 'celebrate party' },
      { emoji: '😏', keywords: 'smirk' },
      { emoji: '😒', keywords: 'unimpressed' },
      { emoji: '😞', keywords: 'disappointed' },
      { emoji: '😔', keywords: 'sad thoughtful' },
      { emoji: '😟', keywords: 'concerned worried' },
      { emoji: '😕', keywords: 'confused unsure' },
      { emoji: '🙁', keywords: 'sad' },
      { emoji: '☹️', keywords: 'sad' },
      { emoji: '😣', keywords: 'frustrated' },
      { emoji: '😖', keywords: 'confused frustrated' },
      { emoji: '😫', keywords: 'tired frustrated' },
      { emoji: '😤', keywords: 'determined annoyed' },
      { emoji: '😡', keywords: 'angry' },
      { emoji: '🤯', keywords: 'mind blown surprised' },
      { emoji: '😳', keywords: 'embarrassed surprised' },
      { emoji: '🥶', keywords: 'cold frozen' },
      { emoji: '😱', keywords: 'shocked scared' },
      { emoji: '😨', keywords: 'worried' },
      { emoji: '😰', keywords: 'anxious' },
      { emoji: '😭', keywords: 'cry sad' },
      { emoji: '😶', keywords: 'silent no comment' },
      { emoji: '😐', keywords: 'neutral' },
      { emoji: '😑', keywords: 'expressionless' },
      { emoji: '😬', keywords: 'awkward' },
      { emoji: '🙄', keywords: 'eyes roll' },
      { emoji: '😯', keywords: 'surprised' },
      { emoji: '😦', keywords: 'concerned' },
      { emoji: '😧', keywords: 'anguished' },
      { emoji: '😮‍💨', keywords: 'relieved sigh' },
      { emoji: '🤔', keywords: 'thinking question' },
      { emoji: '🤫', keywords: 'quiet secret' },
      { emoji: '🤭', keywords: 'oops laugh' },
      { emoji: '🫡', keywords: 'salute respect' },
      { emoji: '🤝', keywords: 'agreement handshake' }
    ]
  },
  {
    title: 'Hands',
    options: [
      { emoji: '🙌', keywords: 'celebrate hands' },
      { emoji: '👌', keywords: 'ok perfect' },
      { emoji: '🤌', keywords: 'precision details' },
      { emoji: '🤏', keywords: 'small little' },
      { emoji: '✌️', keywords: 'peace two' },
      { emoji: '🤞', keywords: 'hope fingers crossed' },
      { emoji: '🤟', keywords: 'support love' },
      { emoji: '🤘', keywords: 'rock strong' },
      { emoji: '👊', keywords: 'support fist bump' },
      { emoji: '✊', keywords: 'strength' },
      { emoji: '🤛', keywords: 'fist left' },
      { emoji: '🤜', keywords: 'fist right' },
      { emoji: '👋', keywords: 'wave hello' },
      { emoji: '🤚', keywords: 'stop hand' },
      { emoji: '🖐️', keywords: 'hand five' },
      { emoji: '✋', keywords: 'stop hand' },
      { emoji: '🖖', keywords: 'hello hand' },
      { emoji: '👈', keywords: 'left point' },
      { emoji: '👉', keywords: 'right point' },
      { emoji: '👆', keywords: 'up point' },
      { emoji: '👇', keywords: 'down point' },
      { emoji: '☝️', keywords: 'one point' },
      { emoji: '✍️', keywords: 'write note' },
      { emoji: '💪', keywords: 'strong strength' }
    ]
  },
  {
    title: 'Signals',
    options: [
      { emoji: '⭐', keywords: 'star important' },
      { emoji: '🔥', keywords: 'fire strong hot' },
      { emoji: '💯', keywords: 'hundred perfect' },
      { emoji: '🎉', keywords: 'celebrate success' },
      { emoji: '✨', keywords: 'sparkle clean' },
      { emoji: '⚠️', keywords: 'warning attention risk' },
      { emoji: '❗', keywords: 'important' },
      { emoji: '❓', keywords: 'question help' },
      { emoji: '💬', keywords: 'comment message' },
      { emoji: '👀', keywords: 'seen looking review' },
      { emoji: '📌', keywords: 'pin important' },
      { emoji: '📎', keywords: 'attachment file' },
      { emoji: '📝', keywords: 'note write' },
      { emoji: '📣', keywords: 'announce' },
      { emoji: '⏳', keywords: 'waiting pending' },
      { emoji: '⌛', keywords: 'time waiting' },
      { emoji: '🚧', keywords: 'work progress caution' },
      { emoji: '🔒', keywords: 'locked secure' },
      { emoji: '🔓', keywords: 'unlocked open' },
      { emoji: '📍', keywords: 'location pin' },
      { emoji: '🔍', keywords: 'search inspect' },
      { emoji: '📈', keywords: 'progress trend up' },
      { emoji: '📉', keywords: 'trend down' },
      { emoji: '🟢', keywords: 'green good active' },
      { emoji: '🟡', keywords: 'yellow caution pending' },
      { emoji: '🔴', keywords: 'red stop issue' }
    ]
  }
];

/**
 * The groups that still have something in them for this search.
 *
 * Matches on the emoji itself, on the words filed against it, and on the group
 * name, so "hands" brings back the hands and "risk" brings back the warning
 * sign. An empty search is not a search: the whole list comes back untouched.
 *
 * Empty groups are dropped rather than left as bare headings over nothing.
 */
export function searchEmojiGroups(query: string, groups: EmojiGroup[] = EMOJI_GROUPS): EmojiGroup[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return groups;
  }

  const normalized = trimmed.toLowerCase();

  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => (
        option.emoji.includes(trimmed) ||
        option.keywords.includes(normalized) ||
        group.title.toLowerCase().includes(normalized)
      ))
    }))
    .filter((group) => group.options.length > 0);
}

/**
 * The text with its last character removed, where "character" means what a
 * person sees.
 *
 * A naive `slice(0, -1)` is wrong on anything but plain letters. An emoji is
 * rarely one unit of text: 😀 is a surrogate pair, ❤️ is a heart plus an
 * invisible mark asking for the coloured form, and 😮‍💨 is two faces joined by
 * a zero-width joiner. Cutting one unit off the end leaves half a character
 * behind, which draws as a black diamond or as a different emoji entirely — so
 * the backspace beside an emoji grid has to count the way eyes do.
 *
 * `Intl.Segmenter` knows the real rules and is used when the phone has it.
 * Where it is missing the fallback walks backwards over the joiners, the
 * variation marks, the skin-tone modifiers and the surrogate pairs by hand,
 * which covers everything in this catalogue.
 */
export function removeLastCharacter(text: string): string {
  if (!text) {
    return '';
  }

  const segmenter = getGraphemeSegmenter();

  if (segmenter) {
    const graphemes = [...segmenter.segment(text)];
    const last = graphemes[graphemes.length - 1];

    return last ? text.slice(0, last.index) : '';
  }

  let end = text.length;

  // Walk back over one whole visible character: any number of joined pieces,
  // each of which may itself be a surrogate pair.
  while (end > 0) {
    end -= isLowSurrogateAt(text, end - 1) ? 2 : 1;

    const previous = text.codePointAt(end - 1);

    // Keep going while what stands before is glue rather than a character:
    // a zero-width joiner, a variation selector, a skin tone or a combining
    // mark all belong to the same thing the reader sees.
    if (previous === undefined || !isJoiningCodePoint(previous)) {
      break;
    }

    end -= previous > 0xFFFF ? 2 : 1;
  }

  return text.slice(0, Math.max(end, 0));
}

let graphemeSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter === undefined) {
    try {
      graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
    } catch {
      graphemeSegmenter = null;
    }
  }

  return graphemeSegmenter;
}

function isLowSurrogateAt(text: string, index: number): boolean {
  const code = text.charCodeAt(index);

  return code >= 0xDC00 && code <= 0xDFFF && index > 0;
}

function isJoiningCodePoint(codePoint: number): boolean {
  return codePoint === 0x200D ||
    (codePoint >= 0xFE00 && codePoint <= 0xFE0F) ||
    (codePoint >= 0x1F3FB && codePoint <= 0x1F3FF) ||
    (codePoint >= 0x0300 && codePoint <= 0x036F);
}
