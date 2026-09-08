/**
 * What the footer bar calls each tab.
 *
 * The name a tab is known by in code and the word a person reads are not the
 * same thing, and tying them together is what makes renaming a tab a hunt
 * through the screen. The key stays; only the label moves.
 *
 * It exists for one word. "Announcements" is wider than a sixth of the bar at
 * the size the labels are set in, and the shrink-to-fit that was supposed to
 * rescue it (`adjustsFontSizeToFit`) is iOS only — so on Android it did not
 * shrink, and with nothing clipping it, it ran into the tab beside it.
 */

const FOOTER_TAB_LABELS: Record<string, string> = {
  Announcements: 'Notices'
};

export function getFooterTabLabel(tab: string): string {
  return FOOTER_TAB_LABELS[tab] || tab;
}
