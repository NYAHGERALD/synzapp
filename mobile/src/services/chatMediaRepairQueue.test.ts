import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllMissingChatMediaReports,
  clearMissingChatMediaReport,
  reportMissingChatMedia,
  subscribeMissingChatMedia
} from './chatMediaRepairQueue';

function report(overrides: Partial<{ mediaIndex: number; messageId: string; sourceUri: string }> = {}) {
  return { mediaIndex: 0, messageId: 'm1', sourceUri: 'file:///gone.jpg', ...overrides };
}

describe('chatMediaRepairQueue', () => {
  beforeEach(() => {
    clearAllMissingChatMediaReports();
  });

  it('tells subscribers a file is missing', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMissingChatMedia(listener);

    reportMissingChatMedia(report());

    expect(listener).toHaveBeenCalledWith(report());
    unsubscribe();
  });

  it('reports the same file only once', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMissingChatMedia(listener);

    // A failing tile re-renders on every thread update; without this a thread of
    // missing photos would queue hundreds of identical repairs.
    reportMissingChatMedia(report());
    reportMissingChatMedia(report());
    reportMissingChatMedia(report());

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('treats each attachment in an album separately', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMissingChatMedia(listener);

    reportMissingChatMedia(report({ mediaIndex: 0 }));
    reportMissingChatMedia(report({ mediaIndex: 1 }));
    reportMissingChatMedia(report({ mediaIndex: 2 }));

    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('reports again once a repaired file is lost a second time', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMissingChatMedia(listener);

    reportMissingChatMedia(report());
    clearMissingChatMediaReport(report());
    reportMissingChatMedia(report());

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('ignores a report with nothing to identify it', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMissingChatMedia(listener);

    reportMissingChatMedia(report({ messageId: '' }));
    reportMissingChatMedia(report({ sourceUri: '' }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps telling the others when one subscriber throws', () => {
    const failing = vi.fn(() => { throw new Error('boom'); });
    const healthy = vi.fn();
    const stopFailing = subscribeMissingChatMedia(failing);
    const stopHealthy = subscribeMissingChatMedia(healthy);

    reportMissingChatMedia(report());

    expect(healthy).toHaveBeenCalledTimes(1);
    stopFailing();
    stopHealthy();
  });

  it('stops telling a subscriber that has unsubscribed', () => {
    const listener = vi.fn();

    subscribeMissingChatMedia(listener)();
    reportMissingChatMedia(report());

    expect(listener).not.toHaveBeenCalled();
  });
});
