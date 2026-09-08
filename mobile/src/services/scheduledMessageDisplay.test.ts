import { describe, expect, it } from 'vitest';
import { describeScheduledCounts } from './scheduledMessageDisplay';

/**
 * What the banner above the composer says.
 *
 * This exists because the first version said "1 message scheduled" for a
 * message that had already been sent, and would have said the same for one that
 * failed. A count is the one thing on that line, so it has to be the truth.
 */

describe('describing what is outstanding', () => {
  it('counts one waiting', () => {
    expect(describeScheduledCounts(1, 0)).toBe('1 message waiting');
  });

  it('counts several waiting', () => {
    expect(describeScheduledCounts(3, 0)).toBe('3 messages waiting');
  });

  it('says plainly when one could not be sent', () => {
    // Never "1 message waiting" — nothing is waiting, it has already failed.
    expect(describeScheduledCounts(0, 1)).toBe('1 message could not be sent');
  });

  it('says plainly when several could not be sent', () => {
    expect(describeScheduledCounts(0, 2)).toBe('2 messages could not be sent');
  });

  it('says both, rather than hiding the failure inside a total', () => {
    expect(describeScheduledCounts(2, 1)).toBe('2 messages waiting, 1 could not be sent');
  });

  it('never lets a failure go unmentioned', () => {
    for (const waiting of [0, 1, 5]) {
      for (const failed of [1, 2]) {
        expect(describeScheduledCounts(waiting, failed)).toMatch(/could not be sent/);
      }
    }
  });
});
