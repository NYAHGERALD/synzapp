# Synzapp reply threads — plan of record

Written 8 September 2026, before any code. It is the source of truth for this
change; where the code and this document disagree, one of them is wrong and it
must be settled rather than guessed at.

## 1. What is being built

Two halves, and the second is the one that is easy to under-describe.

**Composing.** Slide a message to the right and it goes into focus: the
conversation behind it goes quiet, that message stays sharp, and the composer
stays open. Send as many replies as you like without leaving. Close it and the
whole conversation returns.

**Reading.** The replies are ordinary messages, so they appear in the
conversation **at the bottom, as the newest messages** — that is when they were
sent. They are grouped by a bracket rail, with a **wireframe copy of the
original at the top of the group**, so somebody reading knows what is being
answered without scrolling back for it.

**The original never moves.** It stays exactly where it was in the conversation
and gains one line beneath it: **"5 replies"**. Tapping that scrolls down to the
group and briefly highlights it.

That last point is the whole shape of the feature. The parent and its replies
are deliberately far apart — the parent keeps its place in the history, the
replies keep theirs — and the count and the wireframe copy are the two things
that tie them together across that distance.

**The focused view is for composing, not for reading.** Reading always happens
in the conversation. A count that opened an overlay would be a read action
wearing a compose button.

## 2. What already exists

Checked in the code, not assumed.

Every message already carries its parent:

```ts
replyTo: { messageId, senderUid, sentAt, text } | null
```

It is sealed with the message, normalised on both sides (`normalizeReplyReference`),
built by `buildReplyReference`, and already draws the quoted-reply bubble.
`replyTarget` in the chat screen already survives a send, so **sending several
replies in a row needs nothing new** — the composer simply stops clearing it.

So the link between a reply and its parent is already there. It has never been
drawn as a thread.

## 3. The one real problem: counting

**A count that is quietly wrong is worse than no count.**

iMessage holds the whole conversation on the device. Synzapp pages history
deliberately — it is why a thread with three videos opens quickly. Grouping by
`replyTo.messageId` therefore only ever sees what is currently loaded, so a
message from March with four replies would say **"1 reply"** because that is all
that is in memory. Somebody would open the thread believing they had read it.

### The correction that matters

The first draft said the count should be stored on the server, "because the
envelope carries the parent id in the clear for delivery."

**That is false, and checking it changed the design.** `replyTo` is passed to
`encryptChatMessage` and sealed inside the payload. The word `replyTo` does not
appear anywhere in the backend. The server has never known which message answers
which, and the only thing sent beside the ciphertext is `mediaIds`, which
carries a comment explaining why that exception exists.

Making the server maintain the count would mean sending it the parent id in the
clear on every reply. That is not content, but it is a **conversation graph** —
who answered what, and when — for a product whose whole claim is that readable
content stays on approved devices. It is the wrong price for a number.

### Counted on the device, from the device's own store

The phone already keeps the whole conversation in encrypted SQLite. Crucially,
`local_messages` already stores `message_id`, `sender_uid`, `sent_at_ms` and
`delivery_status` as **plain columns**, with only `payload` encrypted.

So the count is a column and a query:

- `reply_to_message_id TEXT` on `local_messages`, written when a message is
  stored, read straight out of the reply reference the phone already has.
- An index on it, and a `GROUP BY` for the counts. **Nothing is decrypted to
  count**, which matters: a conversation of five thousand cannot be decrypted to
  show one number, and JavaScript crypto over a whole thread is the freeze this
  codebase has already been bitten by three times.
- The server learns nothing new. No new field, no new route, no new metadata.

**What this costs.** The count is only as complete as that device's history. A
phone restored from a backup that does not reach back far enough will undercount
on old messages until it has synced. That is honest and self-correcting, and it
is a far smaller price than handing the server a map of who answers whom.

## 4. Tapping the count when the replies are not loaded

Because the replies live in the conversation rather than in an overlay, there is
**no thread to fetch for reading**. The transcript already has them, or will as
it pages.

The count row scrolls to the group with `scrollToMessage`, which the thread
already has for search. One case needs care: the replies may be newer than what
is loaded, or the parent older. When the group is not in memory, the row pages
towards it the way search already does, and says so while it works. It never
silently does nothing, which is what a scroll to a message that is not there
looks like.

## 5. Blur, and Android

**A dimmed scrim, not a blur.**

Real background blur is native on iOS and expensive and inconsistent on Android,
where it varies by manufacturer. The purpose is focus, and a scrim gives the
same focus at the same frame rate on both. One appearance on both platforms is
worth more than a blur on half the devices.

`colors.overlay` already exists for this and is what every modal in the app
dims with.

## 6. What it looks like

Ours, not Apple's.

**In the conversation**, a reply group is:

- A **wireframe copy of the original** at the top: `groupedCard` fill,
  `colors.separator` outline, ink text, no sender colour. It is context, not a
  message, and it is never tappable as one.
- The **replies** beneath it as ordinary Synzapp bubbles, unchanged.
- A **bracket rail** down the left, `colors.separator`, 2 points, from the
  wireframe copy to the last reply, enclosing the group.

**At the original's own position**, one row beneath it: **"5 replies"** in
`colors.link`, because it takes you somewhere.

**In the focused view**:

- The conversation behind is dimmed with `colors.overlay`.
- The message being answered is drawn as it normally is — sharp, not wireframe.
  The wireframe is for the group in the transcript, where the original is
  elsewhere; here it is the subject.
- The composer is the one the thread already uses, with its reply target held
  rather than cleared after each send.
- Close is `CircleIconButton` with `action="close"`, top right.

Bottom inset through `resolveScreenBottomInset`, and the keyboard through
`react-native-keyboard-controller`, as everywhere else.

## 7. Files

| File | Change |
| --- | --- |
| **No backend change at all.** | The server never sees a reply and does not need to. |
| `mobile/src/services/localChatSqlite.ts` | `reply_to_message_id` column and its index; the count query. |
| `mobile/src/services/replyThreads.ts` | **New.** Pure: grouping consecutive replies, the wording of the count, which message a group belongs to. Tested. |
| `mobile/src/components/messages/ReplyThreadView.tsx` | **New.** The focused view, for composing. |
| `mobile/src/components/messages/ReplyGroup.tsx` | **New.** The bracket rail, the wireframe copy, the replies inside it. |
| `mobile/src/components/messages/MessageThread.tsx` | The count row under a parent, grouping consecutive replies, and the scroll. |

## 8. Not in this change

- Reactions on replies, and replies to replies. One level, as iMessage has.
- Notifications for a reply, which today are the ordinary message notification.
- RAILS, LSW, RCA and the interpreter are not touched.

## 9. Decisions taken

- **Tapping the count scrolls to the group**, it does not open the focused
  view. The replies are already in the conversation; the count's job is to
  cross the distance to them. An earlier draft of this plan had it opening the
  focused view, which is what iMessage does — and which is a read action
  wearing a compose button.
- **Replies are grouped where they were sent**, at the bottom, and the original
  never moves. Moving a message because somebody answered it would rewrite the
  history of the conversation.
- **The wireframe copy appears in the group, not in the focused view.** In the
  group it stands in for a message that is elsewhere. In the focused view that
  message is the subject and is drawn as itself.

## 10. Done means

- `npx tsc --noEmit` clean, both sides.
- `npx vitest run` (mobile) passes. The backend is untouched, so its tests
  should be unchanged — if they move, something was edited that should not have
  been.
- Built and installed on a device, and the log read rather than the exit code.
- A reply sent from the focused view appears in the conversation, and the count
  on the parent is right after a reload — the case the stored count exists for.
