import { buildRcaAiContext, type RcaAiContextNode } from './rcaAiContext.js';
import { fencePromptData } from './promptText.js';
import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { assertRateLimit } from '../middleware/rateLimit.js';
import {
  estimateOpenAiCostUsd,
  getAiUsageContext,
  writeAiUsageEvent
} from './aiUsageLedgerService.js';
import {
  getRcaIncident,
  listRcaNodes,
  type RcaIncident,
  type RcaNode
} from './rcaService.js';
import { assertTenantAiAllowed } from './tenantAiPolicyService.js';

interface RcaKnowledgeAskInput {
  /** What the canvas says the selected node is missing, as the panel shows it. */
  selectedNodeGaps?: string[];
  selectedNodeId?: string;
  selectedSplineCount?: number;
  incidentId?: string;
  question: string;
  sessionId?: string;
}

interface RcaKnowledgeAskResponse {
  answer: string;
  model: string;
  source: 'AI' | 'SYSTEM_GUIDE';
}

const RCA_KNOWLEDGE_SYSTEM_PROMPT = [
  'You are Synzapp RCA Guide, an enterprise Root Cause Analysis coach for a tenant-scoped node-based RCA system.',
  'You must answer using the Synzapp RCA product flow, not generic RCA theory.',
  'Synzapp RCA flow: create an RCA project, open the war-room canvas, create the Incident node first, then build the RCA in Main View using node-based canvas items.',
  'Synzapp node system: Incident is the parent/root node. Other RCA nodes include Incident Details, Containment, Evidence, Problem Statement, Cause, 5 Whys, Root Cause, CAPA, Corrective, Preventive, Risk Assessment, Effectiveness, Lessons Learned, and Approval & Closure. The current user-facing flow uses Cause for likely causes, 5 Whys for verification, Root Cause for verified direct or contributing causes, then CAPA for action planning.',
  'Synzapp field ownership: Incident and Incident Details capture the factual intake record for what happened, where, when, who, impact, category, product, lot, equipment, and production context. Problem is not a second incident intake form; it is the formal problem statement with expected standard, actual condition, measurable gap, RCA analysis scope, and exclusions.',
  'Synzapp canvas system: users add nodes from the right-click Add Node menu, connect output points to input points with selectable/reconnectable splines, use Fishbone structure for category-based cause mapping, use Sticky Notes for collaboration notes, and use Node Details for structured fields.',
  'Synzapp connection rules: category links classify Cause nodes under Fishbone branches. Incident Details output connects to Problem Statement input. For Fishbone methodology, Problem Statement output connects to Fault Gate input before category branch analysis. A Cause can remain linked to its Fishbone category and also connect to 5 Whys for cause testing. After verification, connect 5 Whys output to Root Cause input. Root Cause output connects to CAPA input. CAPA output connects to Corrective, Preventive, Risk Assessment, Effectiveness, and Lessons Learned. In Fishbone analysis, the final Approval & Closure node is case-level and connects from the Fault Gate, not from individual CAPA stages.',
  'Synzapp 5 Whys governance: the standalone 5 Why methodology is separate from the Fishbone scaffold. In that path, Problem Statement output connects to 5 Whys input, 5 Whys output connects to Root Cause input, Evidence supports the Root Cause, Root Cause output connects to CAPA input, and CAPA expands to its stage nodes with Evidence supporting each stage. Because standalone 5 Why has no Fault Gate, its one Approval & Closure node sits to the right of the CAPA stage stack and accepts side-output links from Corrective Action, Preventive Action, Risk Assessment, Effectiveness, and Lessons Learned. 5 Whys is not a canvas replacement for five separate Answer nodes; it captures structured why answers, verification, evidence notes, and final cause disposition.',
  'Synzapp connection direction: splines should be explained from source output to target input using the visible arrow direction. Do not tell users to connect CAPA output back into Root Cause when the intended flow is Root Cause output to CAPA input. Do not tell users to connect Problem back into Incident Details; the intended upstream flow is Incident Details output to Problem Statement input.',
  'Synzapp evidence flow: Evidence nodes and evidence sections support attachments, thumbnails, photo viewer, and evidence links. Evidence should be attached to the node it proves. On the canvas, this means connecting Evidence node output to the supported node input; do not describe the supported node as feeding into Evidence. CAPA stage nodes also require evidence support: connect Evidence output into Corrective Action, Preventive Action, Risk Assessment, Effectiveness, or Lessons Learned inputs to prove completion, risk decisions, verification, or learning records.',
  'Synzapp collaboration flow: RCA projects are tenant-scoped, owner/collaborator based, realtime collaborative, and supported by invited users, activity logs, node editing/moving indicators, and live canvas presence.',
  'Synzapp closure flow: root cause must be evidence-backed, then CAPA should progress through corrective action, preventive action, risk assessment, effectiveness verification, and lessons learned. Each CAPA stage should have its own evidence support where applicable. Approval & Closure is one final case-level node connected from the Fault Gate and it reviews the entire RCA, not separate stage-to-closure splines.',
  'When the user asks where to start or what next, answer with the next concrete action inside the Synzapp UI and name the node/menu/panel they should use.',
  'Answer only questions about RCA workflow, node usage, evidence quality, containment, problem definition, fishbone cause mapping, 5 Whys thinking, CAPA, verification, lessons learned, approval, and canvas collaboration.',
  'Do not invent regulatory requirements, legal advice, medical advice, or confidential details not provided in the prompt.',
  'Use practical, step-by-step guidance. Be concise, professional, and specific to the user question and the current canvas context.',
  'When RCA canvas context is provided, reference it at a high level and never reveal secrets, tokens, IDs that look internal, or implementation details.',
  'If the user asks for something outside RCA, redirect them back to RCA analysis.',
  /**
   * The canvas controls, as they actually behave.
   *
   * Written from a read of the workspace code rather than from memory. A guide
   * that describes a control it has imagined is worse than one that says it does
   * not know, because a user will go looking for it.
   */
  'Synzapp canvas controls, in the bar at the foot of the canvas: Incident opens the incident launcher. Main View is the canvas methodology. Rearrange Canvas re-runs the automatic layout, moves every node and saves the new positions, and can be undone. Present starts presentation mode. Branches steps through the Fishbone categories one at a time. Validate opens the validation panel. Connect opens connection recommendations. Focus is an on/off switch.',
  'Synzapp Validate: the panel checks only the node that is currently selected and lists that node\'s missing required fields. The number on the Validate button is the count of missing fields on the selected node, so it is 0 when nothing is selected. It does not validate the whole case.',
  'Synzapp Connect: the panel suggests the next node for the selected node and each row both creates that node and draws the connection. Its suggestions are fixed product rules, not AI.',
  'Synzapp Present: presentation mode hides the toolbars and walks fixed steps — RCA overview, Incident path, one step per Fishbone branch, Root causes, then CAPA and closure. Arrow keys move between steps and Escape leaves. The canvas cannot be edited while presenting.',
  'Synzapp Branches: the walkthrough zooms to each Fishbone branch in turn. It only changes the view; it never moves a node.',
  'Synzapp history: Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z redoes canvas changes, including a Rearrange. Switching methodology or reloading the canvas clears that history.',
  'Synzapp incident carry-over: an Incident Details node connected to an Incident node borrows two values from it, so they are not retyped. "Incident Description" fills "What Happened?", "Area / Location" fills "Where Did It Happen?", and "Date of Incident" together with "Time of Incident" fills "When Did It Happen?" — that one field holds both, so a date with no time recorded is carried as midnight. Each is filled only when nobody has written in it; a field holding somebody\'s own words is left alone.',
  'Synzapp fault gate carry-over: connecting a Problem Statement node to a Fault Gate puts the problem statement in the gate\'s Label, because the gate is the top event the branches hang under and that is the problem said once. It writes the gate\'s label rather than a detail field, since a Fault Gate has no details of its own. It only does this while the gate still carries a placeholder — an empty label, the word "Fault Gate", or the incident title a new gate is created with — and never over a name somebody chose. The gate shows two lines of label on the canvas, so a long problem statement is clipped there; the full text stays in the Label field.',
  'Synzapp incident carry-over, when it happens: on connecting the two nodes, and again whenever the Incident Details panel is opened while a field is still unwritten — so a case wired before this existed is filled the next time it is opened. Opening fills the panel; the value is saved when the user saves the node. Because "What Happened?" is also the node\'s title, carrying the account renames the Incident Details node to match, exactly as typing it by hand would; carrying only the date renames nothing. Editing the Incident afterwards does not overwrite a field somebody has since written in.',
  'Synzapp evidence ownership: Evidence nodes hold the files. Another node counts as having evidence when a connected Evidence node holds it, and such a node shows "Evidence node Linked" rather than "Evidence linked". Adding, renaming and removing evidence is done on the Evidence node that owns it, not on the node it supports.',
  /**
   * The context is fact; the model's guesses are not.
   *
   * This is the rule that answers the failure this was built for — asked which
   * node was selected, with no selection in the prompt, it named one anyway.
   */
  'The RCA canvas state given to you is computed from the live canvas and is authoritative. Never contradict it and never guess a fact it could have told you. If it says no node is selected, say nothing is selected. If a detail is not in it — a field\'s contents, who recorded something, a file\'s name — say you cannot see it from here and name the node and panel where the user will find it.',
  'You are told which required fields are missing, never what the filled ones contain. Do not claim to know a value you were not given, and do not ask the user to confirm personal details back to you.',
  'Answer only about Root Cause Analysis and using Synzapp to do it. For anything else — general knowledge, other products, code, or Synzapp\'s own security, infrastructure or internals — say it is outside what this guide covers and offer the nearest RCA question you can answer.'
].join('\n');

const RCA_GUIDE_FALLBACK = [
  'Start with an Incident node, then capture Incident Details and Containment before building causes.',
  'Use the Problem node only to define the formal problem statement: expected standard, actual condition, measurable gap, scope, and exclusions.',
  'Use Evidence nodes for photos, documents, links, measurements, interviews, and records that prove facts.',
  'Use Fishbone branches to separate possible causes by category instead of mixing people, process, equipment, materials, measurement, environment, and management-system causes.',
  'Use either Fishbone Analysis or standalone 5 Why Analysis from the Problem Statement. In Fishbone, convert suspected issues into Cause nodes, connect Cause output to 5 Whys for verification, then connect 5 Whys output to Root Cause when the cause is ruled in as direct or contributing. In standalone 5 Why, connect Problem Statement output to 5 Whys input, then 5 Whys to Root Cause, Root Cause to CAPA.',
  'Use CAPA nodes to separate corrective action, preventive action, risk assessment, effectiveness verification, and lessons learned. Link Evidence into each CAPA stage that needs proof. Use one case-level Approval & Closure node connected from the Fault Gate for Fishbone, or one standalone 5 Why closure node linked from the CAPA stage outputs when no Fault Gate exists.',
  'A strong RCA should show containment, verified facts, cause logic, chosen root cause, CAPA stage evidence, action ownership, due dates, effectiveness evidence, and one case-level closure decision.'
].join('\n');

export async function askRcaKnowledgeBase(
  decodedToken: DecodedIdToken,
  input: RcaKnowledgeAskInput
): Promise<RcaKnowledgeAskResponse> {
  const question = normalizeQuestion(input.question);

  assertRateLimit(`rca-knowledge:${decodedToken.uid}`, 60_000, 12);

  const context = await buildAuthorizedRcaKnowledgeContext(decodedToken, input);

  if (!env.openAiApiKey) {
    return {
      answer: buildDeterministicKnowledgeAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }

  await assertTenantAiAllowed(decodedToken, {
    featureId: 'rca_ai',
    operationId: 'rca.knowledge.ask',
    operationLabel: 'Ask RCA guide',
    resourceId: input.incidentId || null,
    resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace'
  });

  const usageContext = await getAiUsageContext(decodedToken, { requireAdmin: false });
  const startedAt = Date.now();

  try {
    const answer = await requestOpenAiRcaGuidance(question, context);
    const inputTokens = estimateTokenCount(RCA_KNOWLEDGE_SYSTEM_PROMPT.length + context.length + question.length);
    const outputTokens = estimateTokenCount(answer.length);

    await writeAiUsageEvent({
      ...usageContext,
      durationMs: Date.now() - startedAt,
      estimatedCostUsd: estimateOpenAiCostUsd({ inputTokens, outputTokens }),
      featureId: 'rca_ai',
      inputTokens,
      model: env.openAiModel,
      operationId: 'rca.knowledge.ask',
      operationLabel: 'Ask RCA guide',
      outputTokens,
      resourceId: input.incidentId || null,
      resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace',
      status: 'succeeded'
    }).catch(() => undefined);

    return {
      answer,
      model: env.openAiModel,
      source: 'AI'
    };
  } catch (error) {
    console.warn('RCA knowledge AI fallback:', error instanceof Error ? error.message : error);
    await writeAiUsageEvent({
      ...usageContext,
      durationMs: Date.now() - startedAt,
      errorCategory: getAiKnowledgeErrorCategory(error),
      featureId: 'rca_ai',
      model: env.openAiModel,
      operationId: 'rca.knowledge.ask',
      operationLabel: 'Ask RCA guide',
      resourceId: input.incidentId || null,
      resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace',
      status: 'failed'
    }).catch(() => undefined);

    return {
      answer: buildDeterministicKnowledgeAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }
}

/**
 * Asks the same question, delivering the answer as it is written.
 *
 * Every guard `askRcaKnowledgeBase` applies applies here too — rate limit,
 * tenant AI policy, usage accounting — because a different route must not be a
 * way around any of them.
 *
 * If the model cannot be reached the deterministic guide is returned instead,
 * exactly as before. `onDelta` is told nothing in that case: the caller sends
 * the whole fallback at once rather than pretending it was generated.
 */
export async function streamRcaKnowledgeBase(
  decodedToken: DecodedIdToken,
  input: RcaKnowledgeAskInput,
  onDelta: (delta: string) => void
): Promise<RcaKnowledgeAskResponse> {
  const question = normalizeQuestion(input.question);

  assertRateLimit(`rca-knowledge:${decodedToken.uid}`, 60_000, 12);

  const context = await buildAuthorizedRcaKnowledgeContext(decodedToken, input);

  if (!env.openAiApiKey) {
    return {
      answer: buildDeterministicKnowledgeAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }

  await assertTenantAiAllowed(decodedToken, {
    featureId: 'rca_ai',
    operationId: 'rca.knowledge.ask',
    operationLabel: 'Ask RCA guide',
    resourceId: input.incidentId || null,
    resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace'
  });

  const usageContext = await getAiUsageContext(decodedToken, { requireAdmin: false });
  const startedAt = Date.now();
  let deliveredCharacters = 0;

  try {
    const answer = await requestOpenAiRcaGuidanceStream(question, context, (delta) => {
      deliveredCharacters += delta.length;
      onDelta(delta);
    });
    const inputTokens = estimateTokenCount(RCA_KNOWLEDGE_SYSTEM_PROMPT.length + context.length + question.length);
    const outputTokens = estimateTokenCount(answer.length);

    await writeAiUsageEvent({
      ...usageContext,
      durationMs: Date.now() - startedAt,
      estimatedCostUsd: estimateOpenAiCostUsd({ inputTokens, outputTokens }),
      featureId: 'rca_ai',
      inputTokens,
      model: env.openAiModel,
      operationId: 'rca.knowledge.ask',
      operationLabel: 'Ask RCA guide',
      outputTokens,
      resourceId: input.incidentId || null,
      resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace',
      status: 'succeeded'
    }).catch(() => undefined);

    return { answer, model: env.openAiModel, source: 'AI' };
  } catch (error) {
    console.warn('RCA knowledge AI stream fallback:', error instanceof Error ? error.message : error);
    await writeAiUsageEvent({
      ...usageContext,
      durationMs: Date.now() - startedAt,
      errorCategory: getAiKnowledgeErrorCategory(error),
      featureId: 'rca_ai',
      model: env.openAiModel,
      operationId: 'rca.knowledge.ask',
      operationLabel: 'Ask RCA guide',
      resourceId: input.incidentId || null,
      resourceType: input.incidentId ? 'rca_incident' : 'rca_workspace',
      status: 'failed'
    }).catch(() => undefined);

    /**
     * Only safe to replace an answer nobody has read yet.
     *
     * Once words have gone out, swapping in the guide would rewrite what is
     * already on screen. A stream that broke part way keeps what it delivered.
     */
    if (deliveredCharacters > 0) {
      throw error;
    }

    return {
      answer: buildDeterministicKnowledgeAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }
}

async function buildAuthorizedRcaKnowledgeContext(
  decodedToken: DecodedIdToken,
  input: RcaKnowledgeAskInput
): Promise<string> {
  if (!input.incidentId || !input.sessionId) {
    return 'No active RCA canvas context was provided. Give general node-based RCA guidance.';
  }

  const [incident, nodesResult] = await Promise.all([
    getRcaIncident(decodedToken, input.incidentId),
    listRcaNodes(decodedToken, input.incidentId, input.sessionId)
  ]);

  return buildRcaAiContext({
    incident: {
      departmentName: incident.departmentName || '',
      // The session's methodology is not carried on the incident, and the guide
      // does not need it to answer; the canvas state speaks for itself.
      methodology: 'Main View',
      status: incident.status || '',
      title: incident.title || ''
    },
    nodes: describeNodesForAi(nodesResult.nodes),
    selectedNodeGaps: (input.selectedNodeGaps || []).map((gap) => String(gap)),
    selectedNodeId: input.selectedNodeId || null,
    selectedSplineCount: input.selectedSplineCount || 0
  });
}

/**
 * The same request, relayed a piece at a time.
 *
 * Worth the separate path rather than revealing a finished answer gradually:
 * the first words arrive while the rest is still being written, so the wait is
 * spent reading. A typewriter over a completed answer only adds delay.
 */
async function requestOpenAiRcaGuidanceStream(
  question: string,
  context: string,
  onDelta: (delta: string) => void
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.openAiRequestTimeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          { content: RCA_KNOWLEDGE_SYSTEM_PROMPT, role: 'system' },
          {
            content: [
              fencePromptData('RCA context', context),
              `User question:\n${question}`
            ].join('\n\n'),
            role: 'user'
          }
        ],
        /**
         * Room to finish.
         *
         * 650 cut a start-to-finish walkthrough off mid-item, leaving a
         * dangling bullet and no sign anything was missing — the answer simply
         * stopped. A full process answer runs well past that.
         */
        max_output_tokens: 2400,
        model: env.openAiModel,
        stream: true
      }),
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const failureBody = await response.text().catch(() => '');

      throw new Error(
        `OpenAI stream failed with status ${response.status}. ${failureBody.slice(0, 300)}`.trim()
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let answer = '';

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });

      /**
       * Split on the blank line that ends an event, and keep the remainder.
       *
       * A chunk boundary falls wherever the network puts it, routinely through
       * the middle of a JSON payload, so anything after the last complete event
       * is held back rather than parsed.
       */
      const events = buffered.split('\n\n');

      buffered = events.pop() || '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) {
            continue;
          }

          const payload = line.slice(5).trim();

          if (!payload || payload === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(payload) as { delta?: string; type?: string };

            if (parsed.type === 'response.output_text.delta' && parsed.delta) {
              answer += parsed.delta;
              onDelta(parsed.delta);
            }
          } catch {
            // A payload that will not parse is skipped rather than ending the
            // answer somebody is already reading.
          }
        }
      }
    }

    const trimmedAnswer = answer.trim();

    if (!trimmedAnswer) {
      throw new Error('OpenAI stream produced no text.');
    }

    return trimmedAnswer;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOpenAiRcaGuidance(question: string, context: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.openAiRequestTimeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: RCA_KNOWLEDGE_SYSTEM_PROMPT,
            role: 'system'
          },
          {
            content: [
              `RCA context:\n${context}`,
              `User question:\n${question}`
            ].join('\n\n'),
            role: 'user'
          }
        ],
        /**
         * Room to finish.
         *
         * 650 cut a start-to-finish walkthrough off mid-item, leaving a
         * dangling bullet and no sign anything was missing — the answer simply
         * stopped. A full process answer runs well past that.
         */
        max_output_tokens: 2400,
        model: env.openAiModel
        /**
         * No `temperature`.
         *
         * The configured model rejects it outright — "Unsupported parameter:
         * 'temperature' is not supported with this model" — so every request
         * returned 400 and every answer users saw was the deterministic
         * fallback, labelled "System guide". Style is set by the system prompt.
         */
      }),
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    });

    if (!response.ok) {
      /**
       * The body, not just the status.
       *
       * A bare "failed with status 400" took a live reproduction to explain,
       * while OpenAI had been naming the offending parameter in the body all
       * along. Truncated because it is going into a log line.
       */
      const failureBody = await response.text().catch(() => '');

      throw new Error(
        `OpenAI request failed with status ${response.status}. ${failureBody.slice(0, 300)}`.trim()
      );
    }

    const body = await response.json() as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
          type?: string;
        }>;
      }>;
    };
    const outputText = body.output_text ||
      body.output?.flatMap((item) => item.content || [])
        .map((content) => content.text || '')
        .join('\n')
        .trim();

    if (!outputText) {
      throw new Error('OpenAI returned an empty RCA guide response.');
    }

    return outputText.slice(0, 3_200);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reduces canvas nodes to the handful of facts the guide may see.
 *
 * The reduction happens here rather than in the builder, so the builder never
 * holds an RcaNode at all — it cannot leak a field it was never handed.
 */
function describeNodesForAi(nodes: RcaNode[]): RcaAiContextNode[] {
  const activeNodes = nodes.filter((node) => node.status !== 'DELETED');
  const activeNodeById = new Map(activeNodes.map((node) => [node.id, node]));
  const childrenByParentId = new Map<string, RcaNode[]>();

  activeNodes.forEach((node) => {
    if (!node.parentNodeId || !activeNodeById.has(node.parentNodeId)) {
      return;
    }

    const siblings = childrenByParentId.get(node.parentNodeId) || [];

    siblings.push(node);
    childrenByParentId.set(node.parentNodeId, siblings);
  });

  return activeNodes.map((node) => ({
    attachedEvidenceCount: node.attachedEvidence.length,
    hasReachableEvidence: hasRcaKnowledgeEvidenceSupport(node, childrenByParentId, activeNodeById),
    id: node.id,
    isRootCause: Boolean(node.isRootCause),
    isSuspectedCause: Boolean(node.isSuspectedCause),
    label: node.label || '',
    parentNodeId: node.parentNodeId || null,
    role: node.fiveWhysRole || node.nodeType
  }));
}

function summarizeRcaCanvasForAi(incident: RcaIncident, nodes: RcaNode[]): string {
  const activeNodes = nodes.filter((node) => node.status !== 'DELETED');
  const activeNodeById = new Map(activeNodes.map((node) => [node.id, node]));
  const childrenByParentId = new Map<string, RcaNode[]>();

  activeNodes.forEach((node) => {
    if (!node.parentNodeId || !activeNodeById.has(node.parentNodeId)) {
      return;
    }

    const siblings = childrenByParentId.get(node.parentNodeId) || [];
    siblings.push(node);
    childrenByParentId.set(node.parentNodeId, siblings);
  });

  const capaStageNodes = activeNodes.filter(isRcaKnowledgeCapaStageNode);
  const capaStagesWithoutEvidence = capaStageNodes.filter((node) => !hasRcaKnowledgeEvidenceSupport(node, childrenByParentId, activeNodeById));
  const nodeSummaries = nodes
    .slice(0, 80)
    .map((node) => {
      const role = node.fiveWhysRole || node.nodeType;
      const label = normalizeContextText(node.label || '(empty)', 180);
      const evidenceCount = node.attachedEvidence.length;
      const parent = node.parentNodeId ? ` parent=${node.parentNodeId}` : '';

      return `- ${role}: ${label}; evidence=${evidenceCount}; rootCause=${node.isRootCause ? 'yes' : 'no'}; suspected=${node.isSuspectedCause ? 'yes' : 'no'}${parent}`;
    })
    .join('\n');

  return [
    'Synzapp RCA system reminder: the user is working in the node-based war-room canvas. Guidance should tell them what Synzapp node, canvas action, Node Details panel, evidence area, or collaboration feature to use next.',
    `Project title: ${normalizeContextText(incident.title, 180)}`,
    `Project display ID: ${normalizeContextText(incident.displayId, 60)}`,
    `Status: ${incident.status}`,
    `Department: ${normalizeContextText(incident.departmentName, 100)}`,
    `RPN: ${incident.rpnScore}`,
    `Node count: ${nodes.length}`,
    `CAPA stage count: ${capaStageNodes.length}`,
    `CAPA stages missing linked evidence: ${capaStagesWithoutEvidence.length}`,
    nodeSummaries ? `Nodes:\n${nodeSummaries}` : 'Nodes: none yet.'
  ].join('\n');
}

function isRcaKnowledgeEvidenceNode(node: RcaNode | null | undefined): boolean {
  return Boolean(node && node.status !== 'DELETED' && node.nodeType === 'WHY' && node.fiveWhysRole === 'EVIDENCE');
}

function isRcaKnowledgeCapaStageNode(node: RcaNode | null | undefined): boolean {
  return Boolean(
    node &&
    node.status !== 'DELETED' &&
    node.nodeType === 'WHY' &&
    [
      'CORRECTIVE_ACTION',
      'PREVENTIVE_ACTION',
      'RISK_ASSESSMENT',
      'EFFECTIVENESS',
      'LESSONS_LEARNED'
    ].includes(node.fiveWhysRole || '')
  );
}

function hasRcaKnowledgeEvidenceSupport(
  node: RcaNode,
  childrenByParentId: Map<string, RcaNode[]>,
  nodeById: Map<string, RcaNode>
): boolean {
  if (node.attachedEvidence.length) {
    return true;
  }

  if ((childrenByParentId.get(node.id) || []).some((childNode) => isRcaKnowledgeEvidenceNode(childNode) || childNode.attachedEvidence.length > 0)) {
    return true;
  }

  if (node.parentNodeId) {
    const parentNode = nodeById.get(node.parentNodeId);

    if (isRcaKnowledgeEvidenceNode(parentNode)) {
      return true;
    }
  }

  return normalizeRcaKnowledgeLinkedNodeIds(node.linkedNodeIds)
    .map((linkedNodeId) => nodeById.get(linkedNodeId))
    .some((linkedNode) => Boolean(linkedNode && (isRcaKnowledgeEvidenceNode(linkedNode) || linkedNode.attachedEvidence.length > 0)));
}

function normalizeRcaKnowledgeLinkedNodeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
  )];
}

function buildDeterministicKnowledgeAnswer(question: string, context: string): string {
  const normalizedQuestion = question.toLowerCase();
  const hasCanvasContext = !context.startsWith('No active RCA canvas context');

  if (normalizedQuestion.includes('start') || normalizedQuestion.includes('scratch') || normalizedQuestion.includes('begin')) {
    return [
      'In Synzapp, start the RCA from the war-room canvas in this order:',
      '1. Create the Incident node first. This is the parent node for the RCA.',
      '2. Right-click the canvas and add Incident Details. Use Node Details to capture what happened, where, when, who discovered it, and impact.',
      '3. Add Containment to record immediate controls such as hold, stop, isolate, clean, repair, or notify.',
      '4. Add Problem to convert the incident facts into one clear problem statement: expected standard, actual condition, measurable gap, scope, and exclusions.',
      '5. Connect Incident Details output to Problem input so the formal problem statement is visibly based on the verified incident facts.',
      '6. Choose the methodology from Connection Recommendations. For Fishbone, connect Problem output to Fault Gate input before organizing suspected causes under branches. For standalone 5 Why Analysis, connect Problem output to 5 Whys input, then 5 Whys to Root Cause.',
      '7. Add Evidence nodes or use the Evidence section to attach photos, links, records, measurements, interviews, and logs to the exact node they prove.',
      '8. Use Main View/Fishbone to organize suspected causes under the correct branches, or use standalone 5 Why Analysis when branch categorization is not the selected method.',
      '9. Mark only evidence-backed causes as Root Cause candidates and connect Evidence into the Root Cause node that it proves.',
      '10. Build CAPA from Root Cause through corrective action, preventive action, risk assessment, effectiveness verification, and lessons learned. Connect Evidence output into each CAPA stage that needs proof, then use one Approval & Closure node from the Fault Gate for Fishbone closeout or the governed closure workflow for standalone 5 Why cases.',
      hasCanvasContext ? 'I can also use the active canvas context to help review gaps in the current RCA.' : 'Open an RCA canvas and ask again for guidance specific to that project.'
    ].join('\n');
  }

  if (normalizedQuestion.includes('evidence')) {
    return 'Good RCA evidence should be objective, traceable, and attached to the relevant node: photos, records, sensor readings, batch/lot data, interview notes, maintenance logs, SOPs, sanitation records, QA checks, and verification results. Avoid marking a root cause until the evidence supports it.';
  }

  if (normalizedQuestion.includes('capa') || normalizedQuestion.includes('corrective') || normalizedQuestion.includes('preventive')) {
    return 'CAPA should separate correction from prevention: corrective action fixes the verified root cause, preventive action reduces recurrence risk, risk assessment confirms residual risk, effectiveness checks prove the action worked, and lessons learned capture system changes. Each CAPA stage should be evidence-backed by connecting Evidence output into the stage input. The final Approval & Closure node is one case-level closeout connected from the Fault Gate, not from every CAPA stage.';
  }

  return [
    'Here is the enterprise RCA guidance I can provide:',
    RCA_GUIDE_FALLBACK,
    hasCanvasContext ? 'Because an RCA canvas is active, ask a specific question like “what is missing before root cause approval?” for project-specific guidance.' : 'Open an RCA canvas for context-aware help.'
  ].join('\n\n');
}

function normalizeQuestion(value: string): string {
  const question = normalizeContextText(value, 1_200);

  if (question.length < 3) {
    const error = new Error('Ask a specific RCA question.');
    error.name = 'ValidationError';
    throw error;
  }

  return question;
}

function normalizeContextText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function estimateTokenCount(characterCount: number): number {
  return Math.max(1, Math.ceil(characterCount / 4));
}

function getAiKnowledgeErrorCategory(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('quota') || message.includes('credit') || message.includes('billing')) {
    return 'provider_credit_exhausted' as const;
  }

  if (message.includes('rate')) {
    return 'provider_rate_limited' as const;
  }

  if (message.includes('abort') || message.includes('timeout')) {
    return 'provider_timeout' as const;
  }

  if (message.includes('401') || message.includes('403') || message.includes('auth')) {
    return 'provider_auth_error' as const;
  }

  if (message.includes('404') || message.includes('model')) {
    return 'provider_model_unavailable' as const;
  }

  return 'unknown' as const;
}
