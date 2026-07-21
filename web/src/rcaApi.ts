import { getSynzappApiBaseUrl } from './config';
import {
  getAppCheckHeader,
  getSynzappFirebaseAuth
} from './firebase';

export type RcaIncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED';
export type RcaSessionStatus = 'ACTIVE' | 'FREEZE' | 'COMPLETED' | 'CLOSED';
export type RcaMethodology = '5_WHYS' | 'ISHIKAWA' | 'FAULT_TREE';
export type RcaNodeType = 'WHY' | 'ISHIKAWA_CATEGORY' | 'CAUSE' | 'SUB_CAUSE' | 'FAULT_GATE' | 'STICKY_NOTE';
export type RcaFiveWhysNodeRole =
  | 'INCIDENT'
  | 'INCIDENT_DETAILS'
  | 'CONTAINMENT'
  | 'EVIDENCE'
  | 'PROBLEM'
  | 'FIVE_WHYS'
  | 'ANSWER'
  | 'ROOT_CAUSE'
  | 'CAPA'
  | 'CORRECTIVE_ACTION'
  | 'PREVENTIVE_ACTION'
  | 'RISK_ASSESSMENT'
  | 'EFFECTIVENESS'
  | 'LESSONS_LEARNED'
  | 'APPROVAL_CLOSURE';
export type RcaSplineLineType = 'CONTINUOUS' | 'DASHED' | 'DOTTED';
export type RcaSplineArrowHead = 'OPEN' | 'CLOSED' | 'CLOSED_FILLED';

export interface RcaRiskFactors {
  detection: number;
  occurrence: number;
  severity: number;
}

export interface RcaWorkspaceContext {
  company: {
    companyName: string;
    tenantId: string;
  };
  department: {
    departmentId: string | null;
    name: string;
    status: string;
  };
  user: {
    displayName: string;
    role: string;
    roleName: string;
    uid: string;
  };
}

export interface RcaUserSummary {
  departmentName: string | null;
  displayName: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  roleName: string;
  uid: string;
}

export interface RcaIncident {
  activeSessionId: string | null;
  assetId: string;
  accessRole: 'OWNER' | 'INVITED';
  collaborators: RcaUserSummary[];
  createdAtIso: string | null;
  createdByUid: string;
  departmentId: string | null;
  departmentName: string;
  displayId: string;
  id: string;
  owner: RcaUserSummary | null;
  riskFactors: RcaRiskFactors;
  rpnScore: number;
  sourceRailsDisplayId: string | null;
  sourceRailsItemId: string | null;
  status: RcaIncidentStatus;
  tenantId: string;
  title: string;
  updatedAtIso: string | null;
}

export interface RcaSession {
  closedAtIso: string | null;
  createdAtIso: string | null;
  id: string;
  incidentId: string;
  leadInvestigatorId: string;
  methodology: RcaMethodology;
  status: RcaSessionStatus;
  updatedAtIso: string | null;
}

export interface RcaUiCoordinates {
  layoutMethodology: RcaMethodology;
  x: number;
  y: number;
}

export interface RcaAttachedEvidence {
  fileHash: string;
  fileName: string;
  fileUrl: string;
  uploadedAtIso?: string;
}

export interface RcaNodeVisualStyle {
  backgroundColor?: string | null;
  borderColor?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  isBold?: boolean | null;
  isItalic?: boolean | null;
  isUnderline?: boolean | null;
  textColor?: string | null;
}

export interface RcaNodeEdgeStyle {
  arrowHead?: RcaSplineArrowHead | null;
  color?: string | null;
  lineType?: RcaSplineLineType | null;
  weight?: number | null;
}

export interface RcaNodeConnectionHandles {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface RcaNodeDimensions {
  height?: number | null;
  width?: number | null;
}

export interface RcaNode {
  attachedEvidence: RcaAttachedEvidence[];
  connectionHandles?: RcaNodeConnectionHandles;
  createdBy?: RcaUserSummary | null;
  createdAtIso: string | null;
  dimensions?: RcaNodeDimensions;
  detailFields?: Record<string, string>;
  edgeStyle?: RcaNodeEdgeStyle;
  id: string;
  isRootCause: boolean;
  isSuspectedCause: boolean;
  fiveWhysRole?: RcaFiveWhysNodeRole | null;
  label: string;
  lockedAtIso: string | null;
  lockedBy: string | null;
  nodeType: RcaNodeType;
  parentNodeId: string | null;
  status: 'ACTIVE' | 'DELETED';
  uiCoordinates: RcaUiCoordinates;
  updatedAtIso: string | null;
  visualStyle?: RcaNodeVisualStyle;
  whyChain: string[];
}

export type RcaActivityLogAction =
  | 'MULTI_DELETED'
  | 'NODE_CREATED'
  | 'NODE_DELETED'
  | 'NODE_MOVED'
  | 'NODE_TEXT_UPDATED'
  | 'NODE_UPDATED'
  | 'REDO'
  | 'SPLINE_CONNECTED'
  | 'SPLINE_DELETED'
  | 'SPLINE_DISCONNECTED'
  | 'UNDO';
export type RcaAuditIntent = 'MULTI_DELETED' | 'REDO' | 'SPLINE_DELETED' | 'UNDO';

export interface RcaActivityLog {
  action: RcaActivityLogAction;
  actor: RcaUserSummary;
  createdAtIso: string | null;
  id: string;
  incidentId: string;
  labelSnapshot: string;
  nextValue: string;
  nodeId: string;
  nodeType: RcaNodeType;
  previousValue: string;
  sessionId: string;
  summary: string;
  tenantId: string;
}

export interface RcaNodeTree extends RcaNode {
  children: RcaNodeTree[];
}

export interface RcaIncidentInput {
  assetId?: string;
  riskFactors?: Partial<RcaRiskFactors>;
  sourceRailsDisplayId?: string;
  sourceRailsItemId?: string;
  title?: string;
}

export interface RcaIncidentUpdateInput {
  title?: string;
}

export interface RcaSessionInput {
  methodology?: RcaMethodology;
  status?: RcaSessionStatus;
}

export interface RcaNodeInput {
  auditIntent?: RcaAuditIntent;
  attachedEvidence?: RcaAttachedEvidence[];
  connectionHandles?: RcaNodeConnectionHandles;
  dimensions?: RcaNodeDimensions;
  detailFields?: Record<string, string>;
  edgeStyle?: RcaNodeEdgeStyle;
  isRootCause?: boolean;
  isSuspectedCause?: boolean;
  fiveWhysRole?: RcaFiveWhysNodeRole | null;
  label?: string;
  lockForEditing?: boolean;
  nodeType?: RcaNodeType;
  parentNodeId?: string | null;
  releaseLock?: boolean;
  status?: 'ACTIVE';
  uiCoordinates?: Partial<RcaUiCoordinates>;
  visualStyle?: RcaNodeVisualStyle;
  whyChain?: string[];
}

export interface RcaWorkspaceResponse {
  context: RcaWorkspaceContext;
  incidents: RcaIncident[];
  summary: {
    activeInvestigations: number;
    averageRpn: number;
    closedInvestigations: number;
    criticalIncidents: number;
  };
}

export interface RcaKnowledgeAskInput {
  incidentId?: string;
  question: string;
  sessionId?: string;
}

export interface RcaActivityLogInput {
  action: RcaActivityLogAction;
  nextValue?: string;
  previousValue?: string;
  summary?: string;
}

export interface RcaKnowledgeAskResponse {
  answer: string;
  model: string;
  source: 'AI' | 'SYSTEM_GUIDE';
}

export async function listRcaIncidents(): Promise<RcaWorkspaceResponse> {
  return requestRcaJson<RcaWorkspaceResponse>('/api/rca/incidents');
}

export async function askRcaKnowledgeBase(input: RcaKnowledgeAskInput): Promise<RcaKnowledgeAskResponse> {
  return requestRcaJson('/api/rca/knowledge/ask', {
    body: JSON.stringify(stripUndefinedValues(input)),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  }, {
    timeoutMessage: 'RCA AI guidance took too long to respond. Please try again.',
    timeoutMs: 45_000
  });
}

export async function createRcaIncident(input: RcaIncidentInput): Promise<{
  incident: RcaIncident;
  session: RcaSession | null;
}> {
  return requestRcaJson('/api/rca/incidents', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });
}

export async function updateRcaIncident(
  incidentId: string,
  input: RcaIncidentUpdateInput
): Promise<RcaIncident> {
  const body = await requestRcaJson<{ incident?: RcaIncident }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PATCH'
    }
  );

  if (!body.incident) {
    throw new Error('RCA incident could not be updated.');
  }

  return body.incident;
}

export async function listRcaCollaboratorCandidates(incidentId: string): Promise<{ users: RcaUserSummary[] }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/collaborators/candidates`
  );
}

export async function inviteRcaCollaborators(
  incidentId: string,
  userIds: string[]
): Promise<{ incident: RcaIncident; invitedUsers: RcaUserSummary[] }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/collaborators/invite`,
    {
      body: JSON.stringify({ userIds }),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );
}

export async function removeRcaCollaborator(
  incidentId: string,
  userId: string
): Promise<{ incident: RcaIncident; removedAtIso: string; removedUser: RcaUserSummary }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/collaborators/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE'
    }
  );
}

export async function getRcaAuthenticatedObjectUrl(pathOrUrl: string): Promise<string> {
  const blob = await requestRcaBlob(normalizeApiPath(pathOrUrl));

  return URL.createObjectURL(blob);
}

export async function uploadRcaEvidenceFile(
  incidentId: string,
  sessionId: string,
  input: {
    contentType: string;
    dataUrl: string;
    fileHash?: string;
    fileName: string;
  }
): Promise<RcaAttachedEvidence> {
  const body = await requestRcaJson<{ evidence?: RcaAttachedEvidence }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/evidence`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );

  if (!body.evidence) {
    throw new Error('RCA evidence could not be uploaded.');
  }

  return body.evidence;
}

export async function downloadRcaEvidenceBlob(
  incidentId: string,
  sessionId: string,
  evidenceUrl: string
): Promise<Blob> {
  const evidenceId = getRcaEvidenceId(evidenceUrl);

  return requestRcaBlob(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/evidence/${encodeURIComponent(evidenceId)}`
  );
}

export async function deleteRcaIncident(incidentId: string): Promise<void> {
  await requestRcaJson<void>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}`,
    { method: 'DELETE' }
  );
}

export async function listRcaSessions(incidentId: string): Promise<{ sessions: RcaSession[] }> {
  return requestRcaJson(`/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions`);
}

export async function createRcaSession(incidentId: string, input: RcaSessionInput = {}): Promise<RcaSession> {
  const body = await requestRcaJson<{ session?: RcaSession }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );

  if (!body.session) {
    throw new Error('RCA session could not be created.');
  }

  return body.session;
}

export async function updateRcaSession(
  incidentId: string,
  sessionId: string,
  input: RcaSessionInput
): Promise<RcaSession> {
  const body = await requestRcaJson<{ session?: RcaSession }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PATCH'
    }
  );

  if (!body.session) {
    throw new Error('RCA session could not be updated.');
  }

  return body.session;
}

export async function listRcaNodes(
  incidentId: string,
  sessionId: string
): Promise<{ nodes: RcaNode[] }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/nodes`
  );
}

export async function listRcaActivityLogs(
  incidentId: string,
  sessionId: string
): Promise<{ logs: RcaActivityLog[] }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/activity-logs`
  );
}

export async function recordRcaActivityLog(
  incidentId: string,
  sessionId: string,
  input: RcaActivityLogInput
): Promise<{ log: RcaActivityLog }> {
  return requestRcaJson(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/activity-logs`,
    {
      body: JSON.stringify(stripUndefinedValues(input)),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );
}

export async function createRcaNode(
  incidentId: string,
  sessionId: string,
  input: RcaNodeInput = {}
): Promise<RcaNode> {
  const body = await requestRcaJson<{ node?: RcaNode }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/nodes`,
    {
      body: JSON.stringify(stripUndefinedValues(input)),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );

  if (!body.node) {
    throw new Error('RCA node could not be created.');
  }

  return body.node;
}

export async function updateRcaNode(
  incidentId: string,
  sessionId: string,
  nodeId: string,
  input: RcaNodeInput
): Promise<RcaNode> {
  const body = await requestRcaJson<{ node?: RcaNode }>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}`,
    {
      body: JSON.stringify(stripUndefinedValues(input)),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PATCH'
    }
  );

  if (!body.node) {
    throw new Error('RCA node could not be updated.');
  }

  return body.node;
}

export async function deleteRcaNode(
  incidentId: string,
  sessionId: string,
  nodeId: string
): Promise<void> {
  await requestRcaJson<void>(
    `/api/rca/incidents/${encodeURIComponent(incidentId)}/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}`,
    { method: 'DELETE' }
  );
}

export function buildRcaNodeTree(nodes: RcaNode[]): RcaNodeTree[] {
  const nodeMap = new Map<string, RcaNodeTree>();
  const roots: RcaNodeTree[] = [];

  nodes.forEach((node) => {
    nodeMap.set(node.id, {
      ...node,
      children: []
    });
  });

  nodeMap.forEach((node) => {
    if (node.parentNodeId && nodeMap.has(node.parentNodeId)) {
      nodeMap.get(node.parentNodeId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

async function requestRcaJson<T>(
  path: string,
  options: RequestInit = {},
  requestOptions: {
    timeoutMessage?: string;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestOptions.timeoutMs || 15_000);
  let response: Response;

  try {
    response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...options.headers,
        ...await getAppCheckHeader()
      },
      method: options.method || 'GET',
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(requestOptions.timeoutMessage || 'The RCA workspace took too long to load. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'The RCA workspace could not be loaded.'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
  ) as T;
}

async function requestRcaBlob(
  path: string,
  options: RequestInit = {}
): Promise<Blob> {
  const user = getSynzappFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('You are not signed in.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${getSynzappApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
      ...await getAppCheckHeader()
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'RCA asset could not be loaded.'));
  }

  return response.blob();
}

function normalizeApiPath(pathOrUrl: string): string {
  if (!/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  }

  const apiBaseUrl = getSynzappApiBaseUrl();

  if (!pathOrUrl.startsWith(apiBaseUrl)) {
    throw new Error('RCA asset is not available from this workspace.');
  }

  return pathOrUrl.slice(apiBaseUrl.length) || '/';
}

function getRcaEvidenceId(evidenceUrl: string): string {
  const match = /^rca-evidence:\/\/(ev_[A-Fa-f0-9]{32})$/.exec(evidenceUrl.trim());

  if (!match) {
    throw new Error('RCA evidence is not available from this workspace.');
  }

  return match[1];
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
