import { DecodedIdToken } from 'firebase-admin/auth';
import { verifyFirebaseSession } from '../services/authSessionService.js';

/**
 * The signed-in account behind a request, read from the Authorization header.
 *
 * There were eleven private copies of this, one per route file, and they had
 * drifted. Four accepted a bare token with no `Bearer ` scheme; the rest
 * required it. Five answered a missing token with 403 and the rest with 401 —
 * for the identical case. None of that was decided; it accumulated.
 *
 * Settled on the stricter pair: the scheme is required, and a missing token is
 * an authentication failure rather than an authorisation one, because nobody has
 * been identified yet. Every one of the seventy-one callers in the app and the
 * web console already sends `Bearer`, so nothing loses access by tightening it.
 */
export async function getDecodedTokenFromHeader(
  authorizationHeader: string
): Promise<DecodedIdToken> {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : '';

  if (!idToken) {
    const error = new Error('Missing Firebase ID token.');

    error.name = 'AuthenticationError';

    throw error;
  }

  return verifyFirebaseSession(idToken);
}
