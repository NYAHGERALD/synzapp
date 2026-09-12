import {
  AlignmentType,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import {
  SYNZAPP_MARK_HEIGHT,
  SYNZAPP_MARK_PNG_BASE64,
  SYNZAPP_MARK_WIDTH
} from '../assets/synzappLogo.js';

/**
 * A meeting summary or a saved transcript, as a document somebody can keep.
 *
 * **One module for both kinds and both formats**, because the moment these are
 * written twice they begin to differ, and the half that drifts is the half
 * nobody looks at. A transcript and a summary differ only in what they are
 * called and what they contain.
 *
 * These files leave the app. They land in inboxes, shared drives and, sooner or
 * later, in front of somebody deciding whether a company did what it said it
 * did. So every page says whose company it is, which meeting, when, who by, and
 * — the part that matters most — that a machine produced it.
 */

export type InterpreterExportKind = 'summary' | 'transcript';

export interface InterpreterExportDocumentInput {
  companyName: string;
  createdAtIso: string;
  createdByDisplayName: string;
  departmentAdminName: string | null;
  kind: InterpreterExportKind;
  languageLabel: string;
  meetingName: string;
  /**
   * The language actually spoken, when it is not the one being exported.
   *
   * A transcript is a record of what was said. Presenting a machine translation
   * as the words spoken is the most serious thing this document could get
   * wrong, so where these differ the page says so rather than staying silent.
   */
  spokenLanguageLabel: string | null;
  text: string;
}

/**
 * A short reference to the exact text, printed on the page.
 *
 * A Word file is editable, and Synzapp otherwise has no way to say whether a
 * document put in front of it is the one it produced. The full digest is
 * written to the audit event; this is the part somebody can read out over the
 * phone to find the matching entry.
 */
export function buildExportDigest(text: string): { full: string; short: string } {
  const full = createHash('sha256').update(text.trim(), 'utf8').digest('hex');

  return { full, short: full.slice(0, 12).toUpperCase() };
}

/** Says plainly that the document is not for passing on. */
function buildClassificationLine(companyName: string): string {
  return `CONFIDENTIAL · ${companyName.toUpperCase()} INTERNAL · NOT FOR DISTRIBUTION`;
}

/**
 * How the document describes what it contains.
 *
 * A translated transcript is called a translation, not a transcript, because
 * the difference is the whole point of the distinction.
 */
function describeExportContents(input: InterpreterExportDocumentInput): string {
  if (input.kind === 'summary') {
    return `Meeting summary in ${input.languageLabel}.`;
  }

  if (!input.spokenLanguageLabel || input.spokenLanguageLabel === input.languageLabel) {
    return `Transcript of what was said, in ${input.languageLabel}, the language it was spoken in.`;
  }

  return `Translation into ${input.languageLabel} of what was said in ${input.spokenLanguageLabel}. These are not the words spoken; they are a machine translation of them.`;
}

/** The house colours, so an exported page looks like the app it came from. */
const INK = '111827';
const MUTED = '5D6675';
const ACCENT = '0F766E';
const RULE = 'DCDCE0';
const DESTRUCTIVE = 'B91C1C';

const KIND_LABEL: Record<InterpreterExportKind, string> = {
  summary: 'Meeting summary',
  transcript: 'Meeting transcript'
};

function formatExportTimestamp(createdAtIso: string): string {
  const created = new Date(createdAtIso);

  if (Number.isNaN(created.getTime())) {
    return createdAtIso;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Chicago'
  }).format(created);
}

/**
 * The paragraphs the text was written with.
 *
 * Poured in as one block it becomes a wall nobody reads, so the breaks the
 * writer put there are kept exactly as they are.
 */
function splitIntoBlocks(text: string): string[] {
  return (text || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function buildProvenanceLines(input: InterpreterExportDocumentInput): string[] {
  return [
    buildClassificationLine(input.companyName),
    `Created ${formatExportTimestamp(input.createdAtIso)} by ${input.createdByDisplayName}.`,
    input.departmentAdminName ? `Department admin: ${input.departmentAdminName}.` : '',
    `Produced by Synzapp AI from the meeting recording. Reference ${buildExportDigest(input.text).short}.`
  ].filter(Boolean);
}

const markBuffer = () => Buffer.from(SYNZAPP_MARK_PNG_BASE64, 'base64');

/** Small enough to mark the page without competing with what it says. */
const MARK_DISPLAY_HEIGHT = 26;
const MARK_DISPLAY_WIDTH = Math.round((SYNZAPP_MARK_WIDTH / SYNZAPP_MARK_HEIGHT) * MARK_DISPLAY_HEIGHT);

export async function buildInterpreterExportWord(
  input: InterpreterExportDocumentInput
): Promise<Buffer> {
  const createdAt = formatExportTimestamp(input.createdAtIso);

  /**
   * The company on the left, the mark on the right, on one invisible row.
   *
   * A table rather than two paragraphs: Word has no way to put two things on
   * opposite ends of the same line otherwise, and stacking them wastes the top
   * of every page.
   */
  const headerRow = new Table({
    borders: {
      bottom: { color: RULE, size: 6, style: 'single' },
      insideHorizontal: { color: 'FFFFFF', size: 0, style: 'none' },
      insideVertical: { color: 'FFFFFF', size: 0, style: 'none' },
      left: { color: 'FFFFFF', size: 0, style: 'none' },
      right: { color: 'FFFFFF', size: 0, style: 'none' },
      top: { color: 'FFFFFF', size: 0, style: 'none' }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              bottom: { color: RULE, size: 6, style: 'single' },
              left: { color: 'FFFFFF', size: 0, style: 'none' },
              right: { color: 'FFFFFF', size: 0, style: 'none' },
              top: { color: 'FFFFFF', size: 0, style: 'none' }
            },
            children: [
              new Paragraph({
                children: [new TextRun({ color: INK, size: 22, text: input.companyName })],
                spacing: { after: 100 }
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            width: { size: 70, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            borders: {
              bottom: { color: RULE, size: 6, style: 'single' },
              left: { color: 'FFFFFF', size: 0, style: 'none' },
              right: { color: 'FFFFFF', size: 0, style: 'none' },
              top: { color: 'FFFFFF', size: 0, style: 'none' }
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({
                    data: markBuffer(),
                    transformation: { height: MARK_DISPLAY_HEIGHT, width: MARK_DISPLAY_WIDTH },
                    type: 'png'
                  })
                ],
                spacing: { after: 100 }
              })
            ],
            verticalAlign: VerticalAlign.CENTER,
            width: { size: 30, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ color: INK, size: 34, text: input.meetingName })],
            spacing: { after: 60 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                color: ACCENT,
                size: 19,
                text: `${KIND_LABEL[input.kind].toUpperCase()}  ·  ${input.languageLabel.toUpperCase()}  ·  ${createdAt.toUpperCase()}`
              })
            ],
            spacing: { after: 200 }
          }),
          // Says what this actually contains. For a translated transcript that
          // is the difference between a record and a rendering of one.
          new Paragraph({
            children: [new TextRun({ color: MUTED, size: 18, text: describeExportContents(input) })],
            spacing: { after: 160 }
          }),
          new Paragraph({
            border: {
              bottom: { color: RULE, size: 6, space: 6, style: 'single' },
              top: { color: RULE, size: 6, space: 6, style: 'single' }
            },
            children: [
              new TextRun({
                color: DESTRUCTIVE,
                size: 16,
                text: buildClassificationLine(input.companyName)
              })
            ],
            spacing: { after: 320 }
          }),
          ...(splitIntoBlocks(input.text).length
            ? splitIntoBlocks(input.text).map((block) => new Paragraph({
                children: [new TextRun({ color: INK, size: 22, text: block })],
                spacing: { after: 200, line: 320 }
              }))
            : [new Paragraph({
                children: [new TextRun({ color: MUTED, italics: true, size: 22, text: 'There is nothing recorded here.' })]
              })])
        ],
        footers: {
          default: new Footer({
            children: [
              ...buildProvenanceLines(input).map((line) => new Paragraph({
                children: [new TextRun({ color: MUTED, size: 15, text: line })]
              })),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], color: MUTED, size: 15 })]
              })
            ]
          })
        },
        headers: { default: new Header({ children: [headerRow] }) },
        properties: {
          page: { margin: { bottom: 1080, left: 1080, right: 1080, top: 1080 } }
        }
      }
    ]
  });

  return await Packer.toBuffer(document);
}

/**
 * The same document as a PDF.
 *
 * Written to look like the Word version rather than merely to contain the same
 * words: the same mark in the same corner, the same rule under the header, the
 * same colours. Somebody who receives one after the other should not have to
 * wonder whether they came from the same system.
 */
export async function buildInterpreterExportPdf(
  input: InterpreterExportDocumentInput
): Promise<Buffer> {
  const createdAt = formatExportTimestamp(input.createdAtIso);
  const provenance = buildProvenanceLines(input);

  return await new Promise<Buffer>((resolve, reject) => {
    const margin = 54;
    const doc = new PDFDocument({ autoFirstPage: false, margin, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page ? doc.page.width - (margin * 2) : 612 - (margin * 2);

    const drawFurniture = () => {
      const width = doc.page.width - (margin * 2);

      // Header: company on the left, mark on the right, rule beneath.
      doc.fillColor(`#${INK}`).fontSize(11).font('Helvetica')
        .text(input.companyName, margin, margin, { width: width - MARK_DISPLAY_WIDTH - 12 });

      doc.image(markBuffer(), doc.page.width - margin - MARK_DISPLAY_WIDTH, margin - 6, {
        height: MARK_DISPLAY_HEIGHT
      });

      const ruleY = margin + 26;

      doc.moveTo(margin, ruleY).lineTo(doc.page.width - margin, ruleY)
        .strokeColor(`#${RULE}`).lineWidth(0.75).stroke();

      // Footer: the provenance, and the page number opposite it.
      const footerTop = doc.page.height - margin - (provenance.length * 11) - 6;

      doc.moveTo(margin, footerTop - 10).lineTo(doc.page.width - margin, footerTop - 10)
        .strokeColor(`#${RULE}`).lineWidth(0.75).stroke();

      doc.fillColor(`#${MUTED}`).fontSize(7.5).font('Helvetica');

      provenance.forEach((line, index) => {
        doc.text(line, margin, footerTop + (index * 11), { lineBreak: false, width });
      });

      doc.text(`Page ${doc.bufferedPageRange().count}`, margin, footerTop, {
        align: 'right',
        lineBreak: false,
        width
      });
    };

    doc.on('pageAdded', drawFurniture);
    doc.addPage();

    let cursor = margin + 52;

    doc.fillColor(`#${INK}`).fontSize(19).font('Helvetica')
      .text(input.meetingName, margin, cursor, { width: contentWidth });

    cursor = doc.y + 6;

    doc.fillColor(`#${ACCENT}`).fontSize(8.5).font('Helvetica')
      .text(
        `${KIND_LABEL[input.kind].toUpperCase()}  ·  ${input.languageLabel.toUpperCase()}  ·  ${createdAt.toUpperCase()}`,
        margin,
        cursor,
        { characterSpacing: 0.6, width: contentWidth }
      );

    cursor = doc.y + 12;

    doc.fillColor(`#${MUTED}`).fontSize(9).font('Helvetica')
      .text(describeExportContents(input), margin, cursor, { width: contentWidth });

    cursor = doc.y + 12;

    // The classification band, ruled above and below so it reads as a stamp on
    // the document rather than as a sentence in it.
    doc.moveTo(margin, cursor).lineTo(doc.page.width - margin, cursor)
      .strokeColor(`#${RULE}`).lineWidth(0.75).stroke();

    doc.fillColor(`#${DESTRUCTIVE}`).fontSize(7.5).font('Helvetica')
      .text(buildClassificationLine(input.companyName), margin, cursor + 6, {
        characterSpacing: 0.5,
        width: contentWidth
      });

    cursor = doc.y + 6;

    doc.moveTo(margin, cursor).lineTo(doc.page.width - margin, cursor)
      .strokeColor(`#${RULE}`).lineWidth(0.75).stroke();

    cursor += 22;

    const blocks = splitIntoBlocks(input.text);
    const bottomLimit = doc.page.height - margin - (provenance.length * 11) - 28;

    doc.fillColor(`#${INK}`).fontSize(10.5).font('Helvetica');

    if (!blocks.length) {
      doc.fillColor(`#${MUTED}`).font('Helvetica-Oblique')
        .text('There is nothing recorded here.', margin, cursor, { width: contentWidth });
    }

    for (const block of blocks) {
      const height = doc.heightOfString(block, { lineGap: 3, width: contentWidth });

      // Started on the next page rather than split across the rule, which is
      // what leaves a single orphaned line under a footer.
      if (cursor + height > bottomLimit) {
        doc.addPage();
        cursor = margin + 52;
      }

      doc.fillColor(`#${INK}`).font('Helvetica').fontSize(10.5)
        .text(block, margin, cursor, { align: 'left', lineGap: 3, width: contentWidth });

      cursor = doc.y + 12;
    }

    doc.end();
  });
}
