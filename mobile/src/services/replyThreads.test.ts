import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './chatApi';
import { collectReplyIdsInMessages, describeReplyCount, getReplyAuthorName, isReply, markReplyGroups, mergeReplyIds } from './replyThreads';

function makeMessage(messageId: string, parentId?: string): ChatMessage {
  return {
    messageId,
    replyTo: parentId
      ? { messageId: parentId, senderUid: 'u1', sentAt: '2026-09-08T00:00:00Z', text: 'parent' }
      : null,
    senderUid: 'u1',
    sentAt: '2026-09-08T00:00:00Z',
    text: messageId
  } as ChatMessage;
}

describe('recognising a reply', () => {
  it('is one when it names a parent', () => {
    expect(isReply(makeMessage('b', 'a'))).toBe(true);
  });

  it('is not one otherwise', () => {
    expect(isReply(makeMessage('a'))).toBe(false);
  });
});

describe('grouping a run of replies', () => {
  it('opens and closes a group of one', () => {
    const [, reply] = markReplyGroups([makeMessage('a'), makeMessage('b', 'a')]);

    expect(reply.isGroupStart).toBe(true);
    expect(reply.isGroupEnd).toBe(true);
  });

  it('draws one wireframe copy for consecutive replies to the same message', () => {
    const marked = markReplyGroups([
      makeMessage('b', 'a'),
      makeMessage('c', 'a'),
      makeMessage('d', 'a')
    ]);

    expect(marked.map((item) => item.isGroupStart)).toEqual([true, false, false]);
    expect(marked.map((item) => item.isGroupEnd)).toEqual([false, false, true]);
  });

  it('starts a new group when the parent changes', () => {
    const marked = markReplyGroups([
      makeMessage('c', 'a'),
      makeMessage('d', 'b')
    ]);

    expect(marked.map((item) => item.isGroupStart)).toEqual([true, true]);
    expect(marked.map((item) => item.isGroupEnd)).toEqual([true, true]);
  });

  it('breaks the group when an ordinary message interrupts it', () => {
    const marked = markReplyGroups([
      makeMessage('b', 'a'),
      makeMessage('plain'),
      makeMessage('c', 'a')
    ]);

    expect(marked[0].isGroupEnd).toBe(true);
    expect(marked[1].isGroupStart).toBe(false);
    expect(marked[2].isGroupStart).toBe(true);
  });

  it('leaves ordinary messages out of any group', () => {
    const [item] = markReplyGroups([makeMessage('a')]);

    expect(item.isGroupStart).toBe(false);
    expect(item.isGroupEnd).toBe(false);
  });
});

describe('what the count says', () => {
  it('says nothing when nobody has replied', () => {
    expect(describeReplyCount(0)).toBe(null);
    expect(describeReplyCount(-3)).toBe(null);
  });

  it('counts one and many', () => {
    expect(describeReplyCount(1)).toBe('1 reply');
    expect(describeReplyCount(5)).toBe('5 replies');
  });
});

describe('counting replies', () => {
  it('collects the reply ids under each parent', () => {
    expect(collectReplyIdsInMessages([
      makeMessage('a'),
      makeMessage('b', 'a'),
      makeMessage('c', 'a'),
      makeMessage('d', 'z')
    ])).toEqual({ a: ['b', 'c'], z: ['d'] });
  });

  it('adds replies the store has not written yet', () => {
    // Nine stored, two just sent. The old code compared sizes and answered
    // nine, which is the undercount somebody sees the moment they reply.
    const stored = { a: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'] };
    const loaded = { a: ['r10', 'r11'] };

    expect(mergeReplyIds(stored, loaded)).toEqual({ a: 11 });
  });

  it('does not double count a reply both sources hold', () => {
    expect(mergeReplyIds({ a: ['r1', 'r2'] }, { a: ['r2', 'r3'] })).toEqual({ a: 3 });
  });

  it('keeps a parent the store knows about and nothing is loaded for', () => {
    expect(mergeReplyIds({ a: ['r1', 'r2'] }, {})).toEqual({ a: 2 });
  });

  it('keeps a parent only the loaded messages know about', () => {
    expect(mergeReplyIds({}, { a: ['r1'] })).toEqual({ a: 1 });
  });

  it('leaves out a parent with nothing on either side', () => {
    expect(mergeReplyIds({ a: [] }, { a: [] })).toEqual({});
  });
});

describe('getReplyAuthorName', () => {
  const members = new Map([
    ['uid-bilah', { displayName: 'Bilah Ahmed' }],
    ['uid-zenaida', { displayName: '  Zenaida Garcia  ' }]
  ]);

  it('names your own quoted message "You", in a one-to-one', () => {
    expect(getReplyAuthorName({
      contactName: 'Gerald Nyah',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: false,
      senderUid: 'uid-me'
    })).toBe('You');
  });

  it('names the other person in a one-to-one', () => {
    // The case from the report: the quotation gave no clue whose message it was.
    expect(getReplyAuthorName({
      contactName: 'Gerald Nyah',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: false,
      senderUid: 'uid-them'
    })).toBe('Gerald Nyah');
  });

  it('names the member, not the room, in a group', () => {
    expect(getReplyAuthorName({
      contactName: 'Line 3 Supervisors',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: true,
      senderUid: 'uid-bilah'
    })).toBe('Bilah Ahmed');
  });

  it('still says "You" in a group', () => {
    expect(getReplyAuthorName({
      contactName: 'Line 3 Supervisors',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: true,
      senderUid: 'uid-me'
    })).toBe('You');
  });

  it('names somebody who has left rather than leaving the quote unattributed', () => {
    expect(getReplyAuthorName({
      contactName: 'Line 3 Supervisors',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: true,
      senderUid: 'uid-gone'
    })).toBe('Former member');
  });

  it('trims whatever the directory stored', () => {
    expect(getReplyAuthorName({
      contactName: '  Gerald Nyah  ',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: false,
      senderUid: 'uid-them'
    })).toBe('Gerald Nyah');
    expect(getReplyAuthorName({
      contactName: 'Line 3 Supervisors',
      currentUid: 'uid-me',
      groupMemberByUid: members,
      isGroupChat: true,
      senderUid: 'uid-zenaida'
    })).toBe('Zenaida Garcia');
  });
});
