import { describe, expect, it } from 'vitest';
import { buildActionAttentionBanner } from './actionAttentionBanner';

const counts = (overrides = {}) => ({
  awaitingVerification: 0,
  open: 0,
  overdue: 0,
  ...overrides
});

describe('the line above the chat list', () => {
  it('says nothing when there is nothing', () => {
    // A line showing zeroes is a line the eye stops reading, and then it is
    // worthless on the day it matters.
    expect(buildActionAttentionBanner(counts())).toBeNull();
  });

  it('says nothing before the counts have loaded', () => {
    expect(buildActionAttentionBanner(null)).toBeNull();
  });

  it('names overdue first, because that is the part that needs today', () => {
    expect(buildActionAttentionBanner(counts({ open: 3, overdue: 1 }))?.text)
      .toBe('1 overdue · 3 open');
  });

  it('includes work waiting to be verified', () => {
    expect(buildActionAttentionBanner(counts({ awaitingVerification: 2, open: 1 }))?.text)
      .toBe('1 open · 2 to verify');
  });

  it('leaves out whatever is zero', () => {
    expect(buildActionAttentionBanner(counts({ open: 4 }))?.text).toBe('4 open');
  });

  it('marks itself urgent only when something is late', () => {
    expect(buildActionAttentionBanner(counts({ overdue: 1 }))?.isUrgent).toBe(true);
    expect(buildActionAttentionBanner(counts({ awaitingVerification: 9, open: 9 }))?.isUrgent).toBe(false);
  });

  it('stays short enough for one line', () => {
    const banner = buildActionAttentionBanner(counts({ awaitingVerification: 12, open: 34, overdue: 56 }));

    expect(banner?.text.length).toBeLessThan(40);
  });
});
