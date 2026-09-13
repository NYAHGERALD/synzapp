/**
 * What the RCA guide is allowed to be told about a case.
 *
 * An allowlist, built field by field, never a serialized node. A node carries
 * `detailFields` — an open map holding `whoWasInvolved`, `wasAnyoneInjured`,
 * `reportedBy`, lot numbers and shift records — plus `createdBy` with a uid and
 * photo URL, and `lockedBy`. None of it belongs in a prompt sent to a third
 * party, and a builder that starts from the object and removes things will leak
 * the next field somebody adds. This starts from nothing and adds.
 *
 * The guide never needs a field's contents to be useful. Knowing that Incident
 * Details has four empty required fields is enough to say what to do next;
 * knowing who was injured is not, so it is never sent.
 *
 * Nodes are referred to by position — #1, #2 — rather than by document id. The
 * previous builder wrote `parent=<firestore id>` straight into the prompt.
 *
 * No Firestore import, so the rules can be tested.
 */

export interface RcaAiContextNode {
  attachedEvidenceCount: number;
  hasReachableEvidence: boolean;
  id: string;
  isRootCause: boolean;
  isSuspectedCause: boolean;
  label: string;
  parentNodeId: string | null;
  role: string;
}

export interface RcaAiContextInput {
  /** Short labels of what the selected node is missing, as the panel shows them. */
  selectedNodeGaps: string[];
  selectedNodeId: string | null;
  selectedSplineCount: number;
  incident: {
    departmentName: string;
    methodology: string;
    status: string;
    title: string;
  };
  nodes: RcaAiContextNode[];
}

const MAX_NODES_DESCRIBED = 120;
const MAX_LABEL_LENGTH = 140;
const MAX_GAPS_DESCRIBED = 12;
const MAX_GAP_LENGTH = 80;

export function buildRcaAiContext(input: RcaAiContextInput): string {
  const nodes = input.nodes.slice(0, MAX_NODES_DESCRIBED);
  const positionById = new Map(nodes.map((node, index) => [node.id, index + 1]));
  const selectedNode = input.selectedNodeId
    ? nodes.find((node) => node.id === input.selectedNodeId) || null
    : null;
  const lines: string[] = [
    'Synzapp RCA canvas state. Everything below is fact computed from the live canvas; prefer it over inference.',
    `Case title: ${clip(input.incident.title, MAX_LABEL_LENGTH)}`,
    `Case status: ${clip(input.incident.status, 40)}`,
    `Department: ${clip(input.incident.departmentName, 80)}`,
    `Methodology: ${clip(input.incident.methodology, 40)}`,
    `Node count: ${input.nodes.length}`
  ];

  /**
   * Said plainly, because it is the question most often asked and the one the
   * guide previously answered by guessing.
   */
  if (selectedNode) {
    lines.push(
      `Selected node: #${positionById.get(selectedNode.id)} ${selectedNode.role} "${clip(selectedNode.label, MAX_LABEL_LENGTH)}"`
    );

    const gaps = input.selectedNodeGaps
      .slice(0, MAX_GAPS_DESCRIBED)
      .map((gap) => clip(gap, MAX_GAP_LENGTH))
      .filter((gap) => gap.length > 0);

    lines.push(gaps.length
      ? `Selected node is missing: ${gaps.join('; ')}`
      : 'Selected node has no missing required fields.');
    lines.push(selectedNode.hasReachableEvidence
      ? 'Selected node has evidence available to it.'
      : 'Selected node has no evidence attached or connected.');
  } else if (input.selectedSplineCount > 0) {
    lines.push(`Selected: ${input.selectedSplineCount} connection${input.selectedSplineCount === 1 ? '' : 's'}, no node.`);
  } else {
    lines.push('Selected node: none. If asked what is selected, say nothing is selected.');
  }

  const evidenceless = nodes.filter((node) => !node.hasReachableEvidence && needsEvidence(node.role));

  lines.push(evidenceless.length
    ? `Nodes that should have evidence and have none: ${evidenceless
        .map((node) => `#${positionById.get(node.id)} ${node.role}`)
        .join(', ')}`
    : 'Every node that should have evidence has some.');

  lines.push('Nodes (position, role, label, evidence, parent position):');
  nodes.forEach((node, index) => {
    const parentPosition = node.parentNodeId ? positionById.get(node.parentNodeId) : undefined;

    lines.push([
      `#${index + 1} ${node.role}`,
      `"${clip(node.label, MAX_LABEL_LENGTH)}"`,
      `evidence=${node.attachedEvidenceCount}${node.hasReachableEvidence ? '+linked' : ''}`,
      node.isRootCause ? 'rootCause' : '',
      node.isSuspectedCause ? 'suspected' : '',
      parentPosition ? `parent=#${parentPosition}` : ''
    ].filter(Boolean).join(' | '));
  });

  if (input.nodes.length > nodes.length) {
    // Said out loud, so the guide does not describe a partial canvas as whole.
    lines.push(`Only the first ${nodes.length} nodes are listed; the canvas holds ${input.nodes.length}.`);
  }

  return lines.join('\n');
}

/** Roles the product itself treats as needing evidence behind them. */
export function needsEvidence(role: string): boolean {
  return [
    'ROOT_CAUSE',
    'CORRECTIVE_ACTION',
    'PREVENTIVE_ACTION',
    'RISK_ASSESSMENT',
    'EFFECTIVENESS',
    'LESSONS_LEARNED'
  ].includes(role);
}

function clip(value: unknown, maxLength: number): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
