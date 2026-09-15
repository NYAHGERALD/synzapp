/**
 * Hands a downloaded file to the person rather than opening it.
 *
 * Evidence used to be opened with `URL.createObjectURL(blob)` followed by
 * `window.open(url)`. A blob document runs on **this** origin and inherits this
 * page's Content-Security-Policy, so an uploaded file that the server described
 * as `text/html` became a page executing as the colleague viewing it — across a
 * library that is shared tenant-wide.
 *
 * The content type is allowlisted on the server now and the file is served with
 * an attachment disposition, so that particular door is shut twice already. This
 * closes it a third time, at the only layer that removes the origin from the
 * question entirely: an anchor carrying `download` saves the bytes and never
 * creates a document at all.
 *
 * The object URL is revoked on the next tick rather than immediately — Safari
 * abandons the download if the URL is released in the same frame as the click.
 */
export function downloadBlobFile(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = buildDownloadFileName(fileName);
  anchor.rel = 'noopener noreferrer';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/**
 * A file name the operating system will accept.
 *
 * Path separators are the ones that matter: a name of `../../thing` is a
 * directory traversal on some platforms, and the browser is not obliged to stop
 * it. Everything else is tidying.
 */
export function buildDownloadFileName(fileName: string): string {
  const safe = (fileName || '')
    // Path separators and the characters Windows refuses.
    .replace(/[\\/:*?"<>|]/g, '-')
    // `..` collapses to a single dot, so a traversal cannot survive as one.
    .replace(/\.{2,}/g, '.')
    /**
     * Leading dots and dashes go too. A name beginning with a dot is a hidden
     * file on Unix, and one beginning with a dash is read as a flag by some
     * command line tools — neither is what somebody meant by a file name, and
     * both are what is left over after the replacements above.
     */
    .replace(/^[.\-\s]+/, '')
    .replace(/[.\-\s]+$/, '')
    .trim();

  return safe || 'evidence';
}
