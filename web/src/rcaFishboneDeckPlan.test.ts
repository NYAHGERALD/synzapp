import { describe, expect, it } from 'vitest';

import { planRcaFishboneDeck, type RcaDeckPlanNode } from './rcaFishboneDeckPlan';

const node = (id: string, role: string | null, extra: Partial<RcaDeckPlanNode> = {}): RcaDeckPlanNode => ({
  id,
  nodeType: 'WHY',
  parentNodeId: null,
  role,
  ...extra
});

const category = (id: string) => node(id, null, { label: id, nodeType: 'ISHIKAWA_CATEGORY' });
const cause = (id: string, parentNodeId: string) => node(id, null, { nodeType: 'CAUSE', parentNodeId });

describe('the order a Fishbone case is presented in', () => {
  it('sets the case up once, before any branch', () => {
    const sections = planRcaFishboneDeck([
      node('problem', 'PROBLEM'),
      node('incident', 'INCIDENT'),
      node('containment', 'CONTAINMENT'),
      node('details', 'INCIDENT_DETAILS')
    ]);

    expect(sections[0].title).toBe('The case');
    // In the order an investigation is written, not the order they were found.
    expect(sections[0].nodeIds).toEqual(['incident', 'details', 'containment', 'problem']);
  });

  it('follows a cause down its own chain rather than grouping by type', () => {
    /**
     * The fault this replaced: every Cause on one slide, every Evidence on
     * another, and no way to see which cause any of it belonged to.
     */
    const sections = planRcaFishboneDeck([
      category('People'),
      cause('cause-1', 'People'),
      node('ev-1', 'EVIDENCE', { parentNodeId: 'cause-1' }),
      node('why-1', 'FIVE_WHYS', { parentNodeId: 'cause-1' }),
      node('root-1', 'ROOT_CAUSE', { parentNodeId: 'why-1' }),
      node('capa-1', 'CAPA', { parentNodeId: 'root-1' }),
      node('corr-1', 'CORRECTIVE_ACTION', { parentNodeId: 'capa-1' }),
      node('prev-1', 'PREVENTIVE_ACTION', { parentNodeId: 'capa-1' })
    ]);
    const branch = sections.find((section) => section.title === 'People');

    expect(branch?.nodeIds).toEqual(['cause-1', 'ev-1', 'why-1', 'root-1', 'capa-1', 'corr-1', 'prev-1']);
  });

  it('presents CAPA stages in the order they are carried out', () => {
    const sections = planRcaFishboneDeck([
      category('Method'),
      cause('c', 'Method'),
      node('capa', 'CAPA', { parentNodeId: 'c' }),
      node('lessons', 'LESSONS_LEARNED', { parentNodeId: 'capa' }),
      node('risk', 'RISK_ASSESSMENT', { parentNodeId: 'capa' }),
      node('corrective', 'CORRECTIVE_ACTION', { parentNodeId: 'capa' })
    ]);

    expect(sections.find((section) => section.title === 'Method')?.nodeIds)
      .toEqual(['c', 'capa', 'corrective', 'risk', 'lessons']);
  });

  it('leaves out a branch with nothing under it', () => {
    // An empty category earned a slide showing its own name twice.
    const sections = planRcaFishboneDeck([
      category('Machine'),
      category('Material'),
      cause('c', 'Machine')
    ]);

    expect(sections.map((section) => section.title)).toEqual(['Machine']);
  });

  it('leaves out a node joined to nothing', () => {
    const sections = planRcaFishboneDeck([
      category('People'),
      cause('c', 'People'),
      node('orphan', 'ROOT_CAUSE')
    ]);

    expect(sections.flatMap((section) => section.nodeIds)).not.toContain('orphan');
  });

  it('follows evidence joined by a link rather than by parentage', () => {
    const sections = planRcaFishboneDeck([
      category('People'),
      cause('c', 'People'),
      node('ev', 'EVIDENCE', { linkedNodeIds: [] }),
      node('linker', 'FIVE_WHYS', { parentNodeId: 'c', linkedNodeIds: ['ev'] })
    ]);

    expect(sections.find((section) => section.title === 'People')?.nodeIds).toContain('ev');
  });

  it('shows a node once, however many ways it is reachable', () => {
    const sections = planRcaFishboneDeck([
      category('People'),
      cause('c', 'People'),
      node('shared', 'EVIDENCE', { parentNodeId: 'c' }),
      node('why', 'FIVE_WHYS', { parentNodeId: 'c', linkedNodeIds: ['shared'] })
    ]);
    const ids = sections.flatMap((section) => section.nodeIds);

    expect(ids.filter((id) => id === 'shared')).toHaveLength(1);
  });

  it('puts approval and closure last, because it is about the whole case', () => {
    const sections = planRcaFishboneDeck([
      node('closure', 'APPROVAL_CLOSURE'),
      category('People'),
      cause('c', 'People'),
      node('incident', 'INCIDENT')
    ]);

    expect(sections[sections.length - 1].title).toBe('Approval and closure');
  });

  it('still lists a connected item no branch reached', () => {
    const sections = planRcaFishboneDeck([
      node('gate', null, { nodeType: 'FAULT_GATE' }),
      node('stray', 'ROOT_CAUSE', { parentNodeId: 'gate' })
    ]);

    expect(sections.find((section) => section.title === 'Other connected analysis')?.nodeIds)
      .toEqual(['stray']);
  });
});
