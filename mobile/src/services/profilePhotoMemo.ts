/**
 * Which profile photos have already been resolved to a local file this session.
 *
 * Resolving one is not cheap, even when the file is already on disk. The cache
 * hit path stats the file, writes a row to SQLite and reads the Keychain
 * through `SecureStore`. That is three native round trips per person, and the
 * Keychain one goes through `securityd` on iOS, where it is far slower than its
 * Android equivalent.
 *
 * Screens re-resolve every face each time they are opened, and the list is not
 * shown until all of them finish. For a company of fifty people that is a
 * hundred and fifty native calls before anything is drawn, on every single
 * visit, which is what made moving around the app feel like it lagged behind
 * the tap on iPhone.
 *
 * Remembering the answer for the session makes the second visit free. What a
 * photo resolves to cannot change underneath us, because the key includes the
 * cache key and a new photo is given a new cache key.
 *
 * Kept out of the module that does the work so that it can be tested: that one
 * imports expo and react-native.
 */

/** Matches the on-disk cache limit, so the two cannot drift apart. */
export const PROFILE_PHOTO_MEMO_LIMIT = 1000;

/**
 * One key for a photo.
 *
 * The cache key's length is written in first so the two halves cannot run
 * together. Without that, cache key "ab" with url "c" and cache key "a" with
 * url "bc" would produce the same key, and one person would be shown another
 * person's face.
 */
export function buildProfilePhotoMemoKey(cacheKey: string, profilePhotoUrl: string): string {
  return `${cacheKey.length}:${cacheKey}:${profilePhotoUrl}`;
}

/**
 * Records a resolved photo, evicting the oldest once the limit is reached.
 *
 * A `Map` keeps insertion order, so the first key is the one added longest ago.
 */
export function rememberResolvedProfilePhoto(
  memo: Map<string, string>,
  key: string,
  fileUri: string
): void {
  if (memo.size >= PROFILE_PHOTO_MEMO_LIMIT && !memo.has(key)) {
    const oldest = memo.keys().next();

    if (!oldest.done) {
      memo.delete(oldest.value);
    }
  }

  memo.set(key, fileUri);
}
