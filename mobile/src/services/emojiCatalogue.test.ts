import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, removeLastCharacter, searchEmojiGroups } from './emojiCatalogue';

describe('the emoji people can pick from', () => {
  it('has no duplicate emoji across the whole set', () => {
    // Two of the same in one grid looks like a mistake, and picking either
    // would be indistinguishable to whoever is looking at it.
    const all = EMOJI_GROUPS.flatMap((group) => group.options.map((option) => option.emoji));

    expect(all.length).toBe(new Set(all).size);
  });

  it('files searchable words against every one of them', () => {
    // An emoji with no words is one nobody can find except by scrolling.
    for (const group of EMOJI_GROUPS) {
      for (const option of group.options) {
        expect(option.keywords.trim()).not.toBe('');
      }
    }
  });
});

describe('finding an emoji', () => {
  it('gives back everything when nothing is typed', () => {
    expect(searchEmojiGroups('')).toBe(EMOJI_GROUPS);
    expect(searchEmojiGroups('   ')).toBe(EMOJI_GROUPS);
  });

  it('finds one by a word somebody would actually type', () => {
    const found = searchEmojiGroups('thanks').flatMap((group) => group.options.map((option) => option.emoji));

    expect(found).toContain('🙏');
  });

  it('finds one by the emoji itself, pasted in', () => {
    const found = searchEmojiGroups('🔥').flatMap((group) => group.options.map((option) => option.emoji));

    expect(found).toEqual(['🔥']);
  });

  it('finds a whole group by its name', () => {
    // "handshake" contains "hands", so a stray match from another group comes
    // back too. That is the search working, not failing: a word matching more
    // than one thing should show all of them.
    const hands = searchEmojiGroups('hands').find((group) => group.title === 'Hands');

    expect(hands?.options.length).toBeGreaterThan(10);
  });

  it('ignores capitals, because nobody searches in lower case on purpose', () => {
    expect(searchEmojiGroups('WARNING').length).toBeGreaterThan(0);
  });

  it('drops groups with nothing left rather than leaving a bare heading', () => {
    for (const group of searchEmojiGroups('celebrate')) {
      expect(group.options.length).toBeGreaterThan(0);
    }
  });

  it('gives back nothing findable for nonsense', () => {
    expect(searchEmojiGroups('qwertyuiop')).toEqual([]);
  });
});

describe('deleting the last character', () => {
  it('takes one ordinary letter', () => {
    expect(removeLastCharacter('Hello')).toBe('Hell');
  });

  it('takes a whole emoji, not half of one', () => {
    // The bug this exists for: 😀 is two units of text, so slicing one off
    // leaves a broken half that draws as a black diamond.
    expect(removeLastCharacter('Well done 😀')).toBe('Well done ');
  });

  it('takes a heart with its colour mark attached', () => {
    expect(removeLastCharacter('Thanks ❤️')).toBe('Thanks ');
  });

  it('takes a joined emoji in one press', () => {
    expect(removeLastCharacter('Finally 😮‍💨')).toBe('Finally ');
  });

  it('takes a skin tone with the hand it belongs to', () => {
    expect(removeLastCharacter('Nice 👍🏽')).toBe('Nice ');
  });

  it('empties a message of one emoji', () => {
    expect(removeLastCharacter('🎉')).toBe('');
  });

  it('copes with an empty message', () => {
    expect(removeLastCharacter('')).toBe('');
  });

  it('never leaves an unpaired half behind', () => {
    // Whatever it removes, what is left must still be text a phone can draw.
    let text = 'Ok 👍🏽 done ❤️ 😮‍💨 🎉';

    while (text.length) {
      text = removeLastCharacter(text);
      expect(text).toBe(text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, ''));
      expect(text).toBe(text.replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1'));
    }
  });
});
