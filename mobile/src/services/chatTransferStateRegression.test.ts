import { describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/'
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import {
  buildMediaTransferProgressKey,
  clearAllMediaTransferProgress,
  publishMediaTransferProgress,
  resolveMediaTransferState,
  subscribeMediaTransferProgress
} from './chatMediaTransferProgress';
import {
  PORTABLE_CHAT_MEDIA_SCHEME,
  toPortableChatMediaUri
} from './chatMediaPaths';

/**
 * Regression cover for defects that reached a device.
 * Named for what the user saw.
 */
describe('media transfer state regressions', () => {
  // R8 / R9 — a finished upload never wrote its final state back to the cached
  // message, so reopening the app showed a progress ring over a sent video.
  it('R8: shows no transfer state once the file is on the device', () => {
    expect(resolveMediaTransferState(
      {
        localUri: `${paths.cacheDirectory}Synzapp/Media/clip.mp4`,
        transferProgress: 0.4,
        transferStatus: 'uploading'
      },
      null
    )).toBeNull();
  });

  it('R8: still shows a live transfer for media that has a local file', () => {
    expect(resolveMediaTransferState(
      { localUri: `${paths.cacheDirectory}Synzapp/Media/clip.mp4`, transferStatus: 'available' },
      { progress: 0.6, status: 'uploading' }
    )).toEqual({ progress: 0.6, status: 'uploading' });
  });

  it('R8: shows a download for media not yet on the device', () => {
    expect(resolveMediaTransferState(
      { transferProgress: 0.25, transferStatus: 'downloading' },
      null
    )).toEqual({ progress: 0.25, status: 'downloading' });
  });

  // R14 — progress updates rebuilt the whole thread several times a second.
  // Isolation is what keeps the list still while transfers run.
  it('R14: notifies only the subscriber for the media being transferred', () => {
    clearAllMediaTransferProgress();
    const watched = vi.fn();
    const unrelated = vi.fn();

    subscribeMediaTransferProgress(buildMediaTransferProgressKey('m1', 0), watched);
    subscribeMediaTransferProgress(buildMediaTransferProgressKey('m2', 0), unrelated);
    publishMediaTransferProgress(buildMediaTransferProgressKey('m1', 0), {
      progress: 0.5,
      status: 'uploading'
    });

    expect(watched).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
  });

  it('R14: album items are tracked independently of each other', () => {
    expect(buildMediaTransferProgressKey('m1', 0))
      .not.toBe(buildMediaTransferProgressKey('m1', 1));
  });

  // R12 — a backup carrying absolute paths restores onto a device where those
  // paths name a container that never existed.
  it('R12: records media as a portable reference, not a device path', () => {
    const absolute = `${paths.cacheDirectory}Synzapp/Media/photo.jpg`;

    expect(toPortableChatMediaUri(absolute))
      .toBe(`${PORTABLE_CHAT_MEDIA_SCHEME}photo.jpg`);
  });

  it('R12: leaves paths outside managed storage alone', () => {
    expect(toPortableChatMediaUri('file:///elsewhere/photo.jpg'))
      .toBe('file:///elsewhere/photo.jpg');
  });
});
