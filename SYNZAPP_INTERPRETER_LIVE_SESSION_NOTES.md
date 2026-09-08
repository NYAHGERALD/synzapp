# Interpreter live session — reliability notes

Worked on 31 August 2026 at the product owner's explicit request. The interpreter
had previously been marked out of scope; this records that the boundary was
lifted deliberately, not crossed by accident.

**The requirement:** a person should be able to run a live interpreted meeting
for as long as they need — speak, tap Respond, hear the reply, carry on — and
never be shown an error while doing it.

---

## What was wrong

**Every realtime event that called itself an error was shown to the user.** Two
filters already existed for known-harmless events, which shows somebody had met
this before, but they were narrow. A cancelled response, a turn requested while
the previous one was finishing, an interrupted reply — all ordinary in a
push-to-talk interpreter — surfaced as failures in the middle of a meeting.

**Those errors were sticky.** The handler also marked the language session's
status as `error`. A single mistimed tap left the meeting looking broken for the
rest of its life.

**Tapping Respond too early was reported as a fault.** "The interpreter has no
captured speech for this response" is not a fault. The person tapped before
speaking.

**A dropped connection ended the meeting.** If the session had gone, Respond
showed "The live interpreter session is not ready. Tap Listen and try again" and
stopped. The person was handed a problem instead of a working interpreter.

---

## What changed

**Recoverable turn events are filtered and logged, never shown.** Cancellations,
interruptions and overlapping turns are written to the console so a real fault
is still visible to an engineer, and nothing interrupts the meeting.

**A separate `onNotice` channel** carries guidance — "Nothing captured yet —
speak, then tap Respond" — as a quiet line under the controls. It does not mark
the session as errored, so nothing about it persists.

**A lost session reconnects itself.** Respond now restarts the session and says
"Reconnecting the interpreter…", then "Reconnected. Speak, then tap Respond."
An error is shown only if the reconnect itself fails.

---

## The principle worth keeping

**An error shown to a person should be one they can act on.**

Everything else belongs in the log. This matters more here than in most places:
an interpreter is used in front of customers, and a person who has seen it
report a fault mid-meeting will not risk it in the next one. The feature is lost
not because it failed, but because it said it had.
