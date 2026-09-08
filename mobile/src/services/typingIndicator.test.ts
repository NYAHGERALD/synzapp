import { describe, expect, it } from 'vitest';
import {
  TYPING_STALE_AFTER_MS,
  applyTypingUpdate,
  describeGroupTypingRow,
  describeTyping,
  describeTypingForChatList
} from './typingIndicator';

const NOW = 1_000_000;
const at = (uid: string, name: string, ageMs = 0) => ({
  name,
  startedAtMs: NOW - ageMs,
  uid
});

describe('what a direct chat says', () => {
  it('says nothing when nobody is typing', () => {
    expect(describeTyping({ isGroup: false, nowMs: NOW, participants: [] })).toBeNull();
  });

  it('does not repeat the name back under the name', () => {
    // The header already says who this chat is with; naming them again reads
    // as a stutter.
    expect(describeTyping({ isGroup: false, nowMs: NOW, participants: [at('anna', 'Anna Okafor')] }))
      .toBe('typing…');
  });
});

describe('what a group says', () => {
  const group = (participants: ReturnType<typeof at>[]) =>
    describeTyping({ isGroup: true, nowMs: NOW, participants });

  it('names one person', () => {
    expect(group([at('anna', 'Anna Okafor')])).toBe('Anna is typing…');
  });

  it('names two', () => {
    expect(group([at('anna', 'Anna Okafor'), at('ben', 'Ben Adeyemi')]))
      .toBe('Anna and Ben are typing…');
  });

  it('counts beyond two rather than running off the line', () => {
    expect(group([
      at('anna', 'Anna Okafor'),
      at('ben', 'Ben Adeyemi'),
      at('cara', 'Cara Diaz'),
      at('dan', 'Dan Ekwe')
    ])).toBe('Anna, Ben and 2 more are typing…');
  });

  it('reads names in the order they started typing', () => {
    // Not the order the socket happened to deliver them in.
    expect(group([at('ben', 'Ben Adeyemi', 100), at('anna', 'Anna Okafor', 900)]))
      .toBe('Anna and Ben are typing…');
  });

  it('uses first names, because a row has one line', () => {
    expect(group([at('anna', 'Anna Okafor')])).not.toContain('Okafor');
  });

  it('copes with somebody who has no name on file', () => {
    expect(group([at('x', '   ')])).toBe('Someone is typing…');
  });
});

describe('a notice that was never cleared', () => {
  it('is ignored once it is stale', () => {
    // A phone that lost signal mid-word never sends the stop. Without this,
    // "typing…" is a state somebody gets stuck in.
    expect(describeTyping({
      isGroup: false,
      nowMs: NOW,
      participants: [at('anna', 'Anna', TYPING_STALE_AFTER_MS + 1)]
    })).toBeNull();
  });

  it('is still trusted just inside the window', () => {
    expect(describeTyping({
      isGroup: false,
      nowMs: NOW,
      participants: [at('anna', 'Anna', TYPING_STALE_AFTER_MS - 1)]
    })).toBe('typing…');
  });

  it('drops only the stale one, keeping the rest', () => {
    expect(describeTyping({
      isGroup: true,
      nowMs: NOW,
      participants: [at('anna', 'Anna', TYPING_STALE_AFTER_MS + 1), at('ben', 'Ben')]
    })).toBe('Ben is typing…');
  });
});

describe('the chat list row, which has one line to share', () => {
  it('keeps it short in a direct chat', () => {
    expect(describeTypingForChatList({ isGroup: false, nowMs: NOW, participants: [at('a', 'Anna')] }))
      .toBe('typing…');
  });

  it('names one person in a group', () => {
    expect(describeTypingForChatList({ isGroup: true, nowMs: NOW, participants: [at('a', 'Anna Okafor')] }))
      .toBe('Anna is typing…');
  });

  it('stops naming once more than one is typing', () => {
    // Two names plus a timestamp plus an unread badge does not fit.
    expect(describeTypingForChatList({
      isGroup: true,
      nowMs: NOW,
      participants: [at('a', 'Anna'), at('b', 'Ben')]
    })).toBe('typing…');
  });

  it('says nothing when nobody is typing', () => {
    expect(describeTypingForChatList({ isGroup: true, nowMs: NOW, participants: [] })).toBeNull();
  });
});

describe('keeping track of who is typing', () => {
  it('adds somebody', () => {
    const next = applyTypingUpdate([], { isTyping: true, name: 'Anna', nowMs: NOW, uid: 'anna' });

    expect(next).toHaveLength(1);
    expect(next[0].uid).toBe('anna');
  });

  it('removes somebody who stopped', () => {
    expect(applyTypingUpdate([at('anna', 'Anna')], {
      isTyping: false, name: 'Anna', nowMs: NOW, uid: 'anna'
    })).toEqual([]);
  });

  it('renews the clock without changing the order', () => {
    const before = [at('anna', 'Anna', 500), at('ben', 'Ben', 100)];
    const after = applyTypingUpdate(before, { isTyping: true, name: 'Ben', nowMs: NOW, uid: 'ben' });

    expect(after.map((participant) => participant.uid)).toEqual(['anna', 'ben']);
    expect(after[1].startedAtMs).toBe(NOW);
  });

  it('returns the very same array when nothing changed', () => {
    // The server renews every few seconds. Returning a new array each time
    // would re-render three screens for no reason.
    const before = [at('anna', 'Anna')];

    expect(applyTypingUpdate(before, {
      isTyping: false, name: 'Ben', nowMs: NOW, uid: 'ben'
    })).toBe(before);
  });

  it('never lists the same person twice', () => {
    let list = applyTypingUpdate([], { isTyping: true, name: 'Anna', nowMs: NOW, uid: 'anna' });
    list = applyTypingUpdate(list, { isTyping: true, name: 'Anna', nowMs: NOW + 10, uid: 'anna' });

    expect(list).toHaveLength(1);
  });
});

describe('the row shown inside a group thread', () => {
  const row = (participants: ReturnType<typeof at>[]) =>
    describeGroupTypingRow({ nowMs: NOW, participants });

  it('says nothing when nobody is typing', () => {
    expect(row([])).toBeNull();
  });

  it('uses the full name, because the row has space and a face beside it', () => {
    // "Anna" is ambiguous between two colleagues; this row can afford both words.
    expect(row([at('anna', 'Gerald Nyah')])?.text).toBe('Gerald Nyah is typing');
  });

  it('names two', () => {
    expect(row([at('a', 'Gerald Nyah'), at('b', 'Ben Adeyemi')])?.text)
      .toBe('Gerald Nyah and Ben Adeyemi are typing');
  });

  it('counts beyond two rather than listing everyone', () => {
    expect(row([at('a', 'Gerald Nyah'), at('b', 'Ben Adeyemi'), at('c', 'Cara Diaz')])?.text)
      .toBe('Gerald Nyah and 2 others are typing');
  });

  it('never returns more than two faces to draw', () => {
    // A third avatar makes the row taller than a message bubble.
    expect(row([at('a', 'A A'), at('b', 'B B'), at('c', 'C C'), at('d', 'D D')])?.typists)
      .toHaveLength(2);
  });

  it('draws them in the order they started typing', () => {
    expect(row([at('b', 'Ben Adeyemi', 100), at('a', 'Gerald Nyah', 900)])?.typists
      .map((typist) => typist.uid)).toEqual(['a', 'b']);
  });

  it('ignores a stale notice', () => {
    expect(row([at('a', 'Gerald Nyah', TYPING_STALE_AFTER_MS + 1)])).toBeNull();
  });
});
