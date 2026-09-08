import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMediaTransferProgressKey,
  clearAllMediaTransferProgress,
  clearMediaTransferProgress,
  getMediaTransferProgress,
  publishMediaTransferProgress,
  resolveMediaTransferState,
  subscribeMediaTransferProgress
} from './chatMediaTransferProgress';

describe('chatMediaTransferProgress', () => {
  beforeEach(() => {
    clearAllMediaTransferProgress();
  });

  it('keys album items separately from the message', () => {
    expect(buildMediaTransferProgressKey('m1')).toBe('m1:0');
    expect(buildMediaTransferProgressKey('m1', 2)).toBe('m1:2');
  });

  it('notifies only subscribers of the published key', () => {
    const first = vi.fn();
    const second = vi.fn();

    subscribeMediaTransferProgress('m1:0', first);
    subscribeMediaTransferProgress('m2:0', second);

    publishMediaTransferProgress('m1:0', { progress: 0.5, status: 'uploading' });

    expect(first).toHaveBeenCalledWith({ progress: 0.5, status: 'uploading' });
    expect(second).not.toHaveBeenCalled();
  });

  it('does not notify when nothing changed', () => {
    const listener = vi.fn();

    subscribeMediaTransferProgress('m1:0', listener);
    publishMediaTransferProgress('m1:0', { progress: 0.4, status: 'uploading' });
    publishMediaTransferProgress('m1:0', { progress: 0.4, status: 'uploading' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clamps progress into 0..1', () => {
    publishMediaTransferProgress('m1:0', { progress: 1.8, status: 'uploading' });
    expect(getMediaTransferProgress('m1:0')?.progress).toBe(1);

    publishMediaTransferProgress('m1:0', { progress: -3, status: 'uploading' });
    expect(getMediaTransferProgress('m1:0')?.progress).toBe(0);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMediaTransferProgress('m1:0', listener);

    unsubscribe();
    publishMediaTransferProgress('m1:0', { progress: 0.7, status: 'uploading' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('reports the cleared transfer so the ring can disappear', () => {
    const listener = vi.fn();

    publishMediaTransferProgress('m1:0', { progress: 0.9, status: 'uploading' });
    subscribeMediaTransferProgress('m1:0', listener);
    clearMediaTransferProgress('m1:0');

    expect(listener).toHaveBeenCalledWith(null);
    expect(getMediaTransferProgress('m1:0')).toBeNull();
  });

  it('prefers live progress over the attachment snapshot', () => {
    const state = resolveMediaTransferState(
      { transferProgress: 0.1, transferStatus: 'uploading' },
      { progress: 0.8, status: 'uploading' }
    );

    expect(state).toEqual({ progress: 0.8, status: 'uploading' });
  });

  it('falls back to the attachment when no live progress exists', () => {
    const state = resolveMediaTransferState(
      { transferProgress: 0.25, transferStatus: 'downloading' },
      null
    );

    expect(state).toEqual({ progress: 0.25, status: 'downloading' });
  });

  it('shows nothing once the file is on the device, even if the stored status is stale', () => {
    // A finished transfer can leave an in-progress status behind in the cache.
    // The file being present is the stronger signal.
    expect(resolveMediaTransferState(
      { localUri: 'file:///cache/photo.jpg', transferProgress: 0.4, transferStatus: 'uploading' },
      null
    )).toBeNull();
  });

  it('still shows live progress for media that has a local file', () => {
    expect(resolveMediaTransferState(
      { localUri: 'file:///cache/photo.jpg', transferProgress: 0, transferStatus: 'available' },
      { progress: 0.6, status: 'uploading' }
    )).toEqual({ progress: 0.6, status: 'uploading' });
  });

  it('shows nothing for media that is already available', () => {
    expect(resolveMediaTransferState(
      { transferProgress: 1, transferStatus: 'available' },
      null
    )).toBeNull();
  });
});
