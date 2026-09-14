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
});
