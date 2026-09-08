import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { policiesCoveringSubject, policyCoversSubject } from '../src/services/retentionScope.ts';

const conversation = {
  conversationId: 'chat-1',
  participantIds: ['user-1', 'user-2']
};

describe('a policy only reaches what it names', () => {
  it('an organization policy reaches everything', () => {
    assert.equal(policyCoversSubject(
      { scopeKind: 'organization', scopeTargets: [] },
      conversation
    ), true);
  });

  it('a named-people policy reaches a conversation those people are in', () => {
    assert.equal(policyCoversSubject(
      { scopeKind: 'user', scopeTargets: ['user-2'] },
      conversation
    ), true);
  });

  it('a named-people policy does not reach anyone else', () => {
    // This is the bug that mattered: chosen people were stored and ignored, so
    // a rule for three colleagues would have deleted everyone's chats.
    assert.equal(policyCoversSubject(
      { scopeKind: 'user', scopeTargets: ['user-9'] },
      conversation
    ), false);
  });

  it('a named-conversation policy matches on the conversation itself', () => {
    assert.equal(policyCoversSubject(
      { scopeKind: 'conversation', scopeTargets: ['chat-1'] },
      conversation
    ), true);
    assert.equal(policyCoversSubject(
      { scopeKind: 'conversation', scopeTargets: ['chat-2'] },
      conversation
    ), false);
  });

  it('a narrow policy naming nobody reaches nothing', () => {
    // The dangerous reading would be "no filter, so everything". An unfinished
    // rule must never become an organization-wide deletion.
    assert.equal(policyCoversSubject(
      { scopeKind: 'user', scopeTargets: [] },
      conversation
    ), false);
    assert.equal(policyCoversSubject(
      { scopeKind: 'conversation', scopeTargets: [] },
      conversation
    ), false);
  });

  it('ignores blank entries left by an empty line', () => {
    assert.equal(policyCoversSubject(
      { scopeKind: 'user', scopeTargets: ['', '  ', 'user-1'] },
      conversation
    ), true);
  });
});

describe('policiesCoveringSubject', () => {
  it('keeps only the policies that reach this conversation', () => {
    const kept = policiesCoveringSubject([
      { id: 'org', scopeKind: 'organization' as const, scopeTargets: [] },
      { id: 'mine', scopeKind: 'user' as const, scopeTargets: ['user-1'] },
      { id: 'other', scopeKind: 'user' as const, scopeTargets: ['user-9'] }
    ], conversation);

    assert.deepEqual(kept.map((policy) => policy.id), ['org', 'mine']);
  });
});
