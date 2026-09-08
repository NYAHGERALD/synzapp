/**
 * Finding one thing in a list that a company keeps adding to.
 *
 * Teams and people are the two lists in Synzapp that only ever grow, and the
 * screens that pick from them were built when both were short. This is the
 * search behind the full-height picker that replaced them.
 *
 * Pure and separate from the component, because "does typing HR find Human
 * Resources" is a question with a right answer, and a search that quietly
 * matches nothing looks exactly like an empty list.
 */

export interface ChoiceOption {
  id: string;
  /** The line under the name: a member count, a department. */
  meta?: string;
  name: string;
  /** Words that should find this, beyond its name — an abbreviation, a nickname. */
  searchText?: string;
}

export function filterChoiceOptions(options: ChoiceOption[], search: string): ChoiceOption[] {
  const needle = search.trim().toLowerCase();

  if (!needle) {
    return options;
  }

  return options.filter((option) => (
    option.name.toLowerCase().includes(needle) ||
    (option.meta || '').toLowerCase().includes(needle) ||
    (option.searchText || '').toLowerCase().includes(needle)
  ));
}
