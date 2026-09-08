import { describe, expect, it } from 'vitest';
import { isDepartmentChat, mustAlwaysAppearInChatList } from './departmentChatVisibility';

describe('recognising a department group', () => {
  it('is one when a group is the department default', () => {
    expect(isDepartmentChat({ chatType: 'GROUP', isDepartmentDefault: true })).toBe(true);
  });

  it('is not one for an ordinary group somebody made', () => {
    expect(isDepartmentChat({ chatType: 'GROUP', isDepartmentDefault: false })).toBe(false);
    expect(isDepartmentChat({ chatType: 'GROUP' })).toBe(false);
  });

  it('is not one for a direct chat, whatever the flag says', () => {
    expect(isDepartmentChat({ chatType: 'DIRECT', isDepartmentDefault: true })).toBe(false);
  });

  it('copes with nothing', () => {
    expect(isDepartmentChat(null)).toBe(false);
    expect(isDepartmentChat(undefined)).toBe(false);
  });
});

describe('what must always be listed', () => {
  it('lists a department group that has never had a message', () => {
    // The case that started this: a department is created, its group exists,
    // and nobody can find it because nothing has been said in it yet.
    expect(mustAlwaysAppearInChatList({ chatType: 'GROUP', isDepartmentDefault: true })).toBe(true);
  });

  it('does not force an ordinary empty group into the list', () => {
    expect(mustAlwaysAppearInChatList({ chatType: 'GROUP', isDepartmentDefault: false })).toBe(false);
  });

  it('does not force an empty direct chat into the list', () => {
    // Everybody in the company would otherwise appear as a chat.
    expect(mustAlwaysAppearInChatList({ chatType: 'DIRECT' })).toBe(false);
  });
});
