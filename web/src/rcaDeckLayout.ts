/**
 * How an RCA report is divided into slides.
 *
 * The deck this replaced fitted whatever would go on one slide and abandoned
 * the rest — four nodes per section, four fields per node, then a line saying
 * how much had been left out. A report taken into a meeting cannot have its
 * findings summarised as "+ 6 additional items".
 *
 * So nothing is dropped: content is paginated instead, and these are the rules
 * for where the breaks fall. No pptx import, so they can be tested.
 */

export interface RcaDeckField {
  label: string;
  value: string;
}

/** Fields per slide: two columns, six rows. Beyond that the type shrinks. */
export const RCA_DECK_FIELDS_PER_SLIDE = 12;

/**
 * A value long enough to need the full width rather than a column.
 *
 * An incident description runs to several lines and reads badly in a narrow
 * column beside a one-word field. It takes the width and counts for more.
 */
export const RCA_DECK_WIDE_VALUE_LENGTH = 120;

/** What a field costs against a slide's budget: a wide one takes a whole row. */
export function getRcaDeckFieldWeight(field: RcaDeckField): number {
  return (field.value || '').length > RCA_DECK_WIDE_VALUE_LENGTH ? 2 : 1;
}

/**
 * Splits a node's fields across as many slides as they need.
 *
 * Never returns an empty page for a node that has fields, and never drops one.
 */
export function chunkRcaDeckFields(
  fields: RcaDeckField[],
  budget: number = RCA_DECK_FIELDS_PER_SLIDE
): RcaDeckField[][] {
  const safeBudget = Math.max(1, budget);
  const pages: RcaDeckField[][] = [];
  let page: RcaDeckField[] = [];
  let used = 0;

  fields.forEach((field) => {
    const weight = Math.min(safeBudget, getRcaDeckFieldWeight(field));

    if (page.length && used + weight > safeBudget) {
      pages.push(page);
      page = [];
      used = 0;
    }

    page.push(field);
    used += weight;
  });

  if (page.length) {
    pages.push(page);
  }

  return pages;
}

/**
 * The running header for a node spread over more than one slide.
 *
 * Said as "2 of 3" rather than "continued", because somebody flicking back
 * through a deck in a meeting needs to know how much of it they are looking at.
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
