/**
 * Layout measurements shared by the stylesheet and the screen.
 *
 * They live in their own file because both the composed stylesheet and its
 * individual parts need them — importing from the composing file would make the
 * parts depend on the thing that imports them.
 */

export const CHAT_ROW_SWIPE_TRIGGER = 28;
export const MESSAGE_INPUT_MIN_HEIGHT = 38;
export const MESSAGE_INPUT_MAX_HEIGHT = 140;
export const CHAT_ROW_LEFT_ACTION_WIDTH = 156;
export const CHAT_ROW_RIGHT_ACTION_WIDTH = 216;
export const SPAM_ROW_ACTION_WIDTH = 118;
export const LSW_DAILY_ROW_ACTION_WIDTH = 104;
export const AI_HISTORY_ROW_ACTION_WIDTH = 118;
export const KEY_RESULT_ROW_ACTION_WIDTH = 124;
