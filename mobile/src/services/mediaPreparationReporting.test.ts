import { describe, expect, it } from 'vitest';

import {
  MEDIA_PREPARATION_PROGRESS_STEP,
  createMediaPreparationReportState,
  markMediaPreparationReported,
  shouldReportMediaPreparation
} from './mediaPreparationReporting';

const report = (progress: number, nowMs: number, state = createMediaPreparationReportState(), isTerminal = false) =>
  shouldReportMediaPreparation({ isTerminal, nowMs, progress, state });

describe('how often preparation is reported', () => {
  it('always reports the first event, so the ring stops spinning early', () => {
    expect(report(0.001, 0)).toBe(true);
  });

  it('drops a change too small to see', () => {
    // Android raises one of these per 8 KB. A 4 MB photo is five hundred.
    const state = createMediaPreparationReportState();

    markMediaPreparationReported(state, 0.5, 1000);

    expect(shouldReportMediaPreparation({ isTerminal: false, nowMs: 1010, progress: 0.502, state })).toBe(false);
  });

  it('reports once the change is worth drawing', () => {
    const state = createMediaPreparationReportState();

    markMediaPreparationReported(state, 0.5, 1000);

    expect(shouldReportMediaPreparation({
      isTerminal: false,
      nowMs: 1010,
      progress: 0.5 + MEDIA_PREPARATION_PROGRESS_STEP,
      state
    })).toBe(true);
  });

  it('still ticks on a slow copy, so it does not look stalled', () => {
    const state = createMediaPreparationReportState();

    markMediaPreparationReported(state, 0.5, 1000);

    expect(shouldReportMediaPreparation({ isTerminal: false, nowMs: 1300, progress: 0.501, state })).toBe(true);
  });

  it('never drops a terminal event, whatever the numbers say', () => {
    /**
     * It is the one that leaves the stored row final. Dropping it would leave a
     * queue item saying "preparing" for ever.
     */
    const state = createMediaPreparationReportState();

    markMediaPreparationReported(state, 0.99, 1000);

    expect(shouldReportMediaPreparation({ isTerminal: true, nowMs: 1001, progress: 0.99, state })).toBe(true);
  });
});
