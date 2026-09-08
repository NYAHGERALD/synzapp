import { listAnnouncements, type Announcement } from './announcementApi';

/**
 * One copy of this person's announcements, shared by every screen.
 *
 * Opening a chat must not wait on a network call it never needed before. The
 * list is fetched once, kept here, and read from memory by the chat banner, the
 * tab and the badge. It is refreshed when the app comes to the front and after
 * anything changes, never on opening a chat.
 */

type Listener = (announcements: Announcement[]) => void;

let announcements: Announcement[] = [];
let listeners: Listener[] = [];
let lastLoadedAtMs = 0;
let inFlight: Promise<void> | null = null;

/** Long enough that moving between screens costs nothing. */
const FRESH_FOR_MS = 60_000;

export function getAnnouncements(): Announcement[] {
  return announcements;
}

export function subscribeToAnnouncements(listener: Listener): () => void {
  listeners.push(listener);
  listener(announcements);

  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

function publish(next: Announcement[]) {
  announcements = next;

  for (const listener of listeners) {
    listener(announcements);
  }
}

/**
 * Loads them, unless a fresh copy is already here.
 *
 * Several screens mount at once when the app opens. Without the in-flight
 * guard each would start its own request for the same list.
 */
export async function refreshAnnouncements(
  getIdToken: () => Promise<string>,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force && Date.now() - lastLoadedAtMs < FRESH_FOR_MS) {
    return;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const idToken = await getIdToken();

      publish(await listAnnouncements(idToken));
      lastLoadedAtMs = Date.now();
    } catch {
      // Announcements failing to load must never stop a chat from opening.
      // The banner simply does not appear until the next refresh.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Records an acknowledgement locally, so the banner goes at once.
 *
 * The server is the record. This is only so the person is not left looking at
 * a notice they have just confirmed while a request is in flight.
 */
export function markAcknowledgedLocally(announcementId: string): void {
  publish(
    announcements.map((entry) =>
      entry.announcementId === announcementId
        ? {
            ...entry,
            acknowledgedCount: entry.acknowledgedCount + 1,
            myStatus: 'ACKNOWLEDGED' as const
          }
        : entry
    )
  );
}

/** Used when somebody signs out, so the next person sees nothing of theirs. */
export function clearAnnouncements(): void {
  lastLoadedAtMs = 0;
  publish([]);
}
