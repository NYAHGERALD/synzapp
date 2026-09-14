import { describe, expect, it } from 'vitest';

import {
  buildFiveWhyQuestion,
  buildFiveWhyQuestions,
  getFiveWhysQuestionSentence
} from './fiveWhysQuestion';

describe('asking the next why', () => {
  it('puts Why in front of what was written, and adds no article', () => {
    // "Why the No quantity plausibility limit?" was what an inserted article
    // produced. The investigator's phrase already follows "Why".
    expect(buildFiveWhyQuestion('No quantity plausibility limit'))
      .toBe('Why No quantity plausibility limit?');
  });

  it('asks about the first sentence, not the whole paragraph', () => {
    const cause = 'No quantity plausibility limit. The system does not validate posted quantities against the production schedule without warning.';

    expect(buildFiveWhyQuestion(cause)).toBe('Why No quantity plausibility limit?');
  });

  it('keeps a full stop that is not the end of a sentence', () => {
    expect(getFiveWhysQuestionSentence('Approx. 8,024 batches were posted'))
      .toBe('Approx. 8,024 batches were posted');
    expect(getFiveWhysQuestionSentence('Posted on Line 3. Nobody checked it'))
      .toBe('Posted on Line 3');
  });

  it('drops an opening conjunction, which people write without thinking', () => {
    expect(buildFiveWhyQuestion('because the scanner was offline'))
      .toBe('Why the scanner was offline?');
    expect(buildFiveWhyQuestion('But the placard was hand-written'))
      .toBe('Why the placard was hand-written?');
    expect(buildFiveWhyQuestion('Due to a missing job card'))
      .toBe('Why a missing job card?');
  });

  it('keeps stripping when one opener hides another', () => {
    expect(buildFiveWhyQuestion('because it was never checked'))
      .toBe('Why never checked?');
  });

  it('falls back rather than asking an empty question', () => {
    expect(buildFiveWhyQuestion('')).toBe('Why the selected cause?');
    expect(buildFiveWhyQuestion('because')).toBe('Why the selected cause?');
  });
});

describe('the chain of five', () => {
  it('asks the first from the cause and each of the rest from the answer before', () => {
    const questions = buildFiveWhyQuestions('No plausibility limit', [
      'The check was never written',
      'Nobody owned the rule'
    ]);

    expect(questions[0]).toBe('Why No plausibility limit?');
    expect(questions[1]).toBe('Why The check was never written?');
    expect(questions[2]).toBe('Why Nobody owned the rule?');
  });

  it('says what is needed instead of asking a question it cannot form', () => {
    const questions = buildFiveWhyQuestions('A cause', []);

    expect(questions[1]).toBe('Answer Why 1 to generate this question.');
    expect(questions[4]).toBe('Answer Why 4 to generate this question.');
  });

  it('always returns five', () => {
    expect(buildFiveWhyQuestions('', [])).toHaveLength(5);
  });
});
