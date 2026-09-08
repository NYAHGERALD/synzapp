import { describe, expect, it } from 'vitest';
import {
  describeActionLine,
  describeCounts,
  describeOwner,
  describePriority,
  describeStatus,
  filterActionsAfterChatCleared,
  isActionOutstanding,
  priorityColor,
  sortActionsForThread,
  statusColor,
  statusDotColor
} from './actionDisplay';
import type { ActionRecord } from './actionApi';

function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    actionId: 'action_1',
    attachmentCount: 0,
    blockedReason: null,
    bodyRemovedAtMs: null,
    cancellationReason: null,
    cancelledAtMs: null,
    cancelledByName: null,
    cancelledByUid: null,
    departmentIds: [],
    completedAtMs: null,
    completedByName: null,
    completedByUid: null,
    completionNote: null,
    createdAtMs: 1000,
    createdByName: 'Cara Operator',
    createdByUid: 'user_operator',
    dueAtMs: null,
    priority: 'MEDIUM',
    responsibleDepartmentId: 'dept_maintenance',
    responsibleGroupId: 'group_maintenance',
    responsibleGroupName: 'Maintenance',
    responsiblePersonName: null,
    responsiblePersonUid: null,
    sourceChatId: 'chat_line_5',
    sourceChatName: 'Line 5',
    sourceDepartmentId: 'dept_production',
    sourceMessageId: 'message_1',
    startedAtMs: null,
    status: 'OPEN',
    tenantId: 'tenant_a',
    title: 'Issue with tortillas on line 5',
    updatedAtMs: 1000,
    verifiedAtMs: null,
    verifiedByName: null,
    verifiedByUid: null,
    ...overrides
  };
}

describe('what an action says', () => {
  it('names every status in plain words', () => {
    expect(describeStatus('OPEN')).toBe('Open');
    expect(describeStatus('IN_PROGRESS')).toBe('In progress');
    expect(describeStatus('BLOCKED')).toBe('Blocked');
    expect(describeStatus('VERIFIED')).toBe('Verified');
  });

  it('says a completed action still needs verifying, rather than just Done', () => {
    expect(describeStatus('DONE')).toBe('Done, not verified');
  });

  it('names every priority', () => {
    expect(describePriority('CRITICAL')).toBe('Critical');
    expect(describePriority('LOW')).toBe('Low');
  });
});

describe('who owns an action', () => {
  it('names the person when there is one', () => {
    expect(describeOwner(action({ responsiblePersonName: 'Dev Fitter' }))).toBe('Dev Fitter');
  });

  it('never leaves the owner blank when nobody is named', () => {
    const owner = describeOwner(action());

    expect(owner).toContain('Maintenance');
    expect(owner).toContain('nobody named yet');
  });
});

describe('the line under the title', () => {
  it('puts the status and the owner together', () => {
    const line = describeActionLine(action({ responsiblePersonName: 'Dev Fitter' }));

    expect(line).toBe('Open · Dev Fitter');
  });

  it('shows what a blocked action is waiting on, not just that it is blocked', () => {
    const line = describeActionLine(action({
      blockedReason: 'Waiting on a drive belt',
      status: 'BLOCKED'
    }));

    expect(line).toContain('Waiting on a drive belt');
  });
});

describe('what still needs attention', () => {
  it('counts everything short of verified as outstanding', () => {
    expect(isActionOutstanding(action({ status: 'OPEN' }))).toBe(true);
    expect(isActionOutstanding(action({ status: 'DONE' }))).toBe(true);
  });

  it('stops counting once it is verified', () => {
    expect(isActionOutstanding(action({ status: 'VERIFIED' }))).toBe(false);
  });
});

describe('ordering in a conversation', () => {
  it('reads oldest first, like the messages around it', () => {
    const sorted = sortActionsForThread([
      action({ actionId: 'b', createdAtMs: 3000 }),
      action({ actionId: 'a', createdAtMs: 1000 }),
      action({ actionId: 'c', createdAtMs: 2000 })
    ]);

    expect(sorted.map((item) => item.actionId)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the list it was given alone', () => {
    const original = [
      action({ actionId: 'b', createdAtMs: 3000 }),
      action({ actionId: 'a', createdAtMs: 1000 })
    ];

    sortActionsForThread(original);

    expect(original.map((item) => item.actionId)).toEqual(['b', 'a']);
  });
});

describe('the counts bar wording', () => {
  it('says nothing at all when there is nothing outstanding', () => {
    expect(describeCounts(0, 0)).toBe('');
  });

  it('uses singular for one', () => {
    expect(describeCounts(1, 0)).toBe('1 action open');
    expect(describeCounts(0, 1)).toBe('1 waiting to be verified');
  });

  it('joins both numbers when both matter', () => {
    expect(describeCounts(3, 2)).toBe('3 actions open · 2 waiting to be verified');
  });
});

describe('colours in both themes', () => {
  it('gives every priority its own colour in light mode', () => {
    const colors = new Set([
      priorityColor('CRITICAL'),
      priorityColor('HIGH'),
      priorityColor('MEDIUM'),
      priorityColor('LOW')
    ]);

    expect(colors.size).toBe(4);
  });

  it('uses a different colour in dark mode, so it does not vanish on black', () => {
    expect(priorityColor('CRITICAL', true)).not.toBe(priorityColor('CRITICAL', false));
    expect(statusColor('VERIFIED', true)).not.toBe(statusColor('VERIFIED', false));
  });

  it('keeps every status distinguishable in dark mode too', () => {
    const colors = new Set([
      statusColor('OPEN', true),
      statusColor('IN_PROGRESS', true),
      statusColor('BLOCKED', true),
      statusColor('DONE', true),
      statusColor('VERIFIED', true)
    ]);

    expect(colors.size).toBe(5);
  });

  it('falls back rather than returning nothing for an unknown value', () => {
    expect(priorityColor('NONSENSE' as never)).toBe(priorityColor('MEDIUM'));
    expect(statusColor('NONSENSE' as never)).toBe(statusColor('OPEN'));
  });
});

describe('filterActionsAfterChatCleared', () => {
  function actionRaisedAt(createdAtMs: number): ActionRecord {
    return { actionId: `a_${createdAtMs}`, createdAtMs } as ActionRecord;
  }

  it('keeps everything when the chat was never cleared', () => {
    const actions = [actionRaisedAt(100), actionRaisedAt(200)];

    expect(filterActionsAfterChatCleared(actions, null)).toHaveLength(2);
  });

  it('drops the actions raised before the chat was deleted', () => {
    // Otherwise re-opening a deleted chat quotes the deleted messages back at
    // the person through the action bubbles.
    const actions = [actionRaisedAt(100), actionRaisedAt(5_000)];
    const kept = filterActionsAfterChatCleared(actions, new Date(1_000).toISOString());

    expect(kept.map((action) => action.createdAtMs)).toEqual([5_000]);
  });

  it('drops an action raised at the very moment of the delete', () => {
    const actions = [actionRaisedAt(1_000)];

    expect(filterActionsAfterChatCleared(actions, new Date(1_000).toISOString())).toEqual([]);
  });

  it('keeps actions raised after the chat was started again', () => {
    const actions = [actionRaisedAt(9_000)];

    expect(filterActionsAfterChatCleared(actions, new Date(1_000).toISOString())).toHaveLength(1);
  });

  it('shows everything rather than emptying the thread on an unreadable date', () => {
    const actions = [actionRaisedAt(100)];

    expect(filterActionsAfterChatCleared(actions, 'not a date')).toHaveLength(1);
  });
});

describe('a cancelled action', () => {
  it('is never described as open', () => {
    // The fall-through in describeStatus returned "Open" for anything it did
    // not name, so a cancelled action claimed to still need doing.
    expect(describeStatus('CANCELLED')).toBe('Cancelled');
  });

  it('is not counted as outstanding', () => {
    expect(isActionOutstanding(action({ status: 'CANCELLED' }))).toBe(false);
  });

  it('still counts work that is merely done as outstanding', () => {
    expect(isActionOutstanding(action({ status: 'DONE' }))).toBe(true);
  });

  it('has a colour of its own rather than borrowing open', () => {
    expect(statusColor('CANCELLED')).not.toBe(statusColor('OPEN'));
  });
});

describe('the dot beside an action in the list', () => {
  it('is green once the work is verified', () => {
    expect(statusDotColor('VERIFIED')).toBe('#1E8449');
  });

  it('is orange while the work is still owed', () => {
    expect(statusDotColor('OPEN')).toBe('#B7791F');
  });

  it('is red once the work has stopped', () => {
    expect(statusDotColor('CANCELLED')).toBe('#C0392B');
  });

  it('reads "done but not verified" as still owed, not as finished', () => {
    // DONE means the work is done and the verification is not. Green would say
    // it is closed, which is the one thing it is not.
    expect(statusDotColor('DONE')).toBe(statusDotColor('OPEN'));
    expect(statusDotColor('DONE')).not.toBe(statusDotColor('VERIFIED'));
  });

  it('groups blocked with cancelled, because both mean stopped', () => {
    expect(statusDotColor('BLOCKED')).toBe(statusDotColor('CANCELLED'));
  });

  it('uses three colours and no more, so a glance down the list is readable', () => {
    const statuses = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VERIFIED', 'CANCELLED'] as const;

    expect(new Set(statuses.map((status) => statusDotColor(status))).size).toBe(3);
  });

  it('has a distinct colour per meaning in dark mode too', () => {
    const statuses = ['OPEN', 'BLOCKED', 'VERIFIED'] as const;

    expect(new Set(statuses.map((status) => statusDotColor(status, true))).size).toBe(3);
    statuses.forEach((status) => {
      expect(statusDotColor(status, true)).not.toBe(statusDotColor(status));
    });
  });

  it('leaves the pill colours alone, which other screens still use', () => {
    // Cancelled is red as a dot and stays grey as a pill; changing statusColor
    // would have moved it in the bubble and the detail sheet as well.
    expect(statusColor('CANCELLED')).toBe('#8E8E93');
  });
});
