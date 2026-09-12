export {
  AI_HISTORY_ROW_ACTION_WIDTH,
  CHAT_ROW_LEFT_ACTION_WIDTH,
  CHAT_ROW_RIGHT_ACTION_WIDTH,
  CHAT_ROW_SWIPE_TRIGGER,
  KEY_RESULT_ROW_ACTION_WIDTH,
  LSW_DAILY_ROW_ACTION_WIDTH,
  MESSAGE_INPUT_MAX_HEIGHT,
  MESSAGE_INPUT_MIN_HEIGHT,
  SPAM_ROW_ACTION_WIDTH,
} from './adminChatStyles/metrics';
export { FOOTER_BAR_HORIZONTAL_PADDING } from './adminChatStyles/coreStyles';

/**
 * The Admin chat screen's stylesheet.
 *
 * Lifted out of the screen unchanged. It is a third of the file on its own, and
 * no component can be extracted from that screen while the styles it needs are
 * trapped inside it — so this is the move the rest of the decomposition stands
 * on.
 *
 * The layout constants below live here rather than in the screen because both
 * the screen and these styles need them. Keeping them here means the dependency
 * runs one way: the screen imports the styles, never the reverse.
 */

/** How far a chat row must be dragged before its swipe actions latch open. */
import { coreStyles } from './adminChatStyles/coreStyles';
import { chatStyles } from './adminChatStyles/chatStyles';
import { callStyles } from './adminChatStyles/callStyles';
import { messageStyles } from './adminChatStyles/messageStyles';
import { directoryStyles } from './adminChatStyles/directoryStyles';
import { workspaceStyles } from './adminChatStyles/workspaceStyles';
import { companyStyles } from './adminChatStyles/companyStyles';
import { aiStyles } from './adminChatStyles/aiStyles';
import { groupStyles } from './adminChatStyles/groupStyles';
import { mediaStyles } from './adminChatStyles/mediaStyles';
import { settingsStyles } from './adminChatStyles/settingsStyles';

/**
 * The Admin chat stylesheet.
 *
 * Composed from per-area files so no single one is unreadable. Each part
 * registers its own styles and they are merged here, which keeps the literal
 * types `StyleSheet.create` infers — a plain object literal widens
 * `flexDirection: 'row'` to `string` and every style prop stops type-checking.
 */
export const styles = {
  ...coreStyles,
  ...chatStyles,
  ...callStyles,
  ...messageStyles,
  ...directoryStyles,
  ...workspaceStyles,
  ...companyStyles,
  ...aiStyles,
  ...groupStyles,
  ...mediaStyles,
  ...settingsStyles,
};
