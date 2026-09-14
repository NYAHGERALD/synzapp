/**
 * How often a native preparation event is allowed to reach the app.
 *
 * Android copies a picked photo out of the content provider in 8 KB chunks and
 * raises a bridge event after every one. A 4 MB photo is about five hundred of
 * them, and each one used to redraw the progress ring and write a row to
 * SQLite — a row whose payload carries the attachment, base64 thumbnail
 * included. That flood is most of why sending a photo felt slow on Android and
 * did not on iOS, where the same copy arrives in a handful of callbacks.
 *
 * Nothing is lost by reporting less often. A ring cannot show a difference of
 * a fifth of a percent, and the stored row only has to be right when something
 * asks for it — which is after the last event, not during.
 *
 * No native imports, so the rule can be tested.
 */

/** Below this, a change is invisible on a ring a few millimetres across. */
export const MEDIA_PREPARATION_PROGRESS_STEP = 0.02;

/** And a slow copy should still tick, so it does not look stalled. */
export const MEDIA_PREPARATION_REPORT_INTERVAL_MS = 250;

export interface MediaPreparationReportState {
  lastProgress: number;
  lastReportedAtMs: number;
}

export function createMediaPreparationReportState(): MediaPreparationReportState {
  return { lastProgress: -1, lastReportedAtMs: 0 };
}

/**
 * Whether this event is worth acting on.
 *
 * A terminal status always is: it is the one that leaves the stored row in its
 * final state, and dropping it would leave a queue item saying "preparing" for
 * ever. The first event always is too, so the ring stops being indeterminate as
 * early as it can.
 */
export function shouldReportMediaPreparation(input: {
  isTerminal: boolean;
  nowMs: number;
  progress: number;
  state: MediaPreparationReportState;
}): boolean {
  if (input.isTerminal || input.state.lastProgress < 0) {
    return true;
  }

  return input.progress - input.state.lastProgress >= MEDIA_PREPARATION_PROGRESS_STEP ||
    input.nowMs - input.state.lastReportedAtMs >= MEDIA_PREPARATION_REPORT_INTERVAL_MS;
}

export function markMediaPreparationReported(
  state: MediaPreparationReportState,
  progress: number,
  nowMs: number
): void {
  state.lastProgress = progress;
  state.lastReportedAtMs = nowMs;
}
