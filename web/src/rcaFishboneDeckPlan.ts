/**
 * The order a Fishbone RCA is presented in.
 *
 * A deck grouped by node type — every Cause together, every Evidence together —
 * is how the data is stored, not how the analysis is explained. It leaves a
 * room looking at seventeen unrelated items on one slide and no way to see
 * which cause any of them belongs to.
 *
 * This follows the canvas instead. The case is set up once, then each Fishbone
 * category is presented with the causes hanging under it, and each cause is
 * followed down its own chain — the evidence behind it, the five whys that
 * tested it, the root cause it produced, and the CAPA that answers it. Approval
 * and closure come last, because they are about the whole case.
 *
 * Nothing unconnected is included, and no category with nothing under it: a
 * slide for a node nobody joined to anything is a slide about nothing.
 *
 * No react or pptx import, so the ordering can be tested.
 */

export interface RcaDeckPlanNode {
  id: string;
  /** What the branch is called, for a category heading. */
  label?: string;
  linkedNodeIds?: string[];
  nodeType: string;
  parentNodeId?: string | null;
  role: string | null;
  status?: string;
}

export interface RcaDeckPlanSection {
  nodeIds: string[];
  subtitle: string;
  title: string;
}

/** The chain below a cause, in the order an investigator walks it. */
const CHAIN_ROLES = ['EVIDENCE', 'FIVE_WHYS', 'ANSWER', 'ROOT_CAUSE', 'CAPA'] as const;

/** CAPA breaks into stages, and they are presented in this order. */
const CAPA_STAGE_ROLES = [
  'CORRECTIVE_ACTION',
  'PREVENTIVE_ACTION',
  'RISK_ASSESSMENT',
  'EFFECTIVENESS',
  'LESSONS_LEARNED'
] as const;

const SETUP_ROLES = ['INCIDENT', 'INCIDENT_DETAILS', 'CONTAINMENT', 'PROBLEM'] as const;

export function planRcaFishboneDeck(nodes: RcaDeckPlanNode[]): RcaDeckPlanSection[] {
  const active = nodes.filter((node) => node.status !== 'DELETED');
  const byId = new Map(active.map((node) => [node.id, node]));
  const childrenOf = new Map<string, RcaDeckPlanNode[]>();

  active.forEach((node) => {
    if (!node.parentNodeId || !byId.has(node.parentNodeId)) {
      return;
    }

    const siblings = childrenOf.get(node.parentNodeId) || [];

    siblings.push(node);
    childrenOf.set(node.parentNodeId, siblings);
  });

  /**
   * Everything a node reaches downward: its children, plus anything it names as
   * linked. Evidence is joined by a link rather than parentage as often as not.
   */
  const reach = (node: RcaDeckPlanNode): RcaDeckPlanNode[] => {
    const linked = (node.linkedNodeIds || [])
      .map((linkedId) => byId.get(linkedId))
      .filter((candidate): candidate is RcaDeckPlanNode => Boolean(candidate));

    return [...(childrenOf.get(node.id) || []), ...linked];
  };
  const taken = new Set<string>();
  const take = (node: RcaDeckPlanNode | undefined): string[] => {
    if (!node || taken.has(node.id)) {
      return [];
    }

    taken.add(node.id);

    return [node.id];
  };
  const sections: RcaDeckPlanSection[] = [];

  // The case, once. These describe the incident rather than any one cause.
  const setupIds = SETUP_ROLES.flatMap((role) => active.filter((node) => node.role === role).flatMap(take));

  if (setupIds.length) {
    sections.push({
      nodeIds: setupIds,
      subtitle: 'What happened, what was contained, and the problem being analysed.',
      title: 'The case'
    });
  }

  /**
   * A cause and everything hanging off it, depth first.
   *
   * Written as a walk rather than a fixed list of roles because a chain is not
   * always the same depth — evidence can sit under a cause, under its five
   * whys, or under a CAPA stage, and each belongs where it was attached.
   */
  const walkChain = (node: RcaDeckPlanNode): string[] => {
    const ids = take(node);

    if (!ids.length) {
      return ids;
    }

    const children = reach(node);
    const ordered = [
      ...CHAIN_ROLES.flatMap((role) => children.filter((child) => child.role === role)),
      ...CAPA_STAGE_ROLES.flatMap((role) => children.filter((child) => child.role === role)),
      ...children.filter((child) => isCauseNode(child))
    ];

    return ordered.reduce((collected, child) => [...collected, ...walkChain(child)], ids);
  };

  active
    .filter((node) => node.nodeType === 'ISHIKAWA_CATEGORY')
    .forEach((category) => {
      const causes = reach(category).filter(isCauseNode);
      const nodeIds = causes.flatMap(walkChain);

      // A branch nobody put a cause under is not a section; it is an empty box.
      if (!nodeIds.length) {
        return;
      }

      sections.push({
        nodeIds,
        subtitle: 'Causes under this branch, each followed through evidence, five whys, root cause and CAPA.',
        title: (category.label || '').trim() || 'Fishbone branch'
      });
    });

  // Anything joined to the analysis but reached by no branch — a cause hung off
  // the fault gate, say. Better listed than silently dropped.
  const strayIds = active
    .filter((node) => !taken.has(node.id) && isChainNode(node) && hasConnection(node, byId))
    .flatMap(take);

  if (strayIds.length) {
    sections.push({
      nodeIds: strayIds,
      subtitle: 'Connected items not sitting under a Fishbone branch.',
      title: 'Other connected analysis'
    });
  }

  const closureIds = active.filter((node) => node.role === 'APPROVAL_CLOSURE').flatMap(take);

  if (closureIds.length) {
    sections.push({
      nodeIds: closureIds,
      subtitle: 'The case-level review and decision to close.',
      title: 'Approval and closure'
    });
  }

  return sections;
}

export function isCauseNode(node: RcaDeckPlanNode): boolean {
  return node.nodeType === 'CAUSE' || node.nodeType === 'SUB_CAUSE';
}

function isChainNode(node: RcaDeckPlanNode): boolean {
  return isCauseNode(node) ||
    [...CHAIN_ROLES, ...CAPA_STAGE_ROLES].includes(node.role as typeof CHAIN_ROLES[number]);
}

/** Joined to something, either way round. */
function hasConnection(node: RcaDeckPlanNode, byId: Map<string, RcaDeckPlanNode>): boolean {
  return Boolean(
    (node.parentNodeId && byId.has(node.parentNodeId)) ||
    (node.linkedNodeIds || []).some((linkedId) => byId.has(linkedId))
  );
}
