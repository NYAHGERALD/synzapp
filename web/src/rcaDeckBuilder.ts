import type {
  RcaReportExportNode,
  RcaReportExportPayload,
  RcaReportExportSection
} from './rcaReportExportTypes';
import {
  RCA_DECK_TITLE_LENGTH,
  clipRcaDeckValue,
  getRcaDeckMeaningfulFields,
  isRcaDeckThinNode,
  sanitizeRcaDeckText,
  getRcaDeckContinuationLabel,
  isRcaDeckEmbeddableImage,
  planRcaDeckFieldPages
} from './rcaDeckLayout';

/**
 * Building the RCA deck.
 *
 * Kept out of the workspace so it can be run outside a browser and the file it
 * produces actually opened. Two versions of this shipped looking correct and
 * typechecking cleanly while PowerPoint refused the result, which a test that
 * writes a real deck would have caught either time.
 *
 * Fetching a preview is injected rather than imported: it needs FileReader,
 * and that is the one part a test cannot run.
 */

export type RcaDeckImageResolver = (sourceUrl: string) => Promise<string | null>;

/** The deck's palette, one place, so a slide cannot drift from the rest. */
const RCA_DECK = {
  accent: '0369A1',
  border: 'E2E8F0',
  ink: '0F172A',
  muted: '64748B',
  panel: 'F8FAFC',
  slate: '334155',
  white: 'FFFFFF'
} as const;

/** Wide layout is 13.33 x 7.5 inches. Everything below is measured from that. */
const RCA_DECK_MARGIN = 0.62;
const RCA_DECK_WIDTH = 13.33 - RCA_DECK_MARGIN * 2;
const RCA_DECK_BODY_TOP = 1.62;
const RCA_DECK_FOOTER_Y = 6.92;

/** Where the evidence strip starts, and therefore where fields must stop. */
const RCA_DECK_EVIDENCE_TOP = 5.24;

/**
 * An RCA report as a deck somebody can stand up and present.
 *
 * The one this replaced put four nodes on a slide at seven-point type and
 * reported the remainder as "+ 6 additional items". Three things changed:
 * nothing is dropped, a node gets a slide rather than a row, and the type is
 * large enough to read from the back of a room.
 *
 * It follows the shape of a meeting rather than the shape of the data — a
 * title, what the case is at a glance, then each part of the analysis behind
 * its own divider, so a presenter can jump to a section when asked.
 */
export async function buildRcaDeck(
  pptx: any,
  payload: RcaReportExportPayload,
  previewUrls: Map<string, string>,
  resolveImage: RcaDeckImageResolver
) {

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Synzapp RCA';
  pptx.company = 'Synzapp';
  pptx.subject = sanitizeRcaDeckText(payload.incidentTitle);
  pptx.title = sanitizeRcaDeckText(payload.incidentTitle);
  pptx.theme = { bodyFontFace: 'Aptos', headFontFace: 'Aptos Display' };

  /**
   * The running foot, defined once and applied by every content slide.
   *
   * Slide numbers are what let somebody in the room say "go back to eleven".
   */
  pptx.defineSlideMaster({
    background: { color: RCA_DECK.white },
    objects: [
      { line: { x: RCA_DECK_MARGIN, y: RCA_DECK_FOOTER_Y - 0.12, w: RCA_DECK_WIDTH, h: 0, line: { color: RCA_DECK.border, width: 1 } } },
      {
        text: {
          options: { x: RCA_DECK_MARGIN, y: RCA_DECK_FOOTER_Y, w: 8, h: 0.26, fontSize: 9, color: RCA_DECK.muted },
          text: sanitizeRcaDeckText(`${payload.displayId}  •  ${payload.projectTitle}`)
        }
      }
    ],
    slideNumber: { x: 12.5, y: RCA_DECK_FOOTER_Y, w: 0.5, h: 0.26, fontSize: 9, color: RCA_DECK.muted, align: 'right' },
    title: 'SYNZAPP_RCA'
  });

  buildRcaDeckTitleSlide(pptx, payload);
  buildRcaDeckOverviewSlide(pptx, payload);

  for (const [sectionIndex, section] of payload.sections.entries()) {
    buildRcaDeckDividerSlide(pptx, section, sectionIndex + 1, payload.sections.length, payload.sections);

    const substantialNodes = section.nodes.filter((node: RcaReportExportNode) => !isRcaDeckThinNode(node));
    const thinNodes = section.nodes.filter((node: RcaReportExportNode) => isRcaDeckThinNode(node));

    for (const node of substantialNodes) {
      await buildRcaDeckNodeSlides(pptx, section, node, previewUrls, resolveImage);
    }

    if (thinNodes.length) {
      buildRcaDeckRoundupSlide(pptx, section, thinNodes);
    }
  }

  await pptx.writeFile({ fileName: `${payload.fileBaseName}.pptx` });
}

function buildRcaDeckTitleSlide(pptx: any, payload: RcaReportExportPayload) {
  const slide = pptx.addSlide();

  slide.background = { color: RCA_DECK.ink };
  // A band of colour rather than a border, so the opening slide reads as a
  // cover instead of the first page of a document.
  slide.addShape('rect', { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: RCA_DECK.accent } });
  slide.addText('ROOT CAUSE ANALYSIS', { x: 0.95, y: 2.15, w: 11, h: 0.3, fontSize: 12, bold: true, color: '7DD3FC', charSpacing: 3 });
  slide.addText(sanitizeRcaDeckText(payload.incidentTitle), { x: 0.95, y: 2.62, w: 11.4, h: 1.7, fontSize: 32, bold: true, color: RCA_DECK.white, lineSpacingMultiple: 1.05, valign: 'top' });
  slide.addText(sanitizeRcaDeckText(payload.projectTitle), { x: 0.95, y: 4.42, w: 11.4, h: 0.4, fontSize: 15, color: 'CBD5E1' });
  slide.addShape('rect', { x: 0.95, y: 5.05, w: 2.4, h: 0.03, fill: { color: RCA_DECK.accent } });
  slide.addText(
    [
      { text: sanitizeRcaDeckText(payload.displayId), options: { bold: true, color: RCA_DECK.white } },
      { text: '     ' },
      { text: sanitizeRcaDeckText(payload.status), options: { color: '94A3B8' } },
      { text: '     ' },
      { text: sanitizeRcaDeckText(payload.generatedAtLabel), options: { color: '94A3B8' } }
    ],
    { x: 0.95, y: 5.35, w: 11.4, h: 0.34, fontSize: 12 }
  );
}

function buildRcaDeckOverviewSlide(pptx: any, payload: RcaReportExportPayload) {
  const slide = pptx.addSlide({ masterName: 'SYNZAPP_RCA' });

  addRcaDeckSlideHeading(slide, 'At a glance', 'What this analysis covers');

  const stats = [
    { label: 'Status', value: payload.status },
    { label: 'Nodes analysed', value: String(payload.nodeCount) },
    { label: 'Evidence items', value: String(payload.evidenceCount) },
    { label: 'Sections', value: String(payload.sections.length) }
  ];
  const statWidth = (RCA_DECK_WIDTH - 0.36 * 3) / 4;

  stats.forEach((stat, index) => {
    const x = RCA_DECK_MARGIN + index * (statWidth + 0.36);

    slide.addShape('roundRect', { x, y: RCA_DECK_BODY_TOP, w: statWidth, h: 1.12, rectRadius: 0.06, fill: { color: RCA_DECK.panel }, line: { color: RCA_DECK.border, width: 1 } });
    slide.addText(stat.label.toUpperCase(), { x: x + 0.22, y: RCA_DECK_BODY_TOP + 0.18, w: statWidth - 0.44, h: 0.22, fontSize: 9, bold: true, color: RCA_DECK.muted, charSpacing: 1.4 });
    slide.addText(sanitizeRcaDeckText(stat.value), { x: x + 0.22, y: RCA_DECK_BODY_TOP + 0.46, w: statWidth - 0.44, h: 0.5, fontSize: 20, bold: true, color: RCA_DECK.ink, fit: 'shrink' });
  });

  slide.addText('Contents', { x: RCA_DECK_MARGIN, y: 3.15, w: RCA_DECK_WIDTH, h: 0.3, fontSize: 13, bold: true, color: RCA_DECK.ink });

  // Two columns, so a long analysis still fits one readable contents page.
  const half = Math.ceil(payload.sections.length / 2);

  payload.sections.forEach((section: RcaReportExportSection, index: number) => {
    const column = index < half ? 0 : 1;
    const row = index - column * half;
    const x = RCA_DECK_MARGIN + column * (RCA_DECK_WIDTH / 2);
    const y = 3.62 + row * 0.46;

    slide.addText(
      [
        { text: `${String(index + 1).padStart(2, '0')}  `, options: { bold: true, color: RCA_DECK.accent } },
        { text: sanitizeRcaDeckText(section.title), options: { color: RCA_DECK.ink } },
        { text: `   ${section.nodes.length} item${section.nodes.length === 1 ? '' : 's'}`, options: { color: RCA_DECK.muted } }
      ],
      { x, y, w: RCA_DECK_WIDTH / 2 - 0.3, h: 0.36, fontSize: 12 }
    );
  });
}

/**
 * A section divider, with the analysis drawn as a run of chevrons.
 *
 * A deck read in a meeting is navigated by people who did not build it, and a
 * chevron row answers the question they actually ask — how far through are we,
 * and what is still coming. The one for this section is filled; the rest are
 * outlines.
 */
function buildRcaDeckDividerSlide(
  pptx: any,
  section: RcaReportExportSection,
  position: number,
  total: number,
  allSections: RcaReportExportSection[]
) {
  const slide = pptx.addSlide({ masterName: 'SYNZAPP_RCA' });

  slide.background = { color: RCA_DECK.ink };
  slide.addShape('rect', { x: 0, y: 0, w: 0.14, h: 7.5, fill: { color: RCA_DECK.accent } });
  slide.addText(`${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: RCA_DECK_MARGIN, y: 2.32, w: 4, h: 0.32, fontSize: 12, bold: true, color: '7DD3FC', charSpacing: 2 });
  slide.addText(sanitizeRcaDeckText(section.title), { x: RCA_DECK_MARGIN, y: 2.74, w: RCA_DECK_WIDTH, h: 0.94, fontSize: 30, bold: true, color: RCA_DECK.white, fit: 'shrink' });
  slide.addText(sanitizeRcaDeckText(section.subtitle), { x: RCA_DECK_MARGIN, y: 3.72, w: RCA_DECK_WIDTH * 0.7, h: 0.6, fontSize: 14, color: 'CBD5E1' });
  slide.addText(`${section.nodes.length} item${section.nodes.length === 1 ? '' : 's'}`, { x: RCA_DECK_MARGIN, y: 4.36, w: 3, h: 0.3, fontSize: 12, color: '7DD3FC' });

  addRcaDeckProgressChevrons(slide, allSections, position, 5.3);
}

/** The run of chevrons, with the section being entered filled in. */
function addRcaDeckProgressChevrons(
  slide: any,
  sections: RcaReportExportSection[],
  position: number,
  y: number
) {
  // Beyond eight the chevrons are too narrow to carry a word, so the row is
  // dropped rather than shown as a line of slivers.
  if (sections.length > 8) {
    return;
  }

  const gap = 0.06;
  const width = (RCA_DECK_WIDTH - gap * (sections.length - 1)) / sections.length;

  sections.forEach((section, index) => {
    const isCurrent = index + 1 === position;
    const isDone = index + 1 < position;

    slide.addShape('chevron', {
      x: RCA_DECK_MARGIN + index * (width + gap),
      y,
      w: width,
      h: 0.54,
      fill: { color: isCurrent ? RCA_DECK.accent : isDone ? '1E3A5F' : '172033' },
      line: { color: isCurrent ? RCA_DECK.accent : '334155', width: 1 }
    });
    slide.addText(clipRcaDeckValue(section.title, 26), {
      x: RCA_DECK_MARGIN + index * (width + gap) + 0.12,
      y,
      w: width - 0.24,
      h: 0.54,
      fontSize: 9,
      bold: isCurrent,
      color: isCurrent ? RCA_DECK.white : '94A3B8',
      align: 'center',
      valign: 'middle',
      fit: 'shrink'
    });
  });
}

/**
 * One node, across as many slides as its fields need.
 *
 * A node used to be a 1-inch row sharing a slide with three others. It gets the
 * slide now: the type as an eyebrow, the title at a size that carries, its
 * fields in two columns, and its evidence shown rather than counted.
 */
/**
 * One node, across as many slides as its fields actually need.
 *
 * Rows arrive already measured and already split into slide-sized pages, so
 * this only has to place them. The previous version decided twelve fields
 * would fit and stepped a fixed distance for each, which walked six rows of
 * 0.92in down from 1.62in — through the evidence strip and off the slide.
 */
async function buildRcaDeckNodeSlides(
  pptx: any,
  section: RcaReportExportSection,
  node: RcaReportExportNode,
  previewUrls: Map<string, string>,
  resolveImage: RcaDeckImageResolver
) {
  // Fields that only repeat the heading are dropped before anything is laid
  // out, so they cannot take up a row saying nothing.
  const fields = getRcaDeckMeaningfulFields(node.fields, node.title);
  const hasEvidence = node.evidence.length > 0;
  // The strip and its label are reserved before anything is placed, rather
  // than hoped for afterwards.
  const fieldsBottom = hasEvidence ? RCA_DECK_EVIDENCE_TOP - 0.42 : RCA_DECK_FOOTER_Y - 0.36;
  const pages = planRcaDeckFieldPages(fields, fieldsBottom - RCA_DECK_BODY_TOP);
  const slidePages: Array<Array<ReturnType<typeof planRcaDeckFieldPages>[number][number]>> =
    pages.length ? pages : [[]];

  for (const [pageIndex, rows] of slidePages.entries()) {
    const slide = pptx.addSlide({ masterName: 'SYNZAPP_RCA' });

    addRcaDeckSlideHeading(
      slide,
      clipRcaDeckValue(node.title || node.type, RCA_DECK_TITLE_LENGTH),
      [section.title, node.type, getRcaDeckContinuationLabel(pageIndex, slidePages.length)]
        .filter(Boolean)
        .join('   •   ')
    );

    if (node.status) {
      slide.addShape('roundRect', { x: 11.1, y: 0.52, w: 1.61, h: 0.36, rectRadius: 0.18, fill: { color: RCA_DECK.panel }, line: { color: RCA_DECK.border, width: 1 } });
      slide.addText(sanitizeRcaDeckText(node.status), { x: 11.1, y: 0.52, w: 1.61, h: 0.36, fontSize: 10, color: RCA_DECK.slate, align: 'center', valign: 'middle', fit: 'shrink' });
    }

    let y = RCA_DECK_BODY_TOP;
    const columnWidth = (RCA_DECK_WIDTH - 0.36) / 2;

    rows.forEach((row) => {
      row.fields.forEach((field, columnIndex) => {
        const width = row.isWide ? RCA_DECK_WIDTH : columnWidth;
        const x = RCA_DECK_MARGIN + (row.isWide ? 0 : columnIndex * (columnWidth + 0.36));

        addRcaDeckFieldCard(slide, field, x, y, width, row.height - 0.14, row.isWide);
      });

      y += row.height;
    });

    if (!rows.length) {
      slide.addText('No structured fields were recorded for this item.', { x: RCA_DECK_MARGIN, y: RCA_DECK_BODY_TOP, w: RCA_DECK_WIDTH, h: 0.4, fontSize: 13, color: RCA_DECK.muted, italic: true });
    }

    // Evidence rides with the last slide of a node, where the reader has
    // already seen what it is meant to prove.
    if (pageIndex === slidePages.length - 1 && hasEvidence) {
      await addRcaDeckEvidenceStrip(slide, node, previewUrls, resolveImage);
    }
  }
}

async function addRcaDeckEvidenceStrip(
  slide: any,
  node: RcaReportExportNode,
  previewUrls: Map<string, string>,
  resolveImage: RcaDeckImageResolver
) {
  const stripY = RCA_DECK_EVIDENCE_TOP;

  slide.addText(`EVIDENCE  •  ${node.evidence.length} item${node.evidence.length === 1 ? '' : 's'}`, { x: RCA_DECK_MARGIN, y: stripY - 0.34, w: 6, h: 0.24, fontSize: 9, bold: true, color: RCA_DECK.muted, charSpacing: 1.2 });

  const shown = node.evidence.slice(0, 4);
  const tileWidth = 2.35;

  for (const [index, item] of shown.entries()) {
    const x = RCA_DECK_MARGIN + index * (tileWidth + 0.28);
    const previewUrl = previewUrls.get(item.key);
    const fetched = previewUrl ? await resolveImage(previewUrl) : null;
    /**
     * Only a real picture is embedded.
     *
     * addImage takes any base64 without complaint, so a PDF evidence record or
     * a fetch that returned an error page produced a deck PowerPoint would only
     * offer to repair. A tile without a thumbnail beats a file nobody can open.
     */
    const imageData = isRcaDeckEmbeddableImage(fetched) ? fetched : null;

    slide.addShape('roundRect', { x, y: stripY, w: tileWidth, h: 1.32, rectRadius: 0.06, fill: { color: RCA_DECK.panel }, line: { color: RCA_DECK.border, width: 1 } });

    if (imageData) {
      // `contain` so a portrait photograph is not cropped to a letterbox.
      slide.addImage({ data: imageData, x: x + 0.08, y: stripY + 0.08, w: tileWidth - 0.16, h: 0.84, sizing: { type: 'contain', w: tileWidth - 0.16, h: 0.84 } });
    } else {
      slide.addText('No preview', { x: x + 0.08, y: stripY + 0.3, w: tileWidth - 0.16, h: 0.4, fontSize: 10, color: RCA_DECK.muted, align: 'center' });
    }

    slide.addText(clipRcaDeckValue(item.fileName || 'Evidence', 34), { x: x + 0.1, y: stripY + 0.98, w: tileWidth - 0.2, h: 0.26, fontSize: 9, color: RCA_DECK.slate, align: 'center', fit: 'shrink' });
  }

  if (node.evidence.length > shown.length) {
    slide.addText(`+${node.evidence.length - shown.length} more attached to this item`, { x: RCA_DECK_MARGIN + shown.length * (tileWidth + 0.28), y: stripY + 0.54, w: 2.6, h: 0.3, fontSize: 10, color: RCA_DECK.muted });
  }
}

/**
 * The section's remaining items, listed rather than given a slide each.
 *
 * A node with no fields and no evidence still belongs in the record — a
 * Fishbone category with nothing under it is itself a finding — but it does not
 * warrant a slide showing its name twice.
 */
function buildRcaDeckRoundupSlide(pptx: any, section: RcaReportExportSection, nodes: RcaReportExportNode[]) {
  const slide = pptx.addSlide({ masterName: 'SYNZAPP_RCA' });

  addRcaDeckSlideHeading(slide, 'Also in this section', `${section.title}   •   ${nodes.length} item${nodes.length === 1 ? '' : 's'} with no detail recorded`);

  const columnCount = nodes.length > 9 ? 2 : 1;
  const rowsPerColumn = Math.ceil(nodes.length / columnCount);
  const columnWidth = (RCA_DECK_WIDTH - 0.5) / columnCount;

  nodes.forEach((node: RcaReportExportNode, index: number) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index - column * rowsPerColumn;
    const x = RCA_DECK_MARGIN + column * (columnWidth + 0.5);
    const y = RCA_DECK_BODY_TOP + row * 0.54;

    // The same card as a field, so the deck has one idea of what an item is.
    slide.addShape('roundRect', { x, y, w: columnWidth, h: 0.46, rectRadius: 0.05, fill: { color: RCA_DECK.panel }, line: { color: RCA_DECK.border, width: 1 } });
    slide.addShape('rect', { x: x + 0.02, y: y + 0.08, w: 0.05, h: 0.3, fill: { color: RCA_DECK.accent } });
    slide.addText(
      [
        { text: `${sanitizeRcaDeckText(node.type)}   `, options: { bold: true, color: RCA_DECK.accent } },
        { text: clipRcaDeckValue(node.title, 64) || '—', options: { color: RCA_DECK.ink } }
      ],
      { x: x + 0.22, y, w: columnWidth - 0.4, h: 0.46, fontSize: 11, valign: 'middle', fit: 'shrink' }
    );
  });
}

/**
 * One field, as a card.
 *
 * Loose text on white gave every slide the same flat weight, so nothing looked
 * like a unit and a long value bled into whatever sat beside it. The panel puts
 * a boundary round each value, and the spine down its left edge is what makes a
 * column of them scan as a list rather than a wall.
 */
function addRcaDeckFieldCard(
  slide: any,
  field: { label: string; value: string },
  x: number,
  y: number,
  width: number,
  height: number,
  isWide: boolean
) {
  slide.addShape('roundRect', {
    x,
    y,
    w: width,
    h: height,
    rectRadius: 0.05,
    fill: { color: RCA_DECK.panel },
    line: { color: RCA_DECK.border, width: 1 }
  });
  // The spine. Square against the card's rounded corner, inset so the curve
  // still reads.
  slide.addShape('rect', { x: x + 0.02, y: y + 0.1, w: 0.05, h: height - 0.2, fill: { color: RCA_DECK.accent } });
  slide.addText(sanitizeRcaDeckText(field.label).toUpperCase(), {
    x: x + 0.22,
    y: y + 0.13,
    w: width - 0.44,
    h: 0.2,
    fontSize: 9,
    bold: true,
    color: RCA_DECK.muted,
    charSpacing: 1.2
  });
  slide.addText(clipRcaDeckValue(field.value, isWide ? 420 : 140) || '—', {
    x: x + 0.22,
    y: y + 0.36,
    w: width - 0.44,
    h: height - 0.5,
    fontSize: isWide ? 12 : 13,
    color: RCA_DECK.ink,
    lineSpacingMultiple: 1.1,
    valign: 'top',
    fit: 'shrink'
  });
}

function addRcaDeckSlideHeading(slide: any, title: string, eyebrow: string) {
  // The cover's edge, carried onto every slide so the deck reads as one thing.
  slide.addShape('rect', { x: 0, y: 0, w: 0.14, h: 7.5, fill: { color: RCA_DECK.accent } });
  slide.addText(sanitizeRcaDeckText(eyebrow).toUpperCase(), { x: RCA_DECK_MARGIN, y: 0.5, w: RCA_DECK_WIDTH - 1.8, h: 0.24, fontSize: 9, bold: true, color: RCA_DECK.accent, charSpacing: 1.6 });
  slide.addText(sanitizeRcaDeckText(title), { x: RCA_DECK_MARGIN, y: 0.8, w: RCA_DECK_WIDTH - 1.8, h: 0.62, fontSize: 21, bold: true, color: RCA_DECK.ink, fit: 'shrink', valign: 'top' });
  slide.addShape('rect', { x: RCA_DECK_MARGIN, y: 1.48, w: RCA_DECK_WIDTH, h: 0.012, fill: { color: RCA_DECK.border } });
}
