/**
 * Collapses a burst of scroll-to-bottom requests into one movement.
 *
 * Opening a chat asks the list to scroll to the bottom several times in quick
 * succession: once when the messages arrive, then again on every content size
 * change as rows are measured and images resolve. Performing each one produces a
 * flash of the top of the thread followed by a series of snaps — the jumping the
 * list is supposed to be hiding.
 *
 * Requests inside the settle window are merged into a single scroll performed at
 * the end of it, by which point the content has stopped growing and the list can
 * reach the real bottom in one go.
 */

export interface ScrollToLatestCoalescerOptions {
  /**
   * How long to wait for the content to stop changing.
   *
   * Long enough to absorb the measurement burst, short enough that the thread
   * does not visibly sit at the wrong place first.
   */
  delayMs?: number;
  scroll: (animated: boolean) => void;
  /** Injectable so the coalescing can be tested without real time passing. */
  setTimeoutImpl?: (handler: () => void, timeoutMs: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

export interface ScrollToLatestCoalescer {
  cancel: () => void;
  request: (animated: boolean) => void;
}

export const DEFAULT_SCROLL_SETTLE_MS = 90;

export function createScrollToLatestCoalescer(
  options: ScrollToLatestCoalescerOptions
): ScrollToLatestCoalescer {
  const delayMs = options.delayMs ?? DEFAULT_SCROLL_SETTLE_MS;
  const schedule = options.setTimeoutImpl ||
    ((handler: () => void, timeoutMs: number) => setTimeout(handler, timeoutMs));
  const unschedule = options.clearTimeoutImpl ||
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let handle: unknown = null;
  let shouldAnimate = false;

  function request(animated: boolean): void {
    // Animation is sticky across the burst. Opening a chat wants a smooth
    // movement, but the content-size changes that follow ask for an instant one;
    // letting the last request win would turn every open back into a snap.
    shouldAnimate = shouldAnimate || animated;

    if (handle !== null) {
      return;
    }

    handle = schedule(() => {
      const animateThisScroll = shouldAnimate;

      handle = null;
      shouldAnimate = false;
      options.scroll(animateThisScroll);
    }, delayMs);
  }

  function cancel(): void {
    if (handle !== null) {
      unschedule(handle);
      handle = null;
    }

    shouldAnimate = false;
  }

  return { cancel, request };
}
