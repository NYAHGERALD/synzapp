/**
 * Escaping one cell of a CSV a person will open in a spreadsheet.
 *
 * Two separate problems, and the second is the one that was missed.
 *
 * **Structure.** A cell holding a comma, a quote or a newline shifts every
 * column after it if it is not quoted, and an index that silently misreports
 * which message is missing is worse than no index.
 *
 * **Formulas.** A cell beginning `=`, `+`, `-` or `@` is executed by Excel when
 * the file is opened — as is one beginning with a tab or carriage return, which
 * some spreadsheets strip before deciding. A display name or a RAILS title is
 * free text that somebody else typed, and both end up in files handed to
 * auditors and to regulators. Prefixing an apostrophe stops the cell being read
 * as a formula and is invisible once opened.
 *
 * The backend had the first and not the second. The web exports had both, in
 * `announcementExport.ts`, and the backend simply never picked it up — so this
 * is that function, shared, rather than a third opinion about CSV.
 */

/** Characters that make a spreadsheet treat the rest of the cell as code. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function toCsvCell(value: string | null | undefined): string {
  const text = value == null ? '' : String(value);
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;

  /**
   * Always quoted, not only when it has to be.
   *
   * A cell that is quoted only sometimes is one where the apostrophe above
   * changes whether the quoting rule fires, and the two decisions interacting
   * is exactly the sort of thing nobody notices until an export is wrong.
   */
  return `"${safe.replace(/"/g, '""')}"`;
}
