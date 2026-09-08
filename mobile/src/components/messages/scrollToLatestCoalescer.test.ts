import { describe, expect, it, vi } from 'vitest';
import { createScrollToLatestCoalescer } from './scrollToLatestCoalescer';

function createHarness() {
  const scheduled: Array<() => void> = [];
  const scroll = vi.fn();
  const coalescer = createScrollToLatestCoalescer({
    clearTimeoutImpl: (handle) => {
      scheduled[handle as number] = () => undefined;
    },
    scroll,
    setTimeoutImpl: (handler) => scheduled.push(handler) - 1
  });

  return {
    coalescer,
    runPending: () => scheduled.splice(0).forEach((handler) => handler()),
    scheduledCount: () => scheduled.length,
    scroll
  };
}

describe('createScrollToLatestCoalescer', () => {
  it('performs one scroll for a burst of requests', () => {
    const harness = createHarness();

    // Opening a chat asks several times: once for the messages, then again on
    // every content size change as rows are measured.
    harness.coalescer.request(true);
    harness.coalescer.request(false);
    harness.coalescer.request(false);
    harness.coalescer.request(false);
    harness.runPending();

    expect(harness.scroll).toHaveBeenCalledTimes(1);
  });

  it('keeps the movement smooth when any request asked for it', () => {
    const harness = createHarness();

    harness.coalescer.request(true);
    harness.coalescer.request(false);
    harness.runPending();

    // Letting the last request win is what turned every chat open into a snap.
    expect(harness.scroll).toHaveBeenCalledWith(true);
  });

  it('stays instant when nothing asked for animation', () => {
    const harness = createHarness();

    harness.coalescer.request(false);
    harness.coalescer.request(false);
    harness.runPending();

    expect(harness.scroll).toHaveBeenCalledWith(false);
  });

  it('schedules only one timer per burst', () => {
    const harness = createHarness();

    harness.coalescer.request(false);
    harness.coalescer.request(false);
    harness.coalescer.request(false);

    expect(harness.scheduledCount()).toBe(1);
  });

  it('starts a fresh burst after the previous one ran', () => {
    const harness = createHarness();

    harness.coalescer.request(true);
    harness.runPending();
    harness.coalescer.request(false);
    harness.runPending();

    expect(harness.scroll).toHaveBeenCalledTimes(2);
    expect(harness.scroll).toHaveBeenLastCalledWith(false);
  });

  it('does not carry animation into the next burst', () => {
    const harness = createHarness();

    harness.coalescer.request(true);
    harness.runPending();
    harness.coalescer.request(false);
    harness.runPending();

    expect(harness.scroll).toHaveBeenLastCalledWith(false);
  });

  it('performs nothing after being cancelled', () => {
    const harness = createHarness();

    harness.coalescer.request(true);
    harness.coalescer.cancel();
    harness.runPending();

    // Unmounting mid-burst must not scroll a list that is gone.
    expect(harness.scroll).not.toHaveBeenCalled();
  });

  it('can be reused after cancelling', () => {
    const harness = createHarness();

    harness.coalescer.request(true);
    harness.coalescer.cancel();
    harness.coalescer.request(false);
    harness.runPending();

    expect(harness.scroll).toHaveBeenCalledTimes(1);
    expect(harness.scroll).toHaveBeenCalledWith(false);
  });
});
