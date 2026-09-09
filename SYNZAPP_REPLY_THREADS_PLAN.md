# Synzapp reply threads — plan of record

Written 8 September 2026, before any code. It is the source of truth for this
change; where the code and this document disagree, one of them is wrong and it
must be settled rather than guessed at.

## 1. What is being built

Replying to a message opens a **focused view**: the conversation behind it goes
quiet, the message being answered stays sharp, and its replies gather beneath
it joined by a rail down the left. Several replies can be sent without leaving.
Closing it returns to the whole conversation.

In the conversation, a message that has been answered carries **"3 replies"**
under it. Tapping that opens the same focused view.

The reference is iMessage's inline replies, which do three separate things
people tend to describe as one:

1. **A focused view** — the rest of the thread blurs, the parent stays sharp.
2. **A real thread** — replies are gathered and counted, readable on their own.
3. **A wireframe parent** — in the focused view the parent is redrawn as an
   outlined bubble, so it reads as context rather than as another message.

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

**The count is stored on the parent, not derived on the phone.**

- `replyCount` on the message record, incremented in the same transaction that
  stores a reply.
- Incremented from `replyTo.messageId`, which the server already receives.
- Never decremented below zero; a deleted reply decrements it.
- The phone renders what the server sends and never counts rows itself.

**Nothing about the count is private.** It is a number of replies, not their
content, and the server already knows the parent id because the envelope
carries it in the clear for delivery. No encrypted content is read to maintain
it.

## 4. Opening a thread whose replies are not loaded

Two answers, and the plan takes the second.

- **Show what is loaded.** Cheap, and lies exactly as the derived count would.
- **Fetch the thread.** `GET /api/chat/messages/:messageId/replies`, the same
  paging shape the conversation already uses.

The focused view opens with whatever is already in memory so it is instant, and
fetches the rest behind that. If the fetch fails, the view says how many replies
it could not load rather than pretending it has them all.

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

- The **parent** redraws as an outlined bubble: `groupedCard` fill,
  `colors.separator` outline, ink text. No sender colour — it is context.
- The **replies** are ordinary Synzapp bubbles, unchanged.
- A **rail** runs down the left from the parent to the last reply,
  `colors.separator`, 2 points, joining them.
- The composer is the one the thread already uses.
- Close is `CircleIconButton` with `action="close"`, top right.
- The count row under a parent in the conversation reads **"3 replies"** in
  `colors.link` — a link, because it opens something.

Bottom inset through `resolveScreenBottomInset`, and the keyboard through
`react-native-keyboard-controller`, as everywhere else.

## 7. Files

| File | Change |
| --- | --- |
| `backend/src/services/chatReplyThreads.ts` | **New.** Pure: counting rules, what a decrement may do, what a thread page contains. Tested. |
| `backend/src/services/…messageService` | `replyCount` maintained in the store transaction. |
| `backend/src/routes/chatRoutes.ts` | The replies page, App Check, active device, audit on both branches. |
| `mobile/src/services/replyThreads.ts` | **New.** Pure: grouping loaded messages, the wording of the count, what the view shows while a fetch is in flight. Tested. |
| `mobile/src/components/messages/ReplyThreadView.tsx` | **New.** The focused view. |
| `mobile/src/components/messages/MessageThread.tsx` | The count row, and opening the view. |

## 8. Not in this change

- Reactions on replies, and replies to replies. One level, as iMessage has.
- Notifications for a reply, which today are the ordinary message notification.
- RAILS, LSW, RCA and the interpreter are not touched.

## 9. Two decisions taken

- **Tapping the count opens the focused view.** It is the only thing it could
  usefully do.
- **The focused view fetches**, per section 4. Showing only what happens to be
  loaded reintroduces the exact problem the stored count solves.

## 10. Done means

- `npx tsc --noEmit` clean, both sides.
- `npm test` (backend) and `npx vitest run` (mobile) pass, including the two
  coverage tests that read the route file.
- Built and installed on a device, and the log read rather than the exit code.
- A reply sent from the focused view appears in the conversation, and the count
  on the parent is right after a reload — the case the stored count exists for.
