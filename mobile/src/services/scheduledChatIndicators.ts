import type { ScheduledChatMessage } from './chatApi';

/**
 * Which conversations have something outstanding, for the chat list.
 *
 * A scheduled message used to exist only inside the chat it belonged to. That
 * was tolerable for one still waiting — it goes on its own, and nobody needs
 * reminding. It was not tolerable for one that **failed**: the message never
 * went, the only sign of it was inside a thread, and a thread nobody opens is a
 * thread nobody is told about.
 *
 * So the list carries a mark. A failure outranks a wait wherever both exist in
 * the same conversation, because one of them needs a person and the other does
 * not.
 */

export interface ScheduledChatState {
  failed: number;
  waiting: number;
}

export function buildScheduledChatStates(
  scheduledMessages: ScheduledChatMessage[]
): Record<string, ScheduledChatState> {
  const states: Record<string, ScheduledChatState> = {};

  for (const message of scheduledMessages) {
    if (!message.contactId) {
      continue;
    }

    const state = states[message.contactId] || { failed: 0, waiting: 0 };

    if (message.status === 'FAILED') {
      state.failed += 1;
    } else if (message.status === 'SCHEDULED') {
      state.waiting += 1;
    }

    states[message.contactId] = state;
  }

  return states;
}
