import assert from 'node:assert/strict';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { describe, it } from 'node:test';
import {
  buildExportDigest,
  buildInterpreterExportPdf,
  buildInterpreterExportWord
} from '../src/services/interpreterExportDocument.js';

const base = {
  companyName: 'Northwind Bakery',
  createdAtIso: '2026-09-09T14:30:00.000Z',
  createdByDisplayName: 'Michael Chwoung',
  departmentAdminName: 'Gerald Nyah',
  languageLabel: 'Spanish',
  meetingName: 'Line 3 changeover review',
  text: 'The line ran at rate all shift.\n\nMaria will order the spare rollers by Friday.'
};

const summaryInput = { ...base, kind: 'summary' as const, spokenLanguageLabel: null };
const transcriptInput = { ...base, kind: 'transcript' as const, spokenLanguageLabel: 'Spanish' };
/** Exported in a language nobody spoke — the case that must never look like a record. */
const translatedTranscriptInput = {
  ...base,
  kind: 'transcript' as const,
  languageLabel: 'English',
  spokenLanguageLabel: 'Spanish'
};

/**
 * Reads one entry out of a .docx, which is a zip of raw-deflate parts.
 *
 * Every byte is scanned for the entry's own header rather than hopping from
 * one entry to the next by its declared size. An entry written as a stream
 * records a size of zero in its header, and a scanner that trusts that lands in
 * the middle of compressed data, finds a signature that is not one, and returns
 * nonsense — intermittently, depending on what the bytes happen to contain.
 */
function readEntry(file: Buffer, entry: string): string {
  const name = Buffer.from(entry, 'latin1');

  for (let cursor = 0; cursor < file.length - 30; cursor += 1) {
    if (file.readUInt32LE(cursor) !== 0x04034b50) {
      continue;
    }

    const nameLength = file.readUInt16LE(cursor + 26);

    if (!file.subarray(cursor + 30, cursor + 30 + nameLength).equals(name)) {
      continue;
    }

    const method = file.readUInt16LE(cursor + 8);
    const compressedSize = file.readUInt32LE(cursor + 18);
    const extraLength = file.readUInt16LE(cursor + 28);
    const dataStart = cursor + 30 + nameLength + extraLength;
    const data = compressedSize
      ? file.subarray(dataStart, dataStart + compressedSize)
      : file.subarray(dataStart);

    return method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8');
  }

  throw new Error(`${entry} was not found`);
}

/**
 * Reads the words out of a PDF.
 *
 * Two things make this less obvious than it looks. `FlateDecode` is zlib, with
 * a header — unlike a zip entry, which is raw deflate — and pdfkit writes text
 * as kerned arrays of hex runs: `[<4c696e65> 15 <2033>] TJ`. Taking the array
 * whole leaves the kerning numbers wedged between the words, so only the hex
 * runs are kept and everything else in the array is dropped.
 */
function readPdfText(file: Buffer): string {
  let raw = '';
  let cursor = 0;

  for (;;) {
    const start = file.indexOf('stream', cursor);

    if (start < 0) {
      break;
    }

    const dataStart = file[start + 6] === 0x0d ? start + 8 : start + 7;
    const end = file.indexOf('endstream', dataStart);

    if (end < 0) {
      break;
    }

    try {
      raw += inflateSync(file.subarray(dataStart, end)).toString('latin1');
    } catch {
      // Not every stream is text; an image will not inflate as one.
    }

    cursor = end + 9;
  }

  const decodeHexRuns = (array: string) =>
    (array.match(/<([0-9a-fA-F]+)>/g) || [])
      .map((run) => Buffer.from(run.slice(1, -1), 'hex').toString('latin1'))
      .join('');

  return [...raw.matchAll(/\[([^\]]*)\]\s*TJ/g)]
    .map((match) => decodeHexRuns(match[1]))
    .join('\n');
}

describe('buildInterpreterExportWord', () => {
  it('produces a file Word will open', async () => {
    const file = await buildInterpreterExportWord(summaryInput);

    assert.equal(file.subarray(0, 2).toString('latin1'), 'PK');
  });

  it('puts the company at the top and the mark beside it', async () => {
    const header = readEntry(await buildInterpreterExportWord(summaryInput), 'word/header1.xml');

    assert.ok(header.includes('Northwind Bakery'));
    // The mark is a drawing in the header, not in the footer where it began.
    assert.ok(header.includes('<w:drawing>'));
  });

  it('keeps the mark out of the footer', async () => {
    const footer = readEntry(await buildInterpreterExportWord(summaryInput), 'word/footer1.xml');

    assert.ok(!footer.includes('<w:drawing>'));
  });

  it('carries the meeting and the text itself', async () => {
    const body = readEntry(await buildInterpreterExportWord(summaryInput), 'word/document.xml');

    assert.ok(body.includes('Line 3 changeover review'));
    assert.ok(body.includes('Maria will order the spare rollers by Friday.'));
  });

  it('says who made it, when, and that a machine wrote it', async () => {
    const footer = readEntry(await buildInterpreterExportWord(summaryInput), 'word/footer1.xml');

    assert.ok(footer.includes('Michael Chwoung'));
    assert.ok(footer.includes('Gerald Nyah'));
    assert.ok(footer.includes('Produced by Synzapp AI'));
  });

  it('marks every page confidential and not for distribution', async () => {
    // A document is read from whichever page it was forwarded on, so this has
    // to be in the footer rather than only on the first page.
    const footer = readEntry(await buildInterpreterExportWord(summaryInput), 'word/footer1.xml');

    assert.ok(footer.includes('CONFIDENTIAL'));
    assert.ok(footer.includes('NORTHWIND BAKERY INTERNAL'));
    assert.ok(footer.includes('NOT FOR DISTRIBUTION'));
  });

  it('carries a reference somebody can check the document against', async () => {
    const footer = readEntry(await buildInterpreterExportWord(summaryInput), 'word/footer1.xml');
    const digest = buildExportDigest(summaryInput.text);

    assert.ok(footer.includes(`Reference ${digest.short}`));
    assert.equal(digest.short.length, 12);
    assert.equal(digest.full.length, 64);
  });

  it('says a transcript is in the language it was spoken in', async () => {
    const body = readEntry(await buildInterpreterExportWord(transcriptInput), 'word/document.xml');

    assert.ok(body.includes('the language it was spoken in'));
  });

  it('never presents a translation as a record of what was said', async () => {
    // The most serious thing this document could get wrong: a machine
    // translation offered as the words spoken in a meeting.
    const body = readEntry(await buildInterpreterExportWord(translatedTranscriptInput), 'word/document.xml');

    assert.ok(body.includes('Translation into English'));
    assert.ok(body.includes('what was said in Spanish'));
    assert.ok(body.includes('These are not the words spoken'));
  });

  it('leaves out the admin line when there is no admin', async () => {
    const footer = readEntry(
      await buildInterpreterExportWord({ ...summaryInput, departmentAdminName: null }),
      'word/footer1.xml'
    );

    assert.ok(!footer.includes('Department admin:'));
  });
});

describe('buildInterpreterExportPdf', () => {
  it('produces a real PDF', async () => {
    const file = await buildInterpreterExportPdf(summaryInput);

    assert.equal(file.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.ok(file.length > 2000);
  });

  it('carries the same words as the Word version', async () => {
    const text = readPdfText(await buildInterpreterExportPdf(summaryInput));

    assert.ok(text.includes('Northwind'));
    assert.ok(text.includes('Line 3 changeover review'));
    assert.ok(text.includes('Michael Chwoung'));
    assert.ok(text.includes('Synzapp AI'));
  });

  it('carries the mark as an image', async () => {
    const file = await buildInterpreterExportPdf(summaryInput);

    // An embedded raster, which is the mark: without it the corner is empty.
    assert.ok(file.includes('/Image') || file.includes('/XObject'));
  });

  it('does not fall over on a long transcript that runs to several pages', async () => {
    const long = Array.from({ length: 120 }, (_item, index) =>
      `Paragraph ${index}. The line ran at rate for the whole of the shift and nothing at all stopped it.`
    ).join('\n\n');

    const file = await buildInterpreterExportPdf({ ...transcriptInput, text: long });

    assert.equal(file.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.ok(file.length > 8000);
  });

  it('carries the same confidentiality marking as the Word version', async () => {
    const text = readPdfText(await buildInterpreterExportPdf(summaryInput));

    assert.ok(text.includes('CONFIDENTIAL'));
    assert.ok(text.includes('NOT FOR DISTRIBUTION'));
  });

  it('carries the same translation notice as the Word version', async () => {
    const text = readPdfText(await buildInterpreterExportPdf(translatedTranscriptInput));

    assert.ok(text.includes('not the words spoken'));
  });

  it('copes with nothing to say', async () => {
    const text = readPdfText(await buildInterpreterExportPdf({ ...summaryInput, text: '  ' }));

    assert.ok(text.includes('nothing recorded'));
  });
});

describe('buildExportDigest', () => {
  it('is the same for the same text and different for different text', () => {
    assert.equal(
      buildExportDigest('the line ran at rate').full,
      buildExportDigest('the line ran at rate').full
    );
    assert.notEqual(
      buildExportDigest('the line ran at rate').full,
      buildExportDigest('the line ran at rate.').full
    );
  });

  it('ignores only the whitespace around the text', () => {
    assert.equal(
      buildExportDigest('  the line ran at rate  ').full,
      buildExportDigest('the line ran at rate').full
    );
  });
});
