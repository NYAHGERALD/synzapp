import { describe, expect, it } from 'vitest';
import { buildScheduledChatStates } from './scheduledChatIndicators';

const message = (overrides: Record<string, unknown>) => ({
  contactId: 'anna',
  conversationId: 'chat',
  lastError: null,
  releaseAt: '',
  releaseAtMs: 0,
  scheduledMessageId: 'id',
  status: 'SCHEDULED',
  text: null,
  timeZone: 'UTC',
  ...overrides
}) as Parameters<typeof buildScheduledChatStates>[0][number];

describe('marking conversations on the chat list', () => {
  it('counts one waiting', () => {
    expect(buildScheduledChatStates([message({})])).toEqual({ anna: { failed: 0, waiting: 1 } });
  });

  it('counts a failure separately, because only one of them needs a person', () => {
    expect(buildScheduledChatStates([
      message({ scheduledMessageId: 'a' }),
      message({ scheduledMessageId: 'b', status: 'FAILED' })
    ])).toEqual({ anna: { failed: 1, waiting: 1 } });
  });

  it('keeps conversations apart', () => {
    expect(buildScheduledChatStates([
      message({ contactId: 'anna' }),
      message({ contactId: 'ben', status: 'FAILED' })
    ])).toEqual({
      anna: { failed: 0, waiting: 1 },
      ben: { failed: 1, waiting: 0 }
    });
  });

  it('ignores anything that is neither waiting nor failed', () => {
    expect(buildScheduledChatStates([message({ status: 'SENT' })])).toEqual({
      anna: { failed: 0, waiting: 0 }
    });
  });

  it('skips a record with no conversation on it rather than inventing one', () => {
    expect(buildScheduledChatStates([message({ contactId: '' })])).toEqual({});
  });

  it('copes with nothing', () => {
    expect(buildScheduledChatStates([])).toEqual({});
  });
});
