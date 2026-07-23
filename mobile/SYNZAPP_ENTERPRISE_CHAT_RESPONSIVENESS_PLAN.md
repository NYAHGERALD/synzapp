# Synzapp Enterprise Chat Responsiveness Plan

## Objective

Make Synzapp mobile chat feel immediate and reliable at enterprise scale, especially when conversations contain many text messages, photos, videos, receipts, reactions, and offline records.

## Current Problem

The chat screen is doing too much work on the main UI path:

- The conversation thread renders every message at once with a `ScrollView`.
- Message grouping is rebuilt during render instead of memoized.
- Chat/contact lists are derived repeatedly during render.
- Automatic media download checks can scan every message in the active thread.
- Media persistence can rewrite large cached conversations after a small media state change.

This can make taps, long presses, media previews, typing, and navigation feel delayed or frozen.

## Enterprise Fix

### 1. Virtualize The Conversation Thread

Replace full-thread `ScrollView` rendering with `FlatList` virtualization so only visible message rows are mounted. This keeps the app responsive when conversations grow from dozens to thousands of messages.

### 2. Memoize Expensive Derived Data

Memoize:

- Chat contact rows
- Active, archived, spam, group, and unread counts
- Approved employee list rows
- Unique messages
- Date-grouped message thread items
- Search result inputs

This prevents unrelated state changes from rebuilding large arrays.

### 3. Control Automatic Media Work

Automatic media downloads should prioritize the latest visible conversation window instead of scanning the entire history on every state update. Older media remains available on demand when the user scrolls or opens it.

### 4. Preserve Existing User Experience

Keep:

- Instant optimistic outgoing messages
- Reply jump behavior
- Search navigation
- Scroll-to-latest behavior
- Long-press menus
- Media preview and playback
- Offline cache behavior

### 5. Next Scale Layer

After the render path is stable, the next enterprise layer is row-level SQLite media updates and a dedicated background queue worker. That prevents media cache updates from rewriting a full conversation record.

## Verification

- TypeScript check must pass.
- The app must still build locally.
- Chat should remain usable with long histories and media-heavy threads.
- Message send, media open, long press, forward, reply, search, and scroll-to-latest behavior must remain intact.

## Implementation Status

Completed in this pass:

- Conversation rendering now uses a virtualized message list.
- Message thread grouping is memoized.
- Chat contact, archive, unread, group, call, and employee list derivations are memoized.
- Automatic media download scans are limited to the recent message window.
- Media availability updates now use a direct encrypted SQLite row update before falling back to the full conversation save path.
- TypeScript and native build preflight checks pass.

Next scale layer:

- Split the chat screen into smaller memoized components.
- Add a dedicated background sync worker for pending sends, receipts, and media retries.
- Add visible-row media prefetching so older media begins downloading only as the user approaches it.
