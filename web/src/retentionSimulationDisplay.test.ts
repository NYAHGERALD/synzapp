import { describe, expect, it } from 'vitest';
import type { RetentionSimulation } from './complianceApi';
import {
  buildSimulationLines,
  describeAddedEffect,
  describeScanLimit,
  describeSimulationHeadline
} from './retentionSimulationDisplay';

function simulation(overrides: Partial<RetentionSimulation> = {}): RetentionSimulation {
  return {
    examined: 100,
    heldByLegalHold: 0,
    keptIndefinitely: 0,
    messagesAffectedNow: 0,
    newlyDueFromThisPolicy: 0,
    oldestAffectedAtMs: null,
    scanLimited: false,
    wouldDeleteLater: 0,
    wouldDeleteNow: 0,
    ...overrides
  };
}

describe('the headline states the consequence first', () => {
  it('warns plainly when data would be destroyed', () => {
    const text = describeSimulationHeadline(simulation({
      messagesAffectedNow: 12000,
      wouldDeleteNow: 340
    }));

    expect(text).toContain('340 chats');
    expect(text).toContain('12,000 messages');
    expect(text).toContain('cannot be undone');
  });

  it('says so when nothing would be deleted', () => {
    expect(describeSimulationHeadline(simulation())).toContain('would not delete anything');
  });

  it('separates "nothing today" from "nothing ever"', () => {
    // These mean very different things to somebody deciding whether to activate.
    const text = describeSimulationHeadline(simulation({ wouldDeleteLater: 50 }));

    expect(text).toContain('Nothing would be deleted today');
    expect(text).toContain('50 chats');
  });

  it('handles an organization with no conversations yet', () => {
    expect(describeSimulationHeadline(simulation({ examined: 0 })))
      .toContain('no conversations to apply this rule to');
  });
});

describe('the numbers say what each one means', () => {
  it('leads with the deletion count', () => {
    const lines = buildSimulationLines(simulation({
      messagesAffectedNow: 900,
      wouldDeleteNow: 12
    }));

    expect(lines[0].isPrimary).toBe(true);
    expect(lines[0].tone).toBe('danger');
    expect(lines[0].value).toBe('12 chats (900 messages)');
  });

  it('reads as safe when nothing would go', () => {
    const lines = buildSimulationLines(simulation());

    expect(lines[0].tone).toBe('safe');
    expect(lines[0].value).toBe('Nothing');
  });

  it('shows legal holds only when there are some', () => {
    // A zero here would reassure about something never asked about.
    expect(buildSimulationLines(simulation()).some((line) => /legal hold/i.test(line.label)))
      .toBe(false);

    const withHold = buildSimulationLines(simulation({ heldByLegalHold: 7 }));
    const holdLine = withHold.find((line) => /legal hold/i.test(line.label));

    expect(holdLine?.value).toBe('7 chats');
    expect(holdLine?.tone).toBe('safe');
  });

  it('uses singular wording for one chat', () => {
    const lines = buildSimulationLines(simulation({ messagesAffectedNow: 1, wouldDeleteNow: 1 }));

    expect(lines[0].value).toBe('1 chat (1 message)');
  });
});

describe('what this rule adds, versus what was already happening', () => {
  it('says when the rule changes nothing', () => {
    expect(describeAddedEffect(simulation({ newlyDueFromThisPolicy: 0, wouldDeleteNow: 10 })))
      .toContain('adds nothing new');
  });

  it('says when the rule causes all of it', () => {
    expect(describeAddedEffect(simulation({ newlyDueFromThisPolicy: 10, wouldDeleteNow: 10 })))
      .toContain('All of these become due because of this rule');
  });

  it('splits the two when it is a mix', () => {
    expect(describeAddedEffect(simulation({ newlyDueFromThisPolicy: 4, wouldDeleteNow: 10 })))
      .toContain('4 chats of these');
  });

  it('stays quiet when nothing would be deleted', () => {
    expect(describeAddedEffect(simulation())).toBeNull();
  });
});

describe('an incomplete count says so', () => {
  it('warns that the real numbers are higher', () => {
    expect(describeScanLimit(simulation({ scanLimited: true })))
      .toContain('higher than those shown');
  });

  it('stays quiet when the count is complete', () => {
    expect(describeScanLimit(simulation())).toBeNull();
  });
});
