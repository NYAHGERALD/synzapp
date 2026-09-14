/**
 * How an RCA report is divided into slides.
 *
 * Two things this has to get right, both learned the hard way.
 *
 * Nothing may be dropped. The deck this replaced fitted what would go on one
 * slide and reported the rest as "+ 6 additional items"; a report taken into a
 * meeting cannot summarise its own findings as a count of what is missing.
 *
 * And the plan has to be measured, not counted. Deciding "twelve fields fit"
 * put six rows of 0.92in below a start of 1.62in, which ran through the
 * evidence strip and out of the bottom of the slide. Rows carry their real
 * heights here, and the renderer places them at exactly these positions.
 *
 * No pptx import, so it can be tested.
 */

export interface RcaDeckField {
  label: string;
  value: string;
}

export interface RcaDeckRow {
  fields: RcaDeckField[];
  height: number;
  isWide: boolean;
}

/** Inches. A pair of short fields side by side, label above value. */
export const RCA_DECK_SHORT_ROW_HEIGHT = 0.88;

/** A value that needs the full width gets more room for the extra lines. */
export const RCA_DECK_WIDE_ROW_HEIGHT = 1.34;

/**
 * Long enough to read badly in a half-width column.
 *
 * An incident description runs to several lines, and setting it beside a
 * one-word field is what made the old slides look ragged.
 */
export const RCA_DECK_WIDE_VALUE_LENGTH = 110;

export function isRcaDeckWideField(field: RcaDeckField): boolean {
  return (field.value || '').replace(/\s+/g, ' ').trim().length > RCA_DECK_WIDE_VALUE_LENGTH;
}

/** Packs fields into rows: wide ones alone, short ones in pairs. */
export function planRcaDeckRows(fields: RcaDeckField[]): RcaDeckRow[] {
  const rows: RcaDeckRow[] = [];
  let pendingShort: RcaDeckField | null = null;

  const flushPending = () => {
    if (!pendingShort) {
      return;
    }

    rows.push({ fields: [pendingShort], height: RCA_DECK_SHORT_ROW_HEIGHT, isWide: false });
    pendingShort = null;
  };

  fields.forEach((field) => {
    if (isRcaDeckWideField(field)) {
      // A wide field never shares a row, so a half-built pair is closed first.
      flushPending();
      rows.push({ fields: [field], height: RCA_DECK_WIDE_ROW_HEIGHT, isWide: true });

      return;
    }

    if (pendingShort) {
      rows.push({ fields: [pendingShort, field], height: RCA_DECK_SHORT_ROW_HEIGHT, isWide: false });
      pendingShort = null;

      return;
    }

    pendingShort = field;
  });

  flushPending();

  return rows;
}

/**
 * Splits rows across slides by how tall they actually are.
 *
 * A row taller than a whole slide still gets placed rather than looping or
 * vanishing: it goes on a page of its own and the renderer shrinks it.
 */
export function paginateRcaDeckRows(rows: RcaDeckRow[], availableHeight: number): RcaDeckRow[][] {
  const pages: RcaDeckRow[][] = [];
  let page: RcaDeckRow[] = [];
  let used = 0;

  rows.forEach((row) => {
    if (page.length && used + row.height > availableHeight) {
      pages.push(page);
      page = [];
      used = 0;
    }

    page.push(row);
    used += row.height;
  });

  if (page.length) {
    pages.push(page);
  }

  return pages;
}

/** Everything above, in one call: fields to slide-sized pages of rows. */
export function planRcaDeckFieldPages(
  fields: RcaDeckField[],
  availableHeight: number
): RcaDeckRow[][] {
  return paginateRcaDeckRows(planRcaDeckRows(fields), availableHeight);
}

/**
 * Said as "2 of 3" rather than "continued".
 *
 * Somebody flicking back through a deck in a meeting needs to know how much of
 * an item they are looking at.
 */
export function getRcaDeckContinuationLabel(pageIndex: number, pageCount: number): string {
  return pageCount > 1 ? `${pageIndex + 1} of ${pageCount}` : '';
}

/** Trims a value for a slide, on a word boundary rather than mid-word. */
export function clipRcaDeckValue(value: string, maxLength: number): string {
  const text = (value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Whether a data URL is something PowerPoint will actually open.
 *
 * `addImage` accepts any base64 payload and embeds it without complaint, so an
 * evidence record that is a PDF — or a fetch that returned an error page —
 * produced a file PowerPoint refused to open at all, offering only to repair
 * it. The deck is worth more without a thumbnail than it is unopenable.
 */
export function isRcaDeckEmbeddableImage(dataUrl: string | null | undefined): boolean {
  return /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/i.test((dataUrl || '').trim());
}
