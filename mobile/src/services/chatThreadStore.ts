import type { ChatMediaAttachment, ChatMessage } from './chatApi';
import {
  getChatMessageIdentityKey,
  getMediaLocalUri,
  getMessageMediaItems,
  mergeChatMessageWithLocalState,
  toChatImageAttachment,
  uniqueChatMessages
} from './chatMessageReconciliation';

/**
 * The single source of truth for a conversation's messages.
 *
 * Message state used to live in several places at once — the pending outbox,
 * the conversation cache, and component state — reconciled by merging them on
 * every refresh. Every disagreement between those copies became a visible
 * defect: a bubble that vanished when one path rebuilt the thread without the
 * outbox, a bubble that flickered when two copies carried different ids, a
 * message that flipped back to "Queued" when a stale copy won a merge.
 *
 * This is how established chat clients avoid that class of bug: one store owns
 * the thread, writes update a message in place, and the UI observes the store
 * rather than assembling the thread itself. There is nothing to reconcile
 * because there is only one copy.
 *
 * The store is deliberately in-memory and synchronous. Durable writes still go
 * to SQLite, but they are a consequence of a change rather than the thing the
 * interface waits on.
 */

type ChatThreadListener = (messages: ChatMessage[]) => void;

const threadsByContactId = new Map<string, ChatMessage[]>();
const listenersByContactId = new Map<string, Set<ChatThreadListener>>();

const EMPTY_THREAD: ChatMessage[] = [];

export function getChatThread(contactId: string): ChatMessage[] {
  return threadsByContactId.get(contactId) || EMPTY_THREAD;
}

export function subscribeChatThread(
  contactId: string,
  listener: ChatThreadListener
): () => void {
  const listeners = listenersByContactId.get(contactId) || new Set<ChatThreadListener>();

  listeners.add(listener);
  listenersByContactId.set(contactId, listeners);

  return () => {
    const currentListeners = listenersByContactId.get(contactId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (!currentListeners.size) {
      listenersByContactId.delete(contactId);
    }
  };
}

/**
 * Replaces a thread wholesale, as when a conversation is loaded.
 *
 * Still passes through the merge so a load cannot discard what the store
 * already knows — local media the server has no record of, or a delivery status
 * further along than the loaded copy.
 */
export function setChatThread(contactId: string, messages: ChatMessage[]): void {
  const current = getChatThread(contactId);
  const next = uniqueChatMessages([...current, ...messages]);

  commitThread(contactId, next);
}

/** Merges messages into a thread, keeping whatever the store already holds. */
export function upsertChatMessages(contactId: string, messages: ChatMessage[]): void {
  if (!messages.length) {
    return;
  }

  commitThread(contactId, uniqueChatMessages([...getChatThread(contactId), ...messages]));
}

/**
 * Sets which messages the thread contains, keeping what the store knows about
 * each one.
 *
 * Membership comes from the caller — a message left out has genuinely been
 * removed, so deletes and clears still work. But content is merged, because the
 * caller's copy is usually poorer than the store's: a message echoed back by the
 * server carries no local file, since the server has no idea the device already
 * holds it.
 *
 * Replacing outright is what made an already-sent photo download itself again.
 * The bubble looked right because the thumbnail travels with the message; the
 * path to the full-size file had been dropped, so opening it fetched the file
 * the device was already storing.
 */
export function reconcileChatThread(contactId: string, messages: ChatMessage[]): void {
  const current = getChatThread(contactId);

  if (!current.length) {
    commitThread(contactId, uniqueChatMessages(messages));
    return;
  }

  const currentByKey = new Map<string, ChatMessage>();

  current.forEach((message) => {
    currentByKey.set(getChatMessageIdentityKey(message), message);
    currentByKey.set(message.messageId, message);
  });

  const reconciled = messages.map((message) => {
    const existing = currentByKey.get(getChatMessageIdentityKey(message)) ||
      currentByKey.get(message.messageId);

    return existing ? mergeChatMessageWithLocalState(existing, message) : message;
  });

  // Messages still waiting to be sent are kept even though the caller did not
  // list them.
  //
  // Membership normally comes from the caller, so a message left out has been
  // removed. That cannot be true of one the server has never seen: it is absent
  // because the cache or the snapshot the caller read from does not know about
  // it yet, not because it went away. Dropping it made a video bubble appear
  // the moment it was recorded, vanish when the next refresh landed, and come
  // back once the send finished.
  const listedKeys = new Set(reconciled.map((message) => getChatMessageIdentityKey(message)));
  const stillSending = current.filter((message) =>
    message.deliveryStatus === 'queued' &&
    !listedKeys.has(getChatMessageIdentityKey(message))
  );

  commitThread(contactId, uniqueChatMessages([...reconciled, ...stillSending]));
}

/** Replaces the thread outright, keeping nothing. Used when wiping local data. */
export function replaceChatThread(contactId: string, messages: ChatMessage[]): void {
  commitThread(contactId, uniqueChatMessages(messages));
}

export function clearChatThread(contactId: string): void {
  commitThread(contactId, []);
}

export function updateChatMessage(
  contactId: string,
  identityKey: string,
  update: (message: ChatMessage) => ChatMessage
): void {
  const current = getChatThread(contactId);
  let didChange = false;

  const next = current.map((message) => {
    if (getChatMessageIdentityKey(message) !== identityKey && message.messageId !== identityKey) {
      return message;
    }

    // Route the change through the merge so store invariants — delivery only
    // moving forward, local media surviving — hold for direct updates too.
    const updated = mergeChatMessageWithLocalState(message, update(message));

    if (updated !== message) {
      didChange = true;
    }

    return updated;
  });

  if (didChange) {
    commitThread(contactId, next);
  }
}

export function removeChatMessage(contactId: string, identityKey: string): void {
  const current = getChatThread(contactId);
  const next = current.filter((message) =>
    getChatMessageIdentityKey(message) !== identityKey && message.messageId !== identityKey
  );

  if (next.length !== current.length) {
    commitThread(contactId, next);
  }
}

export function removeChatMessages(contactId: string, identityKeys: string[]): void {
  if (!identityKeys.length) {
    return;
  }

  const removing = new Set(identityKeys);
  const current = getChatThread(contactId);
  const next = current.filter((message) =>
    !removing.has(getChatMessageIdentityKey(message)) && !removing.has(message.messageId)
  );

  if (next.length !== current.length) {
    commitThread(contactId, next);
  }
}

/** Applies a media change to one attachment of one message. */
export function applyChatMessageMedia(
  contactId: string,
  identityKey: string,
  media: ChatMediaAttachment,
  mediaIndex?: number
): void {
  updateChatMessage(contactId, identityKey, (message) => {
    const currentMediaItems = getMessageMediaItems(message);

    if (typeof mediaIndex === 'number' && currentMediaItems.length > 1) {
      const nextMediaItems = currentMediaItems.map((mediaItem, index) =>
        index === mediaIndex ? media : mediaItem
      );
      const primaryMedia = nextMediaItems[0] || media;

      return {
        ...message,
        image: primaryMedia.kind === 'image' ? toChatImageAttachment(primaryMedia) : message.image,
        media: primaryMedia,
        mediaItems: nextMediaItems
      };
    }

    return {
      ...message,
      image: media.kind === 'image' ? toChatImageAttachment(media) : message.image,
      media,
      mediaItems: currentMediaItems.length > 1 ? currentMediaItems : [media]
    };
  });
}

/** Drops every thread. Used when a tenant's local data is wiped. */
export function clearAllChatThreads(): void {
  const contactIds = [...threadsByContactId.keys()];

  threadsByContactId.clear();
  contactIds.forEach((contactId) => notify(contactId, EMPTY_THREAD));
}

/**
 * Resolves stored media paths as messages enter the store.
 *
 * Paths are persisted in a portable form and rebuilt for the current install at
 * read time. Doing that resolution once, on the way in, means every consumer
 * sees the same usable path — the point of having a single source of truth. The
 * durable copy on disk keeps its portable form; this only affects memory.
 *
 * Returns the original object when nothing needed changing, so unchanged
 * messages stay referentially identical and memoized rows do not re-render.
 */
function withResolvedMediaPaths(message: ChatMessage): ChatMessage {
  const media = message.media;
  const mediaItems = message.mediaItems;

  const resolvedMedia = media ? resolveMediaPath(media) : media;
  const resolvedMediaItems = Array.isArray(mediaItems)
    ? mediaItems.map(resolveMediaPath)
    : mediaItems;

  const didMediaChange = resolvedMedia !== media;
  const didItemsChange = Array.isArray(mediaItems) &&
    Array.isArray(resolvedMediaItems) &&
    resolvedMediaItems.some((item, index) => item !== mediaItems[index]);

  if (!didMediaChange && !didItemsChange) {
    return message;
  }

  return {
    ...message,
    media: resolvedMedia,
    mediaItems: resolvedMediaItems
  };
}

function resolveMediaPath(media: ChatMediaAttachment): ChatMediaAttachment {
  if (!media?.localUri) {
    return media;
  }

  const resolvedUri = getMediaLocalUri(media);

  return resolvedUri === media.localUri ? media : { ...media, localUri: resolvedUri };
}

function commitThread(contactId: string, messages: ChatMessage[]): void {
  const current = getChatThread(contactId);
  const resolved = messages.map(withResolvedMediaPaths);

  // Referential equality is what keeps memoized rows from re-rendering. If the
  // merge produced the same messages, the subscribers should not hear about it.
  if (areThreadsIdentical(current, resolved)) {
    return;
  }

  threadsByContactId.set(contactId, resolved);
  notify(contactId, resolved);
}

function areThreadsIdentical(first: ChatMessage[], second: ChatMessage[]): boolean {
  if (first === second) {
    return true;
  }

  if (first.length !== second.length) {
    return false;
  }

  return first.every((message, index) => message === second[index]);
}

function notify(contactId: string, messages: ChatMessage[]): void {
  const listeners = listenersByContactId.get(contactId);

  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(messages);
    } catch {
      // One failing subscriber must not stop the others from updating.
    }
  });
}
