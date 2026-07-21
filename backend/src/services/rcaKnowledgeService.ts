import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { assertRateLimit } from '../middleware/rateLimit.js';
import {
  getRcaIncident,
  listRcaNodes,
  type RcaIncident,
  type RcaNode
} from './rcaService.js';

interface RcaKnowledgeAskInput {
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
  'Synzapp node system: Incident is the parent/root node. Other RCA nodes include Incident Details, Containment, Evidence, Problem, Why, Answer, Root Cause, CAPA, Corrective, Preventive, Risk Assessment, Effectiveness, Lessons Learned, and Approval & Closure.',
  'Synzapp canvas system: users add nodes from the right-click Add Node menu, connect output points to input points with selectable/reconnectable splines, use Fishbone structure for category-based cause mapping, use Sticky Notes for collaboration notes, and use Node Details for structured fields.',
  'Synzapp connection rules: category links classify cause/root-cause nodes under Fishbone branches. Problem and Root Cause nodes are allowed to keep their classification or upstream link while also feeding multiple downstream outputs. A Root Cause can remain linked to its Fishbone category and also connect its output to CAPA. CAPA input should receive the arrow from the Root Cause output.',
  'Synzapp connection direction: splines should be explained from source output to target input using the visible arrow direction. Do not tell users to connect CAPA output back into Root Cause when the intended flow is Root Cause output to CAPA input.',
  'Synzapp evidence flow: Evidence nodes and evidence sections support attachments, thumbnails, photo viewer, and evidence links. Evidence should be attached to the node it proves. On the canvas, this means connecting Evidence node output to the supported node input; do not describe the supported node as feeding into Evidence.',
  'Synzapp collaboration flow: RCA projects are tenant-scoped, owner/collaborator based, realtime collaborative, and supported by invited users, activity logs, node editing/moving indicators, and live canvas presence.',
  'Synzapp closure flow: root cause must be evidence-backed, then CAPA should progress through corrective action, preventive action, risk assessment, effectiveness verification, lessons learned, and approval/closure.',
  'When the user asks where to start or what next, answer with the next concrete action inside the Synzapp UI and name the node/menu/panel they should use.',
  'Answer only questions about RCA workflow, node usage, evidence quality, containment, problem definition, fishbone cause mapping, 5 Whys thinking, CAPA, verification, lessons learned, approval, and canvas collaboration.',
  'Do not invent regulatory requirements, legal advice, medical advice, or confidential details not provided in the prompt.',
  'Use practical, step-by-step guidance. Be concise, professional, and specific to the user question and the current canvas context.',
  'When RCA canvas context is provided, reference it at a high level and never reveal secrets, tokens, IDs that look internal, or implementation details.',
  'If the user asks for something outside RCA, redirect them back to RCA analysis.'
].join('\n');

const RCA_GUIDE_FALLBACK = [
  'Start with an Incident node, then capture Incident Details and Containment before building causes.',
  'Use Evidence nodes for photos, documents, links, measurements, interviews, and records that prove facts.',
  'Use Fishbone branches to separate possible causes by category instead of mixing people, process, equipment, materials, measurement, environment, and management-system causes.',
  'Convert only evidence-backed causes into Root Cause candidates.',
  'Use CAPA nodes to separate corrective action, preventive action, risk assessment, effectiveness verification, lessons learned, and approval or closure.',
  'A strong RCA should show containment, verified facts, cause logic, chosen root cause, action ownership, due dates, and effectiveness evidence.'
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

  try {
    const answer = await requestOpenAiRcaGuidance(question, context);

    return {
      answer,
      model: env.openAiModel,
      source: 'AI'
    };
  } catch (error) {
    console.warn('RCA knowledge AI fallback:', error instanceof Error ? error.message : error);

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

  return summarizeRcaCanvasForAi(incident, nodesResult.nodes);
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
        max_output_tokens: 650,
        model: env.openAiModel,
        temperature: 0.2
      }),
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}.`);
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

function summarizeRcaCanvasForAi(incident: RcaIncident, nodes: RcaNode[]): string {
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
    nodeSummaries ? `Nodes:\n${nodeSummaries}` : 'Nodes: none yet.'
  ].join('\n');
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
      '4. Add Evidence nodes or use the Evidence section to attach photos, links, records, measurements, interviews, and logs to the exact node they prove.',
      '5. Use Main View/Fishbone to organize suspected causes under the correct branches.',
      '6. Mark only evidence-backed causes as Root Cause candidates.',
      '7. Build CAPA through corrective action, preventive action, risk assessment, effectiveness verification, lessons learned, and approval/closure.',
      hasCanvasContext ? 'I can also use the active canvas context to help review gaps in the current RCA.' : 'Open an RCA canvas and ask again for guidance specific to that project.'
    ].join('\n');
  }

  if (normalizedQuestion.includes('evidence')) {
    return 'Good RCA evidence should be objective, traceable, and attached to the relevant node: photos, records, sensor readings, batch/lot data, interview notes, maintenance logs, SOPs, sanitation records, QA checks, and verification results. Avoid marking a root cause until the evidence supports it.';
  }

  if (normalizedQuestion.includes('capa') || normalizedQuestion.includes('corrective') || normalizedQuestion.includes('preventive')) {
    return 'CAPA should separate correction from prevention: corrective action fixes the verified root cause, preventive action reduces recurrence risk, risk assessment confirms residual risk, effectiveness checks prove the action worked, lessons learned capture system changes, and approval closes the RCA.';
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
