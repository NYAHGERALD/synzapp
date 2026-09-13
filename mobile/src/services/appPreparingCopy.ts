/**
 * What the preparing screen says, and the rhythm of its dots.
 *
 * Kept out of the component so it can be tested, and so the wording is in one
 * place rather than inside a view. No native imports.
 *
 * The screen it replaced listed four named stages that advanced on a timer with
 * no connection to what the app was doing. Progress nobody measured is worse
 * than no progress at all: it says "loading encrypted workspace" whether or not
 * anything of the sort is happening. One honest sentence, and a spinner that
 * makes no claim about how far along it is.
 */

export const APP_PREPARING_PHRASE = 'Setting up your account';

export const APP_PREPARING_DOT_COUNT = 3;

/** Dim rather than invisible, so the row never looks like it lost a dot. */
export const APP_PREPARING_DOT_DIM_OPACITY = 0.25;

export const APP_PREPARING_DOT_FADE_MS = 320;

/** The gap between one dot lighting and the next. This is what makes it a wave. */
export const APP_PREPARING_DOT_STEP_MS = 160;

/** How long a dot waits before its turn. */
export function getPreparingDotLeadInMs(index: number): number {
  return Math.max(0, index) * APP_PREPARING_DOT_STEP_MS;
}

/** How long it waits afterwards, so every dot's cycle is the same length. */
export function getPreparingDotTrailMs(index: number): number {
  return Math.max(0, APP_PREPARING_DOT_COUNT - 1 - index) * APP_PREPARING_DOT_STEP_MS;
}

/**
 * One full turn of a dot, lead-in and trail included.
 *
 * Every dot must return the same number here. If they differ the loops drift
 * apart over time and the wave degrades into three dots blinking at random.
 */
export function getPreparingDotCycleMs(index: number): number {
  return getPreparingDotLeadInMs(index) +
    (APP_PREPARING_DOT_FADE_MS * 2) +
    getPreparingDotTrailMs(index);
}

/** The ring turns at a constant speed; these are the two arcs' periods. */
export const APP_PREPARING_RING_SPIN_MS = 1100;
export const APP_PREPARING_RING_COUNTER_SPIN_MS = 1700;
