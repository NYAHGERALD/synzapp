import { describe, expect, it } from 'vitest';

import { buildRcaDeck } from './rcaDeckBuilder';
import type { RcaReportExportPayload } from './rcaReportExportTypes';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PDF = 'data:application/pdf;base64,JVBERi0xLjQK';

function makePayload(overrides: Partial<RcaReportExportPayload> = {}): RcaReportExportPayload {
  return {
    displayId: 'RCA-2026-ZB9PL2',
    evidenceCount: 2,
    fileBaseName: 'deck',
    generatedAt: '2026-09-13T19:06:00.000Z',
    generatedAtLabel: 'Sep 13, 2026, 7:06 PM',
    incidentTitle: 'Tortilla output posted against dough-batch production order on Line 3',
    nodeCount: 16,
    projectTitle: 'Fire under the oven',
    sections: [
      {
        nodes: [
          {
            evidence: [
              { fileName: 'photo.jpg', fileUrl: 'u1', key: 'k1', uploadedAt: '' },
              { fileName: 'report.pdf', fileUrl: 'u2', key: 'k2', uploadedAt: '' }
            ],
            // More fields than fit on one slide, with a long one among them.
            fields: Array.from({ length: 22 }, (unused, index) => ({
              label: `Field ${index}`,
              value: index === 3 ? 'x'.repeat(400) : `value ${index}`
            })),
            id: 'n1',
            status: 'Investigation',
            title: 'Incident',
            type: 'INCIDENT'
          },
          { evidence: [], fields: [], id: 'n2', status: '', title: 'Bare node', type: 'CONTAINMENT' }
        ],
        subtitle: 'Parent incident and initial RCA scope.',
        title: '1. Incident'
      }
    ],
    status: 'Investigating',
    ...overrides
  };
}

async function writeDeck(payload: RcaReportExportPayload, resolved: string | null) {
  const { default: pptxgen } = await import('pptxgenjs');
  const pptx = new pptxgen();
  const previewUrls = new Map([['k1', 'u1'], ['k2', 'u2']]);

  await buildRcaDeck(pptx, payload, previewUrls, async () => resolved);

  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}

describe('the RCA deck as a file', () => {
  it('writes a presentation that is a valid archive', async () => {
    /**
     * Two versions of this shipped typechecking cleanly while PowerPoint would
     * only offer to repair the result. Building a real one is the only check
     * that would have caught either.
     */
    const file = await writeDeck(makePayload(), PNG);

    expect(file.length).toBeGreaterThan(10_000);
    // Every .pptx is a zip, and every zip starts PK.
    expect(file.subarray(0, 2).toString('latin1')).toBe('PK');
  }, 30_000);

  it('embeds no media that is not a picture', async () => {
    /**
     * addImage takes any base64 without complaint, so a PDF evidence record
     * used to be embedded as an image part — which is what PowerPoint refused
     * to open. The tile is drawn without a thumbnail instead.
     */
    const file = await writeDeck(makePayload(), PDF);
    const archive = file.toString('latin1');

    expect(archive).not.toContain('%PDF');
    expect(file.subarray(0, 2).toString('latin1')).toBe('PK');
  }, 30_000);

  it('survives a node with no fields and no evidence', async () => {
    const file = await writeDeck(
      makePayload({ sections: [{ nodes: [{ evidence: [], fields: [], id: 'n', status: '', title: '', type: 'CAUSE' }], subtitle: '', title: 'Only section' }] }),
      null
    );

    expect(file.subarray(0, 2).toString('latin1')).toBe('PK');
  }, 30_000);

  it('produces well-formed slide xml with content on every slide', async () => {
    const { default: pptxgen } = await import('pptxgenjs');
    const JSZip = (await import('jszip')).default;
    const pptx = new pptxgen();
    const payload: RcaReportExportPayload = {
      displayId: 'RCA-1', evidenceCount: 1, fileBaseName: 'd',
      generatedAt: '', generatedAtLabel: 'now',
      incidentTitle: 'Title with < & > "quotes"', nodeCount: 3,
      projectTitle: 'Project', status: 'Open',
      sections: [{
        title: '1. Incident', subtitle: 'Scope',
        nodes: [{
          id: 'n1', status: 'Open', title: 'Node', type: 'INCIDENT',
          evidence: [{ fileName: 'a.pdf', fileUrl: 'u', key: 'k', uploadedAt: '' }],
          fields: Array.from({ length: 30 }, (u, i) => ({ label: `F${i}`, value: i % 5 === 0 ? 'y'.repeat(300) : `v${i}` }))
        }]
      }]
    };

    await buildRcaDeck(pptx, payload, new Map([['k', 'u']]), async () => 'data:application/pdf;base64,JVBERi0=');

    const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));

    expect(slideNames.length).toBeGreaterThan(3);

    for (const name of slideNames) {
      const xml = await zip.files[name].async('string');
      // Balanced tags and a closing root is what PowerPoint rejects when it
      // is wrong; a full parser is not needed to prove it.
      expect(xml.startsWith('<?xml')).toBe(true);
      expect(xml.trimEnd().endsWith('</p:sld>')).toBe(true);
      expect((xml.match(/<a:t>/g) || []).length).toBe((xml.match(/<\/a:t>/g) || []).length);
      // Every slide must carry something; empty slides were the complaint.
      expect(xml).toMatch(/<a:t>|<p:pic>/);
    }

    // Directory entries are listed too; only real parts count.
    const media = Object.keys(zip.files).filter((name) => name.startsWith('ppt/media/') && !zip.files[name].dir);

    expect(media).toHaveLength(0);
  }, 30_000);

  it('writes no character that XML cannot carry, wherever it came from', async () => {
    /**
     * The fault that made PowerPoint offer only to repair the file.
     *
     * XML 1.0 permits tab, newline and carriage return and nothing else below
     * 0x20, and pptxgenjs writes text verbatim. Word puts 0x0B in for every
     * Shift+Enter line break, so a description pasted from a document carried
     * them into every deck.
     *
     * Planted in every position a string can reach a slide from.
     */
    const vt = String.fromCharCode(11);
    const nul = String.fromCharCode(0);
    const ff = String.fromCharCode(12);
    const { default: pptxgen } = await import('pptxgenjs');
    const JSZip = (await import('jszip')).default;
    const pptx = new pptxgen();
    const payload = makePayload({
      displayId: `RCA${vt}1`,
      incidentTitle: `Title${vt}broken${nul}here`,
      projectTitle: `Project${ff}name`,
      status: `Open${vt}`,
      sections: [{
        title: `1.${vt} Incident`,
        subtitle: `Scope${nul}`,
        nodes: [{
          id: 'n1',
          status: `Investigation${vt}`,
          title: `Node${ff}title`,
          type: `INCIDENT${vt}`,
          evidence: [{ fileName: `photo${vt}.jpg`, fileUrl: 'u', key: 'k1', uploadedAt: '' }],
          fields: [
            { label: `Label${vt}`, value: `short${nul}value` },
            { label: 'Long', value: `${'x'.repeat(200)}${vt}${'y'.repeat(60)}` }
          ]
        }]
      }]
    });

    await buildRcaDeck(pptx, payload, new Map([['k1', 'u']]), async () => null);

    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }) as Buffer);
    const illegal = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith('.xml') || zip.files[name].dir) {
        continue;
      }

      expect(illegal.test(await zip.files[name].async('string'))).toBe(false);
    }
  }, 30_000);
});
