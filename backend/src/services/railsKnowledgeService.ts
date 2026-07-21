import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { assertRateLimit } from '../middleware/rateLimit.js';
import {
  listRailsItemActivity,
  listRailsWorkspace,
  type RailsAuditActivity,
  type RailsItem
} from './railsService.js';

interface RailsKnowledgeAskInput {
  itemId?: string;
  question: string;
}

interface RailsKnowledgeAskResponse {
  answer: string;
  model: string;
  source: 'AI' | 'SYSTEM_GUIDE';
}

const RAILS_KNOWLEDGE_VERSION = 'rails-knowledge-2026-07-18-action-progress-evidence-links';

const RAILS_KNOWLEDGE_PACK = [
  `Knowledge version: ${RAILS_KNOWLEDGE_VERSION}.`,
  'RAILS means Rapid Action and Improvement Looping System. It is Synzapp’s controlled improvement workflow that turns LSW observations, RCA findings, manual enterprise intake, hazards, defects, or process gaps into assigned, evidenced, verified, standardized, and audited action loops.',
  'RAILS is not a casual task list. It is a governed loop with backend gates. The assistant can explain and guide, but the backend workflow gate is the source of truth.',
  'Core RAILS stages: New, Triaged, Reopened, In Progress, Verification, Approved, Closed. Cancelled and Archived are controlled terminal states outside the active board flow.',
  'New stage: capture the intake clearly. Confirm owner, department, title, problem statement, due date, priority, source decision, RCA decision, evidence placeholders, and at least one action plan item before triage.',
  'Triaged stage: confirm accountability and scope. The manager should make the RCA decision, decide whether an LSW source is linked, and ensure action owners and due dates are ready before work starts.',
  'Reopened stage: controlled follow-up after closure. The user must document why the loop was reopened, then work through active execution and verification again.',
  'In Progress stage: execute the action plan. Each action needs owner, due date, progress, governed documentation, and linked evidence. Important action types include Contain the immediate risk, Complete corrective action, and Verify effectiveness.',
  'Action progress: each action card shows its own progress bar. 0-20% is red, 20-75% is yellow, and 75-100% is green, with slight blending at the transition points. Changing progress is backend audited with previous and new values. 100% automatically moves the action to Done when completion rules pass.',
  'Verification stage: confirm effectiveness. Every action must be 100%, governed action documentation must be complete, required verification evidence must be linked from the centralized Evidence Library, and verification method/results must support that the issue is controlled.',
  'Approved stage: manager or assigned approver confirms the loop is ready for closure. High risk work must have approval before closure.',
  'Closed stage: the record is retained for audit history. Reopen requires a documented reason. Archive is controlled and should be used for retained records, not to bypass incomplete work.',
  'Evidence model: RAILS uses one centralized Evidence Library in Loop Detail. Users upload evidence once, then link or unlink that visible evidence from action steps, verification, standardization, and closure requirements. Photo evidence shows thumbnails and can be opened in full view; documents open through authenticated backend routes.',
  'Evidence governance: deleting an action step unlinks evidence references but does not delete the centralized evidence record. Linking and unlinking evidence are audited with the actor, timestamp, action, and evidence label. Unlinking requires user confirmation.',
  'Evidence visibility: uploaded evidence is public by default for RAILS linking. Users can switch evidence to private. Private evidence can only be linked when the RAILS loop owner is the same user who uploaded the evidence.',
  'Evidence metadata: evidence records include uploader, upload date and time, file type, file size, status, purpose, label, and visibility. The UI should use the evidence hint icon to show this metadata.',
  'Evidence naming: users rename the visible evidence label from the evidence editor, not inline from the Evidence Library row. The backend keeps the original file extension protected, records the previous name and new name in audit history, and shows who performed the rename with date and time.',
  'Photo evidence editor: image evidence can be cropped and marked with text, pen, eraser, line, arrow, rectangle, and circle tools. The color picker controls the selected mark color; the shared size slider controls stroke size, eraser area, or text size depending on the active tool. The eraser only removes editor-added markup and does not alter the original evidence image.',
  'Action documentation model: containment and corrective actions document what was done, how risk or failure mode was controlled, owner confirmation, and linked implementation evidence. Effectiveness actions document acceptance criteria, actual effectiveness result, approval note, and linked effectiveness evidence. Standardization work belongs on the Standardize page, not as a Verify-page action requirement. Manual timestamp corrections need reasons.',
  'LSW linkage: LSW is a source of leader observation or standard work failure. A RAILS loop can be linked to an LSW task, meeting rail, follow-up, RCA trigger, or improvement project to show why the loop exists and who can trace it.',
  'RCA linkage: RCA is linked when root cause learning is required or already exists. The user may link an existing RCA, request RCA triage, convert an accepted triage request to an RCA project, or document RCA not required with a reason.',
  'Collaboration model: owner remains accountable, collaborators can see and help the loop, and changes are logged. The UI should show collaborators with profile pictures and audit activity with human names.',
  'Standardization model: standardization is mainly used after action effectiveness is proven and before closure. It captures the target, type, owner, due date, verification method, document, and verification approval.',
  'Pagination model: Loop Detail guided workflow is split into Overview, Actions, Verify, Standardize, and Close. Evidence is not part of that pagination. Evidence is a separate Evidence Library tab opened from the Loop Detail header and used only for upload, edit, metadata, visibility, and evidence library management.',
  'Answer style: use simple English, be practical, short, and specific. Tell the user exactly which RAILS page, section, field, button, or workflow gate to use next.',
  'Security: do not reveal secrets, tokens, storage paths, internal database details, raw user ids, or hidden implementation details. Do not provide legal, medical, regulatory, or HR disciplinary advice.'
].join('\n');

const RAILS_SYSTEM_PROMPT = [
  'You are Synzapp RAILS Guide, an enterprise improvement-loop coach inside Synzapp.',
  'Use only the Synzapp RAILS workflow and the supplied sanitized context.',
  'Keep answers in simple English. Be direct and useful.',
  'Guide users through the RAILS page from start to closure, but never claim that a gate is complete unless the context says it is complete.',
  'When blockers exist, explain what to complete next and where in the UI to do it.',
  'If the question is outside RAILS, politely redirect back to RAILS workflow guidance.',
  RAILS_KNOWLEDGE_PACK
].join('\n\n');

export async function askRailsKnowledgeBase(
  decodedToken: DecodedIdToken,
  input: RailsKnowledgeAskInput
): Promise<RailsKnowledgeAskResponse> {
  const question = normalizeQuestion(input.question);

  assertRateLimit(`rails-knowledge:${decodedToken.uid}`, 60_000, 12);

  const context = await buildAuthorizedRailsKnowledgeContext(decodedToken, input.itemId);

  if (!env.openAiApiKey) {
    return {
      answer: buildDeterministicRailsAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }

  try {
    const answer = await requestOpenAiRailsGuidance(question, context);

    return {
      answer,
      model: env.openAiModel,
      source: 'AI'
    };
  } catch (error) {
    console.warn('RAILS knowledge AI fallback:', error instanceof Error ? error.message : error);

    return {
      answer: buildDeterministicRailsAnswer(question, context),
      model: 'system-guide',
      source: 'SYSTEM_GUIDE'
    };
  }
}

async function buildAuthorizedRailsKnowledgeContext(
  decodedToken: DecodedIdToken,
  itemId?: string
): Promise<string> {
  const workspace = await listRailsWorkspace(decodedToken);
  const selectedItem = itemId ? workspace.items.find((item) => item.id === itemId) || null : null;
  const activity = selectedItem ? (await listRailsItemActivity(decodedToken, selectedItem.id)).activity : [];

  return summarizeRailsWorkspaceForAi(workspace, selectedItem, activity);
}

async function requestOpenAiRailsGuidance(question: string, context: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.openAiRequestTimeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: RAILS_SYSTEM_PROMPT,
            role: 'system'
          },
          {
            content: [
              `RAILS context:\n${context}`,
              `User question:\n${question}`
            ].join('\n\n'),
            role: 'user'
          }
        ],
        max_output_tokens: 750,
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
      throw new Error('OpenAI returned an empty RAILS guide response.');
    }

    return outputText.slice(0, 3_600);
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRailsWorkspaceForAi(
  workspace: Awaited<ReturnType<typeof listRailsWorkspace>>,
  selectedItem: RailsItem | null,
  activity: RailsAuditActivity[]
): string {
  const stageSummary = workspace.items.reduce<Record<string, number>>((summary, item) => {
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, {});
  const activeItems = workspace.items
    .slice(0, 25)
    .map((item) => [
      `- ${normalizeContextText(item.displayId, 40)}: ${normalizeContextText(item.title, 120)}`,
      `status=${item.status}`,
      `priority=${item.priority}`,
      `owner=${normalizeContextText(item.owner.displayName, 80)}`,
      `department=${normalizeContextText(item.departmentName || 'Unassigned', 80)}`,
      `progress=${item.actionsProgressPercent}%`,
      `pendingGateItems=${item.workflowGate.blockers.length}`,
      `next=${item.workflowGate.nextStatus || 'none'}`
    ].join('; '))
    .join('\n');

  return [
    `Company: ${normalizeContextText(workspace.context.company.companyName, 100)}`,
    `User role: ${normalizeContextText(workspace.context.user.roleName, 80)}`,
    `Department: ${normalizeContextText(workspace.context.department.name, 80)}`,
    `Workspace summary: open=${workspace.summary.openItems}; critical=${workspace.summary.criticalItems}; escalated=${workspace.summary.escalatedItems}; verification=${workspace.summary.verificationItems}; overdue=${workspace.summary.overdueItems}.`,
    `Stage counts: ${Object.entries(stageSummary).map(([stage, count]) => `${stage}=${count}`).join(', ') || 'none'}.`,
    selectedItem ? summarizeSelectedRailsItem(selectedItem, activity) : 'Selected loop: none. Give general RAILS workspace guidance.',
    activeItems ? `Visible loops:\n${activeItems}` : 'Visible loops: none.'
  ].join('\n');
}

function summarizeSelectedRailsItem(item: RailsItem, activity: RailsAuditActivity[]): string {
  const actions = item.actions.slice(0, 12).map((action) => [
    `- ${normalizeContextText(action.title, 100)}`,
    `status=${action.status}`,
    `progress=${action.progressPercent}%`,
    `owner=${normalizeContextText(action.owner?.displayName || 'Unassigned', 80)}`,
    `due=${action.dueDate || 'not set'}`,
    `evidenceLinks=${action.evidenceIds.length}`,
    `hasContainment=${Boolean(action.containmentNote)}`,
    `hasImplementation=${Boolean(action.implementationNote)}`,
    `hasEffectivenessCriteria=${Boolean(action.effectivenessCriteria)}`,
    `hasEffectivenessResult=${Boolean(action.effectivenessResult)}`,
    `hasStandardizationNote=${Boolean(action.standardizationNote)}`
  ].join('; ')).join('\n');
  const evidence = item.evidence.slice(0, 16).map((entry) => [
    `- ${normalizeContextText(entry.label, 100)}`,
    `status=${entry.status}`,
    `purpose=${entry.purpose || 'general'}`,
    `file=${entry.fileName ? 'yes' : 'no'}`,
    `visibility=${entry.visibility || 'public'}`,
    `sizeBytes=${entry.fileSizeBytes || 0}`
  ].join('; ')).join('\n');
  const recentActivity = activity.slice(0, 8).map((event) => [
    `- ${normalizeContextText(event.summary, 160)}`,
    `by=${normalizeContextText(event.actorDisplayName, 80)}`,
    `type=${event.type}`
  ].join('; ')).join('\n');

  return [
    'Selected loop:',
    `Display ID: ${normalizeContextText(item.displayId, 40)}`,
    `Title: ${normalizeContextText(item.title, 160)}`,
    `Problem: ${normalizeContextText(item.problem, 260)}`,
    `Status: ${item.status}`,
    `Next status: ${item.workflowGate.nextStatus || 'none'}`,
    `Can advance: ${item.workflowGate.canAdvance ? 'yes' : 'no'}`,
    `Gate blockers: ${item.workflowGate.blockers.length ? item.workflowGate.blockers.map((blocker) => normalizeContextText(blocker, 220)).join(' | ') : 'none'}`,
    `Priority: ${item.priority}`,
    `Owner: ${normalizeContextText(item.owner.displayName, 100)}`,
    `Approver: ${normalizeContextText(item.approver?.displayName || 'not assigned', 100)}`,
    `Department: ${normalizeContextText(item.departmentName || 'Unassigned', 100)}`,
    `Due date: ${item.dueDate}`,
    `LSW link: ${item.linkedLswSource ? `${item.linkedLswSource.sourceTypeLabel}: ${normalizeContextText(item.linkedLswSource.title, 140)}` : item.linkedLsw}`,
    `RCA link: ${item.linkedRca}; decision=${item.linkedRcaDecision?.status || 'not decided'}; triage=${item.rcaTriageRequest?.status || 'none'}`,
    `Standardization: target=${Boolean(item.standardization)}; type=${item.standardizationType || 'not selected'}; owner=${normalizeContextText(item.standardizationOwner?.displayName || 'not assigned', 100)}; due=${item.standardizationDueDate || 'not set'}; status=${item.standardizationStatus}; verification=${Boolean(item.standardizationVerification)}; documentVersions=${item.standardizationDocumentVersions.length}; verified=${Boolean(item.standardizationVerifiedAtIso)}`,
    `Collaborators: ${item.contributors.map((person) => normalizeContextText(person.displayName, 80)).join(', ') || 'none'}`,
    actions ? `Actions:\n${actions}` : 'Actions: none.',
    evidence ? `Evidence:\n${evidence}` : 'Evidence: none.',
    recentActivity ? `Recent activity:\n${recentActivity}` : 'Recent activity: none.'
  ].join('\n');
}

function buildDeterministicRailsAnswer(question: string, context: string): string {
  const normalizedQuestion = question.toLowerCase();
  const hasSelectedLoop = context.includes('Selected loop:\n');
  const blockerLine = context.split('\n').find((line) => line.startsWith('Gate blockers: '));
  const blockers = blockerLine?.replace('Gate blockers: ', '').trim();

  if (normalizedQuestion.includes('start') || normalizedQuestion.includes('begin') || normalizedQuestion.includes('new loop')) {
    return [
      'Start the RAILS loop from the Overview page:',
      '1. Enter a clear title and problem statement.',
      '2. Assign one accountable owner, department, priority, and due date.',
      '3. Decide the source: link LSW, link RCA, or document manual enterprise intake.',
      '4. Upload evidence in the Evidence Library when available, then link required verification evidence from that library.',
      '5. Move to Triaged only when those basics are complete.'
    ].join('\n');
  }

  if (normalizedQuestion.includes('next') || normalizedQuestion.includes('move') || normalizedQuestion.includes('advance') || normalizedQuestion.includes('blocked')) {
    if (hasSelectedLoop && blockers && blockers !== 'none') {
      return [
        'This loop cannot move forward yet.',
        'Complete these backend gate items first:',
        ...blockers.split('|').map((blocker) => `- ${blocker.trim()}`)
      ].join('\n');
    }

    return hasSelectedLoop
      ? 'This selected loop has no listed gate blockers in the current context. Use the Advance button when it is active, then verify the next page checklist.'
      : 'Select a RAILS card first. Then I can tell you exactly what is missing before the loop can move forward.';
  }

  if (normalizedQuestion.includes('evidence')) {
    return 'Use the centralized Evidence Library in Loop Detail to upload photos or documents once. Required verification evidence is linked from that library; it does not upload its own separate files. Link visible evidence to the action, verification, or standardization requirement it proves. If you unlink evidence, Synzapp asks for confirmation and logs the change. Deleting an action only unlinks evidence; it does not delete the evidence record.';
  }

  if (normalizedQuestion.includes('progress') || normalizedQuestion.includes('percent')) {
    return 'Each action item has its own progress value and progress bar. 0-20% is red, 20-75% is yellow, and 75-100% is green with a slight color blend near the thresholds. Changing progress is saved by the backend and logged with the previous and new percentage.';
  }

  if (normalizedQuestion.includes('lsw')) {
    return 'LSW links show where the RAILS loop came from. Link an LSW task, meeting rail, follow-up, RCA trigger, or improvement project when a leader standard work observation created the need for action.';
  }

  if (normalizedQuestion.includes('rca')) {
    return 'RCA linkage answers whether root cause analysis is needed. Link an existing RCA when one already exists, request RCA triage when root cause work may be needed, convert accepted triage to an RCA project, or document why RCA is not required.';
  }

  if (normalizedQuestion.includes('standard')) {
    return 'Standardization is used after action effectiveness is proven and before closure. Document the target, select the type, assign an owner, set a due date, add the verification method, attach the standardization document, then mark the plan verified.';
  }

  return [
    'Here is the RAILS guidance:',
    'Use Overview to define the loop, Actions to control and complete the work, Evidence to attach proof, Verify to confirm effectiveness, Standardize to lock in the new standard, and Close only after every backend gate is complete.',
    hasSelectedLoop && blockers && blockers !== 'none'
      ? `For the selected loop, the current blockers are: ${blockers}.`
      : 'Select a loop for exact next-step guidance.'
  ].join('\n\n');
}

function normalizeQuestion(value: string): string {
  const question = normalizeContextText(value, 1_200);

  if (question.length < 3) {
    const error = new Error('Ask a specific RAILS question.');
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
