import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRcaAiContext, type RcaAiContextNode } from '../src/services/rcaAiContext.ts';

const node = (overrides: Partial<RcaAiContextNode> = {}): RcaAiContextNode => ({
  attachedEvidenceCount: 0,
  hasReachableEvidence: false,
  id: 'node_a1b2c3d4e5f6',
  isRootCause: false,
  isSuspectedCause: false,
  label: 'Fire under the oven',
  parentNodeId: null,
  role: 'INCIDENT',
  ...overrides
});

const input = (overrides: Record<string, unknown> = {}) => ({
  incident: {
    departmentName: 'Production',
    methodology: 'ISHIKAWA',
    status: 'OPEN',
    title: 'Oven fire'
  },
  nodes: [node()],
  selectedNodeGaps: [],
  selectedNodeId: null,
  selectedSplineCount: 0,
  ...overrides
});

describe('what the guide is told about a case', () => {
  it('names the selected node, which is the question it used to guess at', () => {
    const context = buildRcaAiContext(input({ selectedNodeId: 'node_a1b2c3d4e5f6' }));

    assert.match(context, /Selected node: #1 INCIDENT "Fire under the oven"/);
  });

  it('says plainly when nothing is selected, rather than leaving it open', () => {
    // Silence is what produced "the selected node is the Root Cause node" for a
    // canvas where an Incident node was selected.
    assert.match(buildRcaAiContext(input()), /Selected node: none/);
  });

  it('lists what the selected node is missing', () => {
    const context = buildRcaAiContext(input({
      selectedNodeGaps: ['incident description', 'date of incident'],
      selectedNodeId: 'node_a1b2c3d4e5f6'
    }));

    assert.match(context, /missing: incident description; date of incident/);
  });

  it('never writes a document id into the prompt', () => {
    const context = buildRcaAiContext(input({
      nodes: [
        node(),
        node({ id: 'node_ffffffffffff', parentNodeId: 'node_a1b2c3d4e5f6', role: 'CONTAINMENT' })
      ],
      selectedNodeId: 'node_ffffffffffff'
    }));

    assert.ok(!context.includes('node_a1b2c3d4e5f6'), 'parent id leaked');
    assert.ok(!context.includes('node_ffffffffffff'), 'node id leaked');
    // Structure survives, by position.
    assert.match(context, /parent=#1/);
  });

  it('cannot carry a detail field, because it never reads one', () => {
    /**
     * The guard that matters. detailFields holds whoWasInvolved,
     * wasAnyoneInjured and reportedBy, so the builder is given a node with one
     * attached and the output is checked for it.
     */
    const withPersonalData = {
      ...node(),
      createdBy: { displayName: 'Ana Ruiz', uid: 'uid_secret' },
      detailFields: { wasAnyoneInjured: 'Yes, Ana Ruiz, second-degree burn' },
      lockedBy: 'uid_secret'
    } as unknown as RcaAiContextNode;
    const context = buildRcaAiContext(input({ nodes: [withPersonalData] }));

    assert.ok(!context.includes('Ana Ruiz'));
    assert.ok(!context.includes('uid_secret'));
    assert.ok(!context.includes('burn'));
  });

  it('reports which nodes still need evidence', () => {
    const context = buildRcaAiContext(input({
      nodes: [node({ id: 'rc', role: 'ROOT_CAUSE' })]
    }));

    assert.match(context, /should have evidence and have none: #1 ROOT_CAUSE/);
  });

  it('admits when it is describing only part of a large canvas', () => {
    const many = Array.from({ length: 140 }, (unused, index) => node({ id: `node_${index}` }));

    assert.match(buildRcaAiContext(input({ nodes: many })), /the canvas holds 140/);
  });
});
