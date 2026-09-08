/**
 * How outstanding scheduled messages are described.
 *
 * Kept away from the component so the wording can be checked directly. It reads
 * like a small thing, and the first version of it was wrong in a way that
 * mattered: the banner said "1 message scheduled" for a message that had
 * already been sent, and would have said exactly the same for one that failed.
 * A line that is the only thing on screen about a message has to be true.
 */

export function describeScheduledCounts(waitingCount: number, failedCount: number): string {
  const waiting = waitingCount === 1 ? '1 message waiting' : `${waitingCount} messages waiting`;

  // Said separately rather than folded into a total. "3 messages waiting" when
  // one of them has already failed hides the only part worth acting on.
  if (waitingCount && failedCount) {
    const failed = failedCount === 1 ? '1 could not be sent' : `${failedCount} could not be sent`;

    return `${waiting}, ${failed}`;
  }

  if (failedCount) {
    return failedCount === 1
      ? '1 message could not be sent'
      : `${failedCount} messages could not be sent`;
  }

  return waiting;
}
