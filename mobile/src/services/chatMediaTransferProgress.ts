import type { ChatMediaAttachment, ChatMediaTransferStatus } from './chatApi';

/**
 * Live transfer progress for chat media, kept outside React state.
 *
 * Upload and download progress arrives several times a second per item. Pushing
 * that through the message list would rebuild the whole thread on every tick -
 * with a few hundred messages and two or three concurrent transfers that is
 * enough to make scrolling and typing stutter.
 *
 * Instead the numbers land here, and only the small ring drawn over one tile
 * subscribes to them. The message list re-renders when a transfer *changes
 * state* (starts, finishes, fails), not when it advances a percent.
 */

export interface MediaTransferProgressState {
  progress: number;
  status: ChatMediaTransferStatus;
}

type MediaTransferProgressListener = (state: MediaTransferProgressState | null) => void;

const stateByKey = new Map<string, MediaTransferProgressState>();
const listenersByKey = new Map<string, Set<MediaTransferProgressListener>>();

export function buildMediaTransferProgressKey(
  messageId: string,
  mediaIndex?: number
): string {
  return `${messageId}:${Math.max(0, Math.round(mediaIndex || 0))}`;
}

export function getMediaTransferProgress(key: string): MediaTransferProgressState | null {
  return stateByKey.get(key) || null;
}

export function publishMediaTransferProgress(
  key: string,
  state: MediaTransferProgressState
): void {
  const nextState: MediaTransferProgressState = {
    progress: normalizeProgress(state.progress),
    status: state.status
  };
  const currentState = stateByKey.get(key);

  if (
    currentState &&
    currentState.status === nextState.status &&
    currentState.progress === nextState.progress
  ) {
    return;
  }

  stateByKey.set(key, nextState);
  notify(key, nextState);
}

/**
 * Drops a finished transfer.
 *
 * Once media is available the bubble renders from the message itself, so
 * holding progress here would only leak memory across a long session.
 */
export function clearMediaTransferProgress(key: string): void {
  if (!stateByKey.has(key)) {
    return;
  }

  stateByKey.delete(key);
  notify(key, null);
}

export function clearAllMediaTransferProgress(): void {
  const keys = [...stateByKey.keys()];

  stateByKey.clear();
  keys.forEach((key) => notify(key, null));
}

export function subscribeMediaTransferProgress(
  key: string,
  listener: MediaTransferProgressListener
): () => void {
  const listeners = listenersByKey.get(key) || new Set<MediaTransferProgressListener>();

  listeners.add(listener);
  listenersByKey.set(key, listeners);

  return () => {
    const currentListeners = listenersByKey.get(key);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (!currentListeners.size) {
      listenersByKey.delete(key);
    }
  };
}

/**
 * The transfer state to draw for a media item.
 *
 * Live progress always wins, because it describes a transfer happening right
 * now. Without it, the attachment's stored status is only trusted when the file
 * is not already on the device.
 *
 * That second rule matters after a restart. A stored status is a snapshot from
 * whenever it was last written, and a transfer that finished after that point
 * leaves a stale "uploading" or "preparing" behind. Showing a ring over media
 * the device already holds is what made finished videos look like they were
 * being processed all over again.
 */
export function resolveMediaTransferState(
  media: Pick<ChatMediaAttachment, 'localUri' | 'transferProgress' | 'transferStatus'>,
  liveState: MediaTransferProgressState | null
): MediaTransferProgressState | null {
  if (liveState) {
    return liveState;
  }

  // The file is here. Whatever the stored status says, there is nothing to wait
  // for, and a failure the user could retry is surfaced elsewhere.
  if (media.localUri) {
    return null;
  }

  const status = media.transferStatus;

  if (
    status !== 'queued' &&
    status !== 'preparing' &&
    status !== 'uploading' &&
    status !== 'downloading' &&
    status !== 'failed'
  ) {
    return null;
  }

  return {
    progress: normalizeProgress(media.transferProgress || 0),
    status
  };
}

function notify(key: string, state: MediaTransferProgressState | null): void {
  const listeners = listenersByKey.get(key);

  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // A failing subscriber must not stop the others from updating.
    }
  });
}

function normalizeProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}
