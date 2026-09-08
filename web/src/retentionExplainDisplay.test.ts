import { describe, expect, it } from 'vitest';
import type { ConversationRetentionExplanation } from './complianceApi';
import { describeConversation, describeOutcome, splitRules } from './retentionExplainDisplay';

const NOW = Date.UTC(2026, 7, 30);
const DAY = 24 * 60 * 60 * 1000;

function explanation(
  overrides: Partial<ConversationRetentionExplanation> = {}
): ConversationRetentionExplanation {
  return {
    blockingHoldCaseId: null,
    conversationId: 'chat-1',
    conversationKind: 'DIRECT',
    governingPolicyName: null,
    isOnHold: false,
    lastMessageAtMs: NOW - 100 * DAY,
    participantNames: ['Amara Obi', 'Tom Reid'],
    purgeAfterMs: null,
    rulesConsidered: [],
    steps: [],
    ...overrides
  };
}

describe('the answer comes first, in full', () => {
  it('a frozen chat says so and names the case', () => {
    const result = describeOutcome(explanation({
      blockingHoldCaseId: 'CASE-2026-14',
      isOnHold: true
    }), NOW);

    expect(result.headline).toContain('frozen for a legal case');
    expect(result.detail).toContain('CASE-2026-14');
    expect(result.detail).toContain('including an admin');
    expect(result.tone).toBe('safe');
  });

  it('a chat kept with no end date says exactly that', () => {
    const result = describeOutcome(explanation(), NOW);

    expect(result.headline).toBe('Kept, no deletion date');
    expect(result.tone).toBe('neutral');
  });

  it('a chat with a future date names the date and the rule', () => {
    const result = describeOutcome(explanation({
      governingPolicyName: 'Contractor chats',
      purgeAfterMs: NOW + 30 * DAY
    }), NOW);

    expect(result.headline).toMatch(/^Kept until /);
    expect(result.detail).toContain('Contractor chats');
  });

  it('an overdue chat warns, and says review comes first', () => {
    // It must not read as though deletion already happened, or as though it
    // happens without review.
    const result = describeOutcome(explanation({
      governingPolicyName: 'Ninety days',
      purgeAfterMs: NOW - 5 * DAY
    }), NOW);

    expect(result.headline).toBe('Due for deletion');
    expect(result.detail).toContain('Disposition review');
    expect(result.tone).toBe('danger');
  });

  it('a hold beats a deletion date', () => {
    // Precedence has to survive into the words, not only the engine.
    const result = describeOutcome(explanation({
      isOnHold: true,
      purgeAfterMs: NOW - 5 * DAY
    }), NOW);

    expect(result.headline).toContain('Kept');
    expect(result.tone).toBe('safe');
  });
});

describe('a chat is named by who is in it', () => {
  it('names both people in a direct chat', () => {
    expect(describeConversation(explanation())).toBe('Amara Obi and Tom Reid');
  });

  it('summarises a large group', () => {
    expect(describeConversation(explanation({
      conversationKind: 'GROUP',
      participantNames: ['A', 'B', 'C', 'D', 'E']
    }))).toBe('Group: A, B, C and 2 more');
  });

  it('falls back when nobody could be named', () => {
    expect(describeConversation(explanation({ participantNames: [] }))).toBe('Direct chat');
  });
});

describe('rules that did not apply are shown too', () => {
  it('separates the ones that reached this chat from the ones that did not', () => {
    const { applied, notApplied } = splitRules(explanation({
      rulesConsidered: [
        { applies: true, name: 'Org wide', reason: 'Covers every chat', state: 'ACTIVE' },
        { applies: false, name: 'Finance only', reason: 'Nobody in this chat is named', state: 'ACTIVE' }
      ]
    }));

    expect(applied.map((rule) => rule.name)).toEqual(['Org wide']);
    expect(notApplied.map((rule) => rule.name)).toEqual(['Finance only']);
  });
});
