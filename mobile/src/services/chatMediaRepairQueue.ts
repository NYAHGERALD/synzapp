/**
 * Reports chat media whose local file has gone missing.
 *
 * A stored path can stop pointing at anything without the message changing:
 * deleting and reinstalling the app wipes its container, and iOS reclaims the
 * caches directory under storage pressure. The message still says the media is
 * local, so nothing re-fetches it and the tile stays blank forever.
 *
 * The background hydration pass catches most of this, but it only looks at a
 * recent window and repairs a handful per pass — an album further up the thread
 * is never reached. The component that actually failed to draw the file knows
 * for certain that it is gone, so it says so here and the screen repairs exactly
 * that attachment.
 *
 * This is a module-level channel rather than a callback prop because the report
 * comes from an image nested four components deep, and threading a handler
 * through every one of them to reach the screen would put a prop on components
 * that have no other reason to know about downloads.
 */

export interface MissingChatMediaReport {
  mediaIndex: number;
  messageId: string;
  sourceUri: string;
}

type MissingChatMediaListener = (report: MissingChatMediaReport) => void;

const listeners = new Set<MissingChatMediaListener>();
/** What has already been reported, so a re-render does not ask twice. */
const reported = new Set<string>();

function getReportKey(report: MissingChatMediaReport): string {
  return `${report.messageId}:${report.mediaIndex}:${report.sourceUri}`;
}

/**
 * Says that a local media file could not be read.
 *
 * Repeats for the same file are dropped. A failing tile re-renders on every
 * thread update, and a thread with a dozen missing photos would otherwise queue
 * hundreds of identical repairs.
 */
export function reportMissingChatMedia(report: MissingChatMediaReport): void {
  if (!report.messageId || !report.sourceUri) {
    return;
  }

  const key = getReportKey(report);

  if (reported.has(key)) {
    return;
  }

  reported.add(key);

  listeners.forEach((listener) => {
    try {
      listener(report);
    } catch {
      // One failing subscriber must not stop the others being told.
    }
  });
}

export function subscribeMissingChatMedia(listener: MissingChatMediaListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Forgets that a file was reported missing.
 *
 * Called once the media has been re-downloaded, so that if the new copy is lost
 * later it can be reported again rather than being silently ignored forever.
 */
export function clearMissingChatMediaReport(report: MissingChatMediaReport): void {
  reported.delete(getReportKey(report));
}

export function clearAllMissingChatMediaReports(): void {
  reported.clear();
}
