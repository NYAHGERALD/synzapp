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

---

# Pass 2 — Android Receive Delay, Send Freeze, and Scale (2026-09-12)

## What was reported

Messages received on Android disappear for a few seconds before showing up.
Sending sometimes feels like the send button is delayed or frozen. The app must
stay responsive with 1000+ messages in a thread and 100+ chats in the list.

## What was found

Five issues, each traced to a specific line. Two are defects, three are cost.

### Finding 1 — The send button freezes permanently (defect)

`AdminChatScreen.tsx`, `handleSendMessage`.

The re-entry guard is set to `true`, and then the device-not-ready check returns
without clearing it. The only reset lives in the `finally` of the try block
further down, which that return never reaches. From that point the guard stays
`true` and every later tap returns immediately at the top of the function. The
button is not slow; it is dead until the screen is remounted.

This is the "send button freeze" in the report.

### Finding 2 — Realtime events are unordered and do network work before painting (defect)

`AdminChatScreen.tsx`, socket `onmessage` and the `conversationMessages` /
`conversationEncryptedEnvelopes` branch of `handleChatRealtimePayload`.

Two problems stack.

The socket handler is `void handleChatRealtimePayload(event.data)` — fire and
forget. Each arriving message starts its own long async chain, and nothing keeps
those chains in order. If the chain for message B finishes before the chain for
message A, A finishes last and calls `setMessages` with its older snapshot. B
vanishes from the thread until the next event repaints it. The only guard checks
which conversation is open, not which event is newer.

Before `setMessages` is reached, the handler awaits a contact cache write, two
cache reads, `getIdToken()` (which reaches the network when the token needs
refreshing), `grantGroupChatHistoryKeys` (network, group chats), envelope
decryption (network plus crypto), and a hidden-message filter.

Together these are the "disappears for a few seconds, then shows up".

### Finding 3 — Android row clipping (cost, Android only)

`MessageThread.tsx` sets `removeClippedSubviews` on Android only. With
variable-height rows this is a known source of blank rows on that platform. The
list is also not inverted, so each new message triggers a content-size change and
a programmatic scroll, which is when clipped rows tend to paint empty.

### Finding 4 — Every chat row re-renders on every update (cost, 100+ chats)

`ChatRow.tsx` exports a plain function with no `React.memo`, and `ChatsTab.tsx`
builds `renderItem` inline, constructing six fresh callbacks per row per render.
There is no `initialNumToRender`, `windowSize`, or `maxToRenderPerBatch`. A
single typing indicator or unread-count change re-renders the whole list.

### Finding 5 — Four full sorts per received message (cost, 1000+ messages)

`chatMessageReconciliation.ts` sorts with `sentAt.localeCompare(sentAt)`. These
are ISO-8601 ASCII timestamps, where plain relational comparison gives the same
ordering; `localeCompare` runs full Unicode collation and is far slower.
`uniqueChatMessages` is called three times over the whole history for a single
incoming message, plus a fourth time in `MessageThread`. On the JS thread — the
same thread that drives keyboard animation, which is part of why the keyboard
feels sticky.

## The fixes

### Fix 1 — Release the send guard on every exit

Move the device-ready check above the guard, so the guard is only taken once the
function is certain to reach its `finally`. Smallest possible change; no
behaviour moves.

### Fix 2 — Serialise realtime events, and paint before the slow work

Two parts, both conservative.

Serialise: chain each payload onto a promise so the handlers run one after
another in arrival order. This alone removes the disappearing message, because
an older snapshot can no longer land after a newer one.

Order the work: keep the existing pipeline exactly as it is, but stamp each
conversation update with a monotonically increasing sequence number and ignore a
result whose sequence is older than what has already been applied. This is a
belt-and-braces guard for any path that still resolves out of order.

Deliberately **not** doing in this pass: restructuring the decrypt/token calls to
render first and reconcile after. That is the real latency fix but it changes the
shape of the receive pipeline, and this pass is about removing the defect without
disturbing a shipped path.

### Fix 3 — Leave `removeClippedSubviews` alone for now

It is a trade-off, not a bug: turning it off costs Android memory on long
threads. Fix 2 removes the disappearing message on its own. If blank rows remain
after Fix 2, revisit with a measurement rather than a guess.

### Fix 4 — Memoize the chat row and hoist its callbacks

Wrap `ChatRow` in `React.memo` with an explicit comparator, and give the list the
standard windowing props. Callbacks stay inline for now because hoisting them
requires threading the chat item through, which is a larger change; the memo
comparator is what stops the re-render.

### Fix 5 — Compare ISO timestamps directly

Replace `localeCompare` with relational comparison in the message sort, keeping
the message id as the tie-break so ordering stays stable for identical
timestamps.

## What must not break

- Message send, media send, voice notes, reply, forward, delete, search,
  scroll-to-latest, and scheduled messages.
- Offline queue and pending-message reconciliation.
- Group history key granting and envelope decryption.
- The reply target deliberately staying set after a send.

## Verification

- TypeScript check passes.
- Mobile unit tests pass.
- A test covering the send guard releasing on the device-not-ready path.
- A test covering out-of-order conversation updates keeping the newer snapshot.
- A test covering ISO timestamp ordering, including identical timestamps.

## Implementation Status

Done in this pass:

- **Finding 1, the send freeze.** The device-ready check moved above the
  re-entry guard, so the guard is only raised once the function is certain to
  reach the `finally` that lowers it. Nothing returns in between any more.
- **Finding 2, the disappearing message.** Realtime payloads now run through a
  serial queue, so arrival order is the order they are applied. The chaining was
  pulled out into `services/serialTaskQueue.ts` rather than left inline in the
  screen, so the behaviour that fixes the bug is the behaviour under test.
- **Finding 5, the sort.** `compareChatMessagesBySentAt` replaces
  `sentAt.localeCompare(sentAt)`, with the message id as a tie-break.
- **Finding 4, partially.** The chat list got windowing props
  (`initialNumToRender`, `maxToRenderPerBatch`, `updateCellsBatchingPeriod`,
  `windowSize`), which bound how many rows mount at all.

Tests added:

- `serialTaskQueue.test.ts` — four cases, the first reproducing the bug exactly
  (a slow first payload and a fast second one) and asserting the newer result
  survives. Also that one throwing task does not stop the ones behind it.
- `chatMessageReconciliation.test.ts` — three cases, including an equivalence
  check that the new comparator returns the same sign as `localeCompare` across
  a spread of timestamps, so the ordering provably did not change.

Typecheck clean. 767 tests pass across 62 files.

### Deliberately not done, and why

**`React.memo` on `ChatRow` (rest of Finding 4).** The plan called for it. On
reading the call site, the row handlers in `AdminChatScreen` are plain `function`
declarations recreated each render, and `ChatsTab` wraps them in fresh arrows per
row. A comparator that ignored callback identity — the only kind that would
actually stop the re-render — would let a memoized row keep calling a previous
render's handler, reading that render's state. That is a stale-closure bug traded
for a render saving, so the handlers have to be hoisted first. Real work, and
separate.

**The sequence-number guard (part of Finding 2).** Also planned, also dropped.
Serialising already removes every realtime-versus-realtime race, which is the
reported defect. A sequence guard would additionally have to reason about the
other paths that call `setMessages` — initial load, older-message paging, pending
sync — and a naive "ignore anything older" would discard legitimate updates from
those. Not worth the risk for a race that is already closed.

**`removeClippedSubviews` on Android (Finding 3).** Unchanged, as planned. It is
a memory trade-off, not a defect, and the serialisation should account for the
symptom on its own. Revisit only with a measurement.

### Follow-up pass: the token fetch

The id token is only ever used to talk to the server about encrypted envelopes,
but it was fetched at the top of every conversation event — including plain
message events that never touch it, and envelope events carrying none. When the
token needs refreshing that is a network round trip standing between a message
arriving and it appearing on screen, on the JS thread, for no purpose.

`createDeferredIdToken` now hands back a getter that fetches at most once per
event, and only if something asks. Both event handlers use it. Plain message
events no longer wait on the network at all before painting.

### Correction: the paging guard was not a problem

The earlier note that `onLoadOlderMessages` fires repeatedly near the top of the
thread was right about the calls and wrong about the cost.
`loadOlderCachedMessagesForActiveChat` already guards on
`isLoadingOlderCachedMessagesRef`, set synchronously and released in a `finally`,
so the extra calls return immediately. Adding a second guard in the scroll
handler would have risked exactly the stuck-flag bug fixed in Finding 1. No
change made.

### Follow-up pass: group chats

Direct chats went snappy once the token fetch became lazy, because a plain
message event never touches the token. Group chats stayed slow, which narrowed
the remaining cost to something only groups do.

It was `grantGroupChatHistoryKeys`, awaited in front of decryption at both event
handlers. It is a POST that uploads history keys so the other members' devices
can read this stretch of the conversation back later. Nothing below it reads its
result, its failures were already swallowed, and our own decryption uses a
private key already on the device — so it never needed to finish first. Awaited,
it put a whole network round trip between a group message arriving and it being
shown.

It is now started and left to finish on its own, at both sites. It still runs,
still once per event, and still tolerates failure.

Worth noting the existing `[SynzappChatReceive]` telemetry could not have caught
this: `decryptStartedAtMs` is taken *after* the grant, so the grant's cost was
never inside `totalMs`.

What remains before a group message paints is two cache reads, a cache write,
`getIdToken` (Firebase returns a cached token unless it is near expiry), local
envelope decryption, and the hidden-message filter. No network round trip.

### Still open

- Rendering the arriving message before the cache reads, then reconciling. The
  network is off the paint path now; what is left is local work. Worth measuring
  before reshaping anything further.
- Hoist the chat list handlers, then memoize `ChatRow`.
