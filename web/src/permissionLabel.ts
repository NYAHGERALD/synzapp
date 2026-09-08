/**
 * Turn a permission code into words a person would actually say.
 *
 * "tenant" is our word for a customer company, not theirs. On screen it reads
 * as jargon, or worse, as something to do with renting. The stored codes are
 * untouched: they are what the server checks against, and renaming those would
 * change who is allowed to do what.
 */
const PERMISSION_WORD_REPLACEMENTS: [RegExp, string][] = [
  [/\btenant\b/gi, 'Organization']
];

export function formatPermissionLabel(permission: string): string {
  const spaced = permission.replace(/\./g, ' ').replace(/_/g, ' ');
  const readable = PERMISSION_WORD_REPLACEMENTS.reduce(
    (text, [pattern, word]) => text.replace(pattern, word),
    spaced
  );

  return readable.replace(/\b\w/g, (character) => character.toUpperCase());
}
