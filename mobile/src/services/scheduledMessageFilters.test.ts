import { describe, expect, it } from 'vitest';
import {
  EMPTY_SCHEDULED_MESSAGE_FILTERS,
  filterTenantScheduledMessages,
  listScheduledMessageDepartments
} from './scheduledMessageFilters';

const NOW = new Date(2026, 8, 7, 12, 0);
const DAY = 24 * 60 * 60 * 1000;

const message = (overrides: Record<string, unknown> = {}) => ({
  chatType: 'DIRECT',
  conversationId: 'chat',
  createdAt: null,
  departmentId: 'dept_bakery',
  departmentName: 'Bakery',
  recipientName: 'Ben Adeyemi',
  recipientUid: 'ben',
  releaseAt: '',
  releaseAtMs: NOW.getTime() + (2 * 60 * 60 * 1000),
  scheduledMessageId: 'id',
  senderName: 'Anna Okafor',
  senderUid: 'anna',
  status: 'SCHEDULED',
  timeZone: 'UTC',
  ...overrides
}) as Parameters<typeof filterTenantScheduledMessages>[0][number];

const filter = (overrides = {}) => ({ ...EMPTY_SCHEDULED_MESSAGE_FILTERS, ...overrides });

describe('narrowing the waiting list', () => {
  it('returns everything when nothing is asked for', () => {
    const all = [message({ scheduledMessageId: 'a' }), message({ scheduledMessageId: 'b' })];

    expect(filterTenantScheduledMessages(all, filter(), NOW)).toHaveLength(2);
  });

  it('finds a person by part of their name', () => {
    expect(filterTenantScheduledMessages([message({})], filter({ search: 'okafor' }), NOW)).toHaveLength(1);
  });

  it('finds the person a message is going to, not only who wrote it', () => {
    expect(filterTenantScheduledMessages([message({})], filter({ search: 'ben' }), NOW)).toHaveLength(1);
  });

  it('finds a team by its name', () => {
    expect(filterTenantScheduledMessages([message({})], filter({ search: 'bakery' }), NOW)).toHaveLength(1);
  });

  it('ignores capitals, because nobody searches in lower case on purpose', () => {
    expect(filterTenantScheduledMessages([message({})], filter({ search: 'ANNA' }), NOW)).toHaveLength(1);
  });

  it('finds nothing for a name nobody has', () => {
    expect(filterTenantScheduledMessages([message({})], filter({ search: 'zzz' }), NOW)).toHaveLength(0);
  });

  it('narrows to one department', () => {
    const all = [message({}), message({ departmentId: 'dept_safety', departmentName: 'Safety' })];

    expect(filterTenantScheduledMessages(all, filter({ departmentId: 'dept_safety' }), NOW))
      .toHaveLength(1);
  });

  it('applies a search and a department together, not one or the other', () => {
    const all = [
      message({ senderName: 'Anna Okafor' }),
      message({ departmentId: 'dept_safety', departmentName: 'Safety', senderName: 'Anna Bello' })
    ];
    const found = filterTenantScheduledMessages(all, filter({ departmentId: 'dept_safety', search: 'anna' }), NOW);

    expect(found).toHaveLength(1);
    expect(found[0].senderName).toBe('Anna Bello');
  });
});

describe('narrowing by when it goes', () => {
  const at = (offsetMs: number) => message({ releaseAtMs: NOW.getTime() + offsetMs });

  it('finds today', () => {
    expect(filterTenantScheduledMessages([at(2 * 60 * 60 * 1000)], filter({ date: 'TODAY' }), NOW)).toHaveLength(1);
    expect(filterTenantScheduledMessages([at(DAY)], filter({ date: 'TODAY' }), NOW)).toHaveLength(0);
  });

  it('finds tomorrow', () => {
    expect(filterTenantScheduledMessages([at(DAY)], filter({ date: 'TOMORROW' }), NOW)).toHaveLength(1);
    expect(filterTenantScheduledMessages([at(2 * DAY)], filter({ date: 'TOMORROW' }), NOW)).toHaveLength(0);
  });

  it('finds the next seven days', () => {
    expect(filterTenantScheduledMessages([at(6 * DAY)], filter({ date: 'WEEK' }), NOW)).toHaveLength(1);
    expect(filterTenantScheduledMessages([at(8 * DAY)], filter({ date: 'WEEK' }), NOW)).toHaveLength(0);
  });

  it('finds what is further out than that', () => {
    expect(filterTenantScheduledMessages([at(20 * DAY)], filter({ date: 'LATER' }), NOW)).toHaveLength(1);
    expect(filterTenantScheduledMessages([at(2 * DAY)], filter({ date: 'LATER' }), NOW)).toHaveLength(0);
  });

  it('leaves every message alone when no date is chosen', () => {
    const spread = [at(60_000), at(DAY), at(30 * DAY)];

    expect(filterTenantScheduledMessages(spread, filter(), NOW)).toHaveLength(3);
  });
});

describe('the departments offered as filters', () => {
  it('lists each one once, in name order', () => {
    expect(listScheduledMessageDepartments([
      message({ departmentId: 'dept_safety', departmentName: 'Safety' }),
      message({ departmentId: 'dept_bakery', departmentName: 'Bakery' }),
      message({ departmentId: 'dept_safety', departmentName: 'Safety' })
    ])).toEqual([
      { id: 'dept_bakery', name: 'Bakery' },
      { id: 'dept_safety', name: 'Safety' }
    ]);
  });

  it('offers only departments that have something waiting', () => {
    // A filter that returns nothing is a filter nobody should be able to pick.
    expect(listScheduledMessageDepartments([message({})])).toEqual([
      { id: 'dept_bakery', name: 'Bakery' }
    ]);
  });

  it('leaves out anybody with no department rather than inventing one', () => {
    expect(listScheduledMessageDepartments([message({ departmentId: '' })])).toEqual([]);
  });
});
