import { describe, expect, it, vi } from 'vitest';

// Hoisted so the mock factory below can reference it - vi.mock is lifted above
// ordinary top-level constants.
const paths = vi.hoisted(() => ({
  cacheDirectory: 'file:///var/mobile/Containers/Data/Application/NEW-CONTAINER/Library/Caches/'
}));
const CACHE_DIRECTORY = paths.cacheDirectory;

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: paths.cacheDirectory,
  documentDirectory: 'file:///var/mobile/Containers/Data/Application/NEW-CONTAINER/Documents/',
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  createUploadTask: vi.fn(),
  downloadAsync: vi.fn()
}));

vi.mock('expo-crypto', () => ({ getRandomBytes: () => new Uint8Array(16) }));
vi.mock('./apiConfig', () => ({ getSynzappApiBaseUrl: () => 'https://example.test' }));
vi.mock('./deviceIdentity', () => ({ getRegisteredDeviceHeaders: async () => ({}) }));
vi.mock('./chatBackgroundTransferApi', () => ({
  cancelNativeBackgroundTransfer: vi.fn(),
  downloadFileWithNativeBackgroundTransfer: vi.fn(),
  getNativeBackgroundTransferStatus: vi.fn(),
  uploadFileWithNativeBackgroundTransfer: vi.fn()
}));
vi.mock('./nativeMediaPicker', () => ({
  decryptNativeMediaFile: vi.fn(),
  encryptNativeMediaFile: vi.fn(),
  getNativeMediaPipelineCapabilities: vi.fn()
}));
vi.mock('./nativeVideoTranscoder', () => ({ transcodeChatVideo: vi.fn() }));

import {
  PORTABLE_CHAT_MEDIA_SCHEME,
  resolveLocalChatMediaUri,
  setPersistentChatMediaDirectory,
  toPortableChatMediaUri
} from './chatMediaPaths';

describe('portable chat media paths', () => {
  it('stores a portable reference instead of a device-specific path', () => {
    const absoluteUri = `${CACHE_DIRECTORY}Synzapp/Media/local_1_abc_photo.jpg`;

    expect(toPortableChatMediaUri(absoluteUri)).toBe(
      `${PORTABLE_CHAT_MEDIA_SCHEME}local_1_abc_photo.jpg`
    );
  });

  it('round-trips a portable reference back to a usable path', () => {
    const portableUri = `${PORTABLE_CHAT_MEDIA_SCHEME}local_1_abc_photo.jpg`;

    expect(resolveLocalChatMediaUri(portableUri)).toBe(
      `${CACHE_DIRECTORY}Synzapp/Media/local_1_abc_photo.jpg`
    );
  });

  it('resolves a portable reference against persistent storage once it exists', () => {
    const persistentDirectory = 'file:///var/mobile/Containers/Data/Application/NEW/Library/Application%20Support/SynzappMedia/';

    setPersistentChatMediaDirectory(persistentDirectory);

    try {
      expect(resolveLocalChatMediaUri(`${PORTABLE_CHAT_MEDIA_SCHEME}clip.mp4`)).toBe(
        `${persistentDirectory}clip.mp4`
      );
    } finally {
      setPersistentChatMediaDirectory(null);
    }
  });

  it('leaves paths outside managed storage untouched', () => {
    expect(toPortableChatMediaUri('file:///somewhere/else/photo.jpg')).toBe(
      'file:///somewhere/else/photo.jpg'
    );
  });

  it('leaves data URIs untouched', () => {
    expect(toPortableChatMediaUri('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('resolveLocalChatMediaUri', () => {
  it('re-roots a path written under a previous app container', () => {
    const staleUri = 'file:///var/mobile/Containers/Data/Application/OLD-CONTAINER/Library/Caches/Synzapp/Media/local_1_abc_photo.jpg';

    expect(resolveLocalChatMediaUri(staleUri)).toBe(
      `${CACHE_DIRECTORY}Synzapp/Media/local_1_abc_photo.jpg`
    );
  });

  it('re-roots native media cache paths too', () => {
    const staleUri = 'file:///var/mobile/Containers/Data/Application/OLD-CONTAINER/Library/Caches/SynzappNativeMedia/transcoded_9_x.mp4';

    expect(resolveLocalChatMediaUri(staleUri)).toBe(
      `${CACHE_DIRECTORY}SynzappNativeMedia/transcoded_9_x.mp4`
    );
  });

  it('leaves an already-current path untouched', () => {
    const currentUri = `${CACHE_DIRECTORY}Synzapp/Media/local_2_def_photo.jpg`;

    expect(resolveLocalChatMediaUri(currentUri)).toBe(currentUri);
  });

  it('leaves data URIs alone', () => {
    expect(resolveLocalChatMediaUri('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('leaves unrelated file paths alone', () => {
    const otherUri = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/Other/photo.jpg';

    expect(resolveLocalChatMediaUri(otherUri)).toBe(otherUri);
  });

  it('ignores empty input', () => {
    expect(resolveLocalChatMediaUri('')).toBe('');
  });
});
