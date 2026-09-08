import { describe, expect, it } from 'vitest';
import {
  buildProfilePhotoMemoKey,
  PROFILE_PHOTO_MEMO_LIMIT,
  rememberResolvedProfilePhoto
} from './profilePhotoMemo';

describe('buildProfilePhotoMemoKey', () => {
  it('separates the two halves so different pairs cannot collide', () => {
    // Run together, these would be one key, and one person would be shown
    // another person's face.
    expect(buildProfilePhotoMemoKey('ab', 'c')).not.toBe(buildProfilePhotoMemoKey('a', 'bc'));
  });

  it('treats a new photo on the same person as a different entry', () => {
    expect(buildProfilePhotoMemoKey('key-1', 'https://photos/1.jpg')).not.toBe(
      buildProfilePhotoMemoKey('key-2', 'https://photos/2.jpg')
    );
  });

  it('gives the same key back for the same pair', () => {
    expect(buildProfilePhotoMemoKey('k', 'https://photos/1.jpg')).toBe(
      buildProfilePhotoMemoKey('k', 'https://photos/1.jpg')
    );
  });
});

describe('rememberResolvedProfilePhoto', () => {
  it('remembers what a photo resolved to', () => {
    const memo = new Map<string, string>();

    rememberResolvedProfilePhoto(memo, 'k', 'file:///photo.jpg');

    expect(memo.get('k')).toBe('file:///photo.jpg');
  });

  it('drops the oldest entry rather than growing without limit', () => {
    const memo = new Map<string, string>();

    for (let index = 0; index < PROFILE_PHOTO_MEMO_LIMIT; index += 1) {
      rememberResolvedProfilePhoto(memo, `key-${index}`, `file:///${index}.jpg`);
    }

    rememberResolvedProfilePhoto(memo, 'newest', 'file:///newest.jpg');

    expect(memo.size).toBe(PROFILE_PHOTO_MEMO_LIMIT);
    expect(memo.has('key-0')).toBe(false);
    expect(memo.get('newest')).toBe('file:///newest.jpg');
  });

  it('updating an entry that is already there evicts nothing', () => {
    const memo = new Map<string, string>();

    for (let index = 0; index < PROFILE_PHOTO_MEMO_LIMIT; index += 1) {
      rememberResolvedProfilePhoto(memo, `key-${index}`, `file:///${index}.jpg`);
    }

    rememberResolvedProfilePhoto(memo, 'key-0', 'file:///moved.jpg');

    expect(memo.size).toBe(PROFILE_PHOTO_MEMO_LIMIT);
    expect(memo.get('key-0')).toBe('file:///moved.jpg');
  });
});
