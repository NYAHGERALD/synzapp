/**
 * Turning a failed download into something worth reading.
 *
 * `downloadAsync` reports a status code and writes the server's reply into the
 * file, so the explanation is sitting on disk while the app says "that document
 * could not be downloaded" — which tells somebody they are stuck without
 * telling them how to get unstuck.
 *
 * Kept free of any native import so the rules can be tested.
 */

/** What the API sends when it refuses something. */
interface ApiErrorBody {
  error?: unknown;
}

export function describeDownloadFailure(input: {
  /** Whatever the server wrote into the file, if it could be read. */
  body: string | null;
  status: number;
}): string {
  const serverMessage = readServerMessage(input.body);

  if (serverMessage) {
    return serverMessage;
  }

  /**
   * Fallbacks by status, because a refusal with no readable body is still a
   * refusal and the person should know which kind.
   */
  if (input.status === 403) {
    return 'You do not have permission to download meeting documents. Ask your company admin to turn this on for your role.';
  }

  if (input.status === 401) {
    return 'Your session has expired. Sign in again and try the download once more.';
  }

  if (input.status === 404) {
    return 'That meeting document is no longer available.';
  }

  if (input.status === 429) {
    return 'Too many downloads in a short time. Wait a moment and try again.';
  }

  if (input.status >= 500) {
    return 'Synzapp could not build that document just now. Try again in a moment.';
  }

  return 'That document could not be downloaded.';
}

function readServerMessage(body: string | null): string | null {
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as ApiErrorBody;

    return typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error.trim() : null;
  } catch {
    /**
     * Not JSON, which means the file holds the document itself or a proxy's
     * HTML error page. Neither is worth showing somebody, so it is ignored
     * rather than printed at them.
     */
    return null;
  }
}
