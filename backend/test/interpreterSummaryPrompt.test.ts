import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInterpreterSummaryInstructions } from '../src/services/interpreterSummaryPrompt.js';

const instructions = buildInterpreterSummaryInstructions({
  languageLabel: 'Spanish',
  meetingType: 'ONE_ON_ONE'
});

describe('buildInterpreterSummaryInstructions', () => {
  it('names the language it is writing in', () => {
    assert.ok(instructions.includes('Write the summary in Spanish.'));
  });

  it('names the words to avoid rather than asking for simple language', () => {
    // "Use simple language" is agreed with and then ignored, because there is
    // nothing to check against. Named substitutions can be applied.
    assert.ok(instructions.includes('utilise'));
    assert.ok(instructions.includes('leverage'));
    assert.ok(instructions.includes('active voice'));
  });

  it('keeps depth from being traded away for brevity', () => {
    assert.ok(instructions.includes('Depth matters more than brevity.'));
    assert.ok(instructions.includes('Cover the whole conversation'));
  });

  it('forbids inventing anything', () => {
    assert.ok(instructions.includes('Never add anything that was not discussed.'));
  });

  it('asks for text that can be read aloud, with no formatting', () => {
    assert.ok(instructions.includes('read aloud'));
    assert.ok(instructions.includes('No headings'));
  });
});
