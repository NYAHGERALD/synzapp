import { describe, expect, it, vi } from 'vitest';

const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Library/Caches/'
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/'
}));

import type { ChatMediaAttachment } from './chatApi';
import { getMediaLocalUri } from './chatMessageReconciliation';

const POSTER = 'data:image/jpeg;base64,AAAA';
const VIDEO_URI = `${paths.cacheDirectory}Synzapp/Media/clip.mp4`;

/** Mirrors the Library's file-vs-poster rule. */
function getLibraryFileUri(media: ChatMediaAttachment): string {
  const localUri = getMediaLocalUri(media);

  if (localUri) {
    return localUri;
  }

  return media.kind === 'image' ? media.thumbnailDataUrl || '' : '';
}

function media(overrides: Partial<ChatMediaAttachment>): ChatMediaAttachment {
  return {
    contentType: 'video/mp4',
    fileName: 'clip.mp4',
    kind: 'video',
    sizeBytes: 1024,
    ...overrides
  } as ChatMediaAttachment;
}

/**
 * Tapping a Library video showed a broken-file marker. The entry's file URL was
 * its poster frame, so the player was handed a JPEG and had nothing to play.
 */
describe('library media source', () => {
  it('gives a video its actual file, not its poster', () => {
    expect(getLibraryFileUri(media({
      localUri: VIDEO_URI,
      thumbnailDataUrl: POSTER
    }))).toBe(VIDEO_URI);
  });

  it('never offers a poster as a playable video', () => {
    expect(getLibraryFileUri(media({ thumbnailDataUrl: POSTER }))).toBe('');
  });

  it('lets an image fall back to its embedded copy, which is viewable', () => {
    expect(getLibraryFileUri(media({
      kind: 'image',
      thumbnailDataUrl: POSTER
    }))).toBe(POSTER);
  });

  it('prefers the full-size file for an image when there is one', () => {
    const fullSize = `${paths.cacheDirectory}Synzapp/Media/photo.jpg`;

    expect(getLibraryFileUri(media({
      kind: 'image',
      localUri: fullSize,
      thumbnailDataUrl: POSTER
    }))).toBe(fullSize);
  });

  it('resolves a file written under a previous app container', () => {
    expect(getLibraryFileUri(media({
      localUri: 'file:///var/mobile/Containers/Data/Application/OLD/Library/Caches/Synzapp/Media/clip.mp4'
    }))).toBe(VIDEO_URI);
  });
});
