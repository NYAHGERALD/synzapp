import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const interpreter = read('src', 'services', 'interpreterService.ts');
const rcaKnowledge = read('src', 'services', 'rcaKnowledgeService.ts');
const railsKnowledge = read('src', 'services', 'railsKnowledgeService.ts');

describe('customer text never reaches an instruction unsanitised', () => {
  it('sanitises the meeting name everywhere a model reads it', () => {
    /**
     * A bare z.string().trim().min(2).max(140) that any tenant user can set for
     * up to fifty invitees, placed last in the realtime session instructions, in
     * the text-to-speech instructions and in the transcription prompt.
     */
    /**
     * Only the model-facing sites. The name also appears in audit summaries,
     * which are read by people and are not instructions — asserting zero raw
     * uses anywhere would be a broader claim than this fix makes, and a test
     * that overstates is one somebody later deletes.
     */
    const promptSites = [
      /context: `This is from the meeting "\$\{sanitizePromptText\(input\.meeting\.meetingName\)\}"/,
      /prompt: `Workplace meeting transcript for \$\{sanitizePromptText\(meeting\.meetingName\)\}/,
      /`Meeting: \$\{sanitizePromptText\(meeting\.meetingName\)\}\. \$\{sourceMode\}`/,
      /The active interpreter meeting is "\$\{sanitizePromptText\(meeting\.meetingName\)\}"/
    ];

    promptSites.forEach((pattern) => assert.match(interpreter, pattern));

    // The realtime instruction line appears twice and both must be sanitised.
    const realtimeLines = interpreter.match(
      /`Meeting: \$\{sanitizePromptText\(meeting\.meetingName\)\}\. \$\{sourceMode\}`/g
    ) || [];

    assert.equal(realtimeLines.length, 2);
  });

  it('sanitises transcript text quoted inside instructions', () => {
    // Anything a person said reaches here, and a passage containing a double
    // quote used to close the one it sits in.
    assert.match(interpreter, /sanitizePromptPassage\(input\.neighbours\.previousText\)/);
    assert.match(interpreter, /sanitizePromptPassage\(input\.neighbours\.nextText\)/);
  });

  it('bounds model output that could not be parsed', () => {
    // A naturalized segment is stored and later re-fed into text-to-speech, so
    // anything that steered the model once would be read back on every replay.
    assert.match(interpreter, /sanitizePromptPassage\(outputText, INTERPRETER_FALLBACK_TEXT_MAX_LENGTH\)/);
  });
});

describe('knowledge context is fenced as evidence, not instruction', () => {
  it('fences the RCA canvas context', () => {
    assert.match(rcaKnowledge, /fencePromptData\('RCA context', context\)/);
  });

  it('fences the RAILS loop context', () => {
    assert.match(railsKnowledge, /fencePromptData\('RAILS context', context\)/);
  });
});

describe('the knowledge services can actually reach the model', () => {
  it('sends no temperature, which this model rejects outright', () => {
    /**
     * "Unsupported parameter: 'temperature' is not supported with this model" —
     * so every request returned 400 and every answer users saw was the
     * deterministic fallback. It was found and fixed in RCA; the identical copy
     * in RAILS was still live.
     */
    assert.doesNotMatch(rcaKnowledge, /^\s*temperature:/m);
    assert.doesNotMatch(railsKnowledge, /^\s*temperature:/m);
  });
});
