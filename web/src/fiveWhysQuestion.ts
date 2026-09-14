/**
 * Turning a cause or an answer into the next "Why …?" question.
 *
 * Each question is built from the text above it: the first from the cause being
 * tested, the rest from the answer before. Getting that to read as English is
 * the whole job, and it is fiddly enough to want testing — which is why it lives
 * here rather than in the workspace.
 *
 * No react import.
 */

/**
 * Openers that read as nonsense once "Why" is in front of them.
 *
 * People write answers the way they speak — "because the scanner was down",
 * "it was never checked" — and "Why because the scanner was down?" is not a
 * question anybody would ask.
 */
const LEADING_CONNECTIVE_PATTERNS = [
  /^(?:because of|because|since|as a result of|as|so that|so|therefore|thus|hence|then|and|but|however|although|though|while|whereas|also|additionally|moreover|furthermore|consequently|accordingly|instead)\b[\s,;:.-]*/i,
  /^(?:due to|owing to|caused by|resulting from|resulted from|related to|linked to)\b[\s,;:.-]*/i,
  /^(?:it|this|that|there)\s+(?:is|are|was|were|has|have|had|does|do|did|can|could|may|might|must|should|would)(?:\s+not)?(?:\s+been)?\b[\s,;:.-]*/i,
  /^(?:it|this|that)\s+(?:happened|occurred|resulted)\s*(?:because|when|after|as|from|due to)?\b[\s,;:.-]*/i,
  /^(?:we|they|the team|team|operator|maintenance|qa|production|supervisor)\s+(?:found|observed|confirmed|determined|saw|noticed|reported|identified|verified)\s+(?:that\s+)?/i,
  /^(?:the|a|an)\s+(?:reason|cause|issue|problem|failure|finding)\s+(?:is|are|was|were|has been|had been)\b[\s,;:.-]*/i,
  /^(?:it|this|that)\b[\s,;:.-]*/i,
  /^(?:that|which)\s+/i
] as const;

/** Stripping one opener can reveal another: "because it was never checked". */
const MAX_STRIPPING_PASSES = 8;

export const FIVE_WHYS_FALLBACK_QUESTION = 'Why the selected cause?';

/**
 * The first sentence, which is the one the question is asked about.
 *
 * A cause is often written as a headline followed by explanation. Asking the
 * whole paragraph produces a question with a full stop in the middle — "Why no
 * plausibility limit. The system does not validate quantities?" — which is two
 * sentences wearing a question mark. The rest stays on screen above; it is not
 * lost, it is just not part of the question.
 */
export function getFiveWhysQuestionSentence(sourceText: string): string {
  const text = (sourceText || '').replace(/\s+/g, ' ').trim();

  if (!text) {
    return '';
  }

  /**
   * A full stop ends a sentence only when a capitalised word follows.
   *
   * Requiring a letter rather than any character keeps "Approx. 8,024 batches"
   * and "approx. 21 batches" whole — an abbreviation before a number is not a
   * sentence boundary. Where it cannot tell, it keeps the text together: a
   * question slightly longer than it needed to be beats one cut in half.
   */
  const sentenceEnd = /[.!?]+\s+(?=[A-Z])/.exec(text);

  return (sentenceEnd ? text.slice(0, sentenceEnd.index) : text).trim();
}

export function normalizeFiveWhyQuestionSubject(sourceText: string): string {
  let subject = trimEdges(getFiveWhysQuestionSentence(sourceText));

  for (let passIndex = 0; passIndex < MAX_STRIPPING_PASSES; passIndex += 1) {
    const previousSubject = subject;

    LEADING_CONNECTIVE_PATTERNS.forEach((pattern) => {
      subject = subject.replace(pattern, '').trim();
    });
    subject = trimEdges(subject);

    if (subject === previousSubject) {
      break;
    }
  }

  return subject;
}

/**
 * "Why " + what was written + "?".
 *
 * No article is added. One used to be, which turned a cause reading "No
 * quantity plausibility limit" into "Why the No quantity plausibility limit?".
 * The investigator's own words are usually already a phrase that follows "Why".
 */
export function buildFiveWhyQuestion(sourceText: string): string {
  const subject = normalizeFiveWhyQuestionSubject(sourceText);

  return subject ? `Why ${subject}?` : FIVE_WHYS_FALLBACK_QUESTION;
}

/** Every question in the chain: the cause first, then each answer in turn. */
export function buildFiveWhyQuestions(causeLabel: string, whyChain: string[] = []): string[] {
  return Array.from({ length: 5 }, (unused, index) => {
    const sourceText = index === 0 ? causeLabel : whyChain[index - 1] || '';

    if (!sourceText.trim()) {
      return index === 0
        ? FIVE_WHYS_FALLBACK_QUESTION
        : `Answer Why ${index} to generate this question.`;
    }

    return buildFiveWhyQuestion(sourceText);
  });
}

function trimEdges(value: string): string {
  return value
    .replace(/^[\s"'([{]+/, '')
    .replace(/[\s"'.,;:!?)}\]]+$/, '')
    .trim();
}
