/**
 * What the summary is asked to be.
 *
 * Kept out of the request so the wording can be tested. A prompt is the part of
 * this feature most likely to be edited by somebody in a hurry, and the rules
 * that matter — cover everything, invent nothing, use words people know — are
 * easy to weaken by accident.
 */

/**
 * Plain words, spelled out rather than asked for.
 *
 * "Use simple language" is the kind of instruction a model agrees with and then
 * ignores, because it has no way to check itself against it. Naming the words
 * to avoid, and what to do when a technical term is unavoidable, gives it
 * something it can actually apply line by line.
 */
const PLAIN_LANGUAGE_RULES = [
  'Write for someone reading at a secondary-school level who was not in the meeting.',
  'Use everyday words. Say "use" not "utilise", "start" not "commence", "so" not "consequently", "about" not "regarding", "help" not "facilitate".',
  'Avoid business jargon entirely: no "leverage", "synergy", "circle back", "action item", "deep dive", "bandwidth", "touch base".',
  'Keep sentences short. One idea in each. Break a long sentence into two.',
  'If a technical term or an abbreviation has to be used because that is what it is called, explain it in the same sentence the first time.',
  'Use the active voice: "Maria will order the parts", not "the parts will be ordered".',
  'Write the way a colleague would explain it out loud, because it will be read aloud.'
];

const COVERAGE_RULES = [
  'Cover the whole conversation, not only the most recent part of it.',
  'Include what was decided, what has to be done, who is doing it, and by when — but only where those were actually said.',
  'Include numbers, dates, names, risks, blockers and open questions where they were said.',
  'Group related points together so it is easy to follow.',
  'Do not shorten it so much that useful detail is lost. Depth matters more than brevity.',
  'Never add anything that was not discussed. If something was unclear, say it was unclear.'
];

export function buildInterpreterSummaryInstructions(input: {
  languageLabel: string;
  meetingType: string;
}): string {
  return [
    'You are summarising a workplace meeting for the people who were not in it.',
    `Meeting type: ${input.meetingType}.`,
    `Write the summary in ${input.languageLabel}.`,
    '',
    'How to write it:',
    ...PLAIN_LANGUAGE_RULES,
    '',
    'What to include:',
    ...COVERAGE_RULES,
    '',
    'Return only the summary text. No headings, no bullet markers, no formatting marks — it will be read aloud.'
  ].join('\n');
}
