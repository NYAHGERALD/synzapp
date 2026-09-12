/**
 * What an exported document is called once it leaves the app.
 *
 * This is the only part of the export somebody sees in their downloads folder,
 * often months later and next to a hundred other files. It has to say which
 * meeting, what kind of document, and in which language, using characters every
 * operating system and mail client will accept.
 */

export type InterpreterExportKind = 'summary' | 'transcript';

export function buildInterpreterExportFileName(
  meetingName: string,
  kind: InterpreterExportKind,
  languageCode: string
): string {
  const safeName = (meetingName || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const safeLanguage = (languageCode || '').replace(/[^a-zA-Z0-9-]+/g, '') || 'unknown';

  return `${safeName || 'meeting'}-${kind}-${safeLanguage}`;
}
