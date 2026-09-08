/**
 * Who is typing, and how that is said.
 *
 * Three places show it — the chat header, the thread, and the row in the chat
 * list — and they must agree. Working the sentence out separately in each is
 * how one of them ends up saying "2 people are typing" while another says a
 * name, for the same moment.
 *
 * Nothing here is stored. Typing is true for a second or two and meaningless
 * afterwards, so it lives in memory on both sides of the wire.
 */

export interface TypingParticipant {
  name: string;
  /** When this notice arrived, so a stale one can be ignored. */
  startedAtMs: number;
  uid: string;
}

/**
 * How long a notice is trusted without being renewed.
 *
 * The server expires its own after seven seconds and announces the stop, so
 * this only catches the case where that announcement never arrives — a dropped
 * socket, a backgrounded app. Slightly longer than the server's window, so the
 * two do not race and blink.
 */
export const TYPING_STALE_AFTER_MS = 8000;

/**
 * How often the phone says "still typing" while somebody keeps writing.
 *
 * Not per keystroke. A message of two hundred characters would otherwise be two
 * hundred broadcasts to every other phone in the conversation.
 */
export const TYPING_HEARTBEAT_MS = 3000;

/** The ones still worth showing. */
export function activeTypists(
  participants: TypingParticipant[],
  nowMs: number
): TypingParticipant[] {
  return participants.filter((participant) => nowMs - participant.startedAtMs < TYPING_STALE_AFTER_MS);
}

/**
 * What to say, or null when nobody is typing.
 *
 * A direct chat needs no name — there is only one other person, and putting
 * their name in the header directly under their name reads as a stutter. A
 * group names them, up to two, and counts beyond that.
 */
export function describeTyping(input: {
  isGroup: boolean;
  nowMs: number;
  participants: TypingParticipant[];
}): string | null {
  const active = activeTypists(input.participants, input.nowMs)
    .slice()
    .sort((left, right) => left.startedAtMs - right.startedAtMs);

  if (!active.length) {
    return null;
  }

  if (!input.isGroup) {
    return 'typing…';
  }

  const names = active.map((participant) => firstName(participant.name));

  if (names.length === 1) {
    return `${names[0]} is typing…`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing…`;
  }

  return `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;
}

/**
 * The shorter form for a chat list row, which has one line and shares it with a
 * timestamp and an unread count.
 */
export function describeTypingForChatList(input: {
  isGroup: boolean;
  nowMs: number;
  participants: TypingParticipant[];
}): string | null {
  const active = activeTypists(input.participants, input.nowMs);

  if (!active.length) {
    return null;
  }

  if (!input.isGroup || active.length > 1) {
    return 'typing…';
  }

  return `${firstName(active[0].name)} is typing…`;
}

/**
 * Adds or removes one person from what a conversation is showing.
 *
 * Returns the same array when nothing changed, so a component reading it does
 * not re-render on every renewal the server sends.
 */
export function applyTypingUpdate(
  participants: TypingParticipant[],
  update: { isTyping: boolean; name: string; nowMs: number; uid: string }
): TypingParticipant[] {
  const existing = participants.find((participant) => participant.uid === update.uid);

  if (!update.isTyping) {
    return existing
      ? participants.filter((participant) => participant.uid !== update.uid)
      : participants;
  }

  if (existing) {
    // Renewing the clock in place, rather than moving them to the end, keeps
    // the order they started typing in — which is the order the names read in.
    return participants.map((participant) => (
      participant.uid === update.uid
        ? { ...participant, name: update.name, startedAtMs: update.nowMs }
        : participant
    ));
  }

  return [...participants, { name: update.name, startedAtMs: update.nowMs, uid: update.uid }];
}

/**
 * The people to draw beside a typing row in a group, and the sentence to put
 * next to them.
 *
 * Full names here, not first names. This row sits in the thread with a face
 * against it and room for a line of its own, so the shortening the chat list
 * needs would only make it ambiguous between two colleagues called Anna.
 *
 * Only ever two faces. A third avatar makes the row taller than a message
 * bubble and pushes the conversation up the screen.
 */
export function describeGroupTypingRow(input: {
  nowMs: number;
  participants: TypingParticipant[];
}): { text: string; typists: TypingParticipant[] } | null {
  const active = activeTypists(input.participants, input.nowMs)
    .slice()
    .sort((left, right) => left.startedAtMs - right.startedAtMs);

  if (!active.length) {
    return null;
  }

  const shown = active.slice(0, 2);

  if (active.length === 1) {
    return { text: `${fullName(active[0].name)} is typing`, typists: shown };
  }

  if (active.length === 2) {
    return {
      text: `${fullName(active[0].name)} and ${fullName(active[1].name)} are typing`,
      typists: shown
    };
  }

  return {
    text: `${fullName(active[0].name)} and ${active.length - 1} others are typing`,
    typists: shown
  };
}

function fullName(name: string): string {
  return name.trim() || 'Someone';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim() || 'Someone';
}
