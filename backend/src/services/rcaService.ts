import { randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fieldValue, firestore, storageBucket } from '../config/firebaseAdmin.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import {
  HUMAN_RESOURCES_DEPARTMENT_ID,
  HUMAN_RESOURCES_DEPARTMENT_NAME
} from './tenantDefaults.js';

type FirestoreDateLike = FirebaseFirestore.Timestamp | { seconds?: number; toDate?: () => Date } | string | null | undefined;

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

export interface RcaEvidenceUploadInput {
  contentType: string;
  dataUrl: string;
  fileHash?: string;
  fileName: string;
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

export interface RcaUserSummary {
  departmentName: string | null;
  displayName: string;
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  roleName: string;
  uid: string;
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
  nodeId: string;
  nodeType: RcaNodeType;
  nextValue: string;
  previousValue: string;
  sessionId: string;
  summary: string;
  tenantId: string;
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
    role: SynzappRole;
    roleName: string;
    uid: string;
  };
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

export interface RcaActivityLogInput {
  action: RcaActivityLogAction;
  nextValue?: string;
  previousValue?: string;
  summary?: string;
}

interface OrganizationRecord {
  companyName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoContentType?: string | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface TenantDepartmentRecord {
  departmentId?: string;
  name?: string;
  status?: string;
  tenantId?: string;
}

interface AuthorizedRcaContext {
  department: RcaWorkspaceContext['department'];
  organization: OrganizationRecord;
  organizationRef: FirebaseFirestore.DocumentReference;
  role: SynzappRole;
  tenantId: string;
  user: TenantUserRecord;
  uid: string;
}

interface RcaIncidentRecord {
  activeSessionId?: string | null;
  assetId?: string;
  companyId?: string;
  createdAt?: FirestoreDateLike;
  createdAtIso?: string;
  createdByUid?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  displayId?: string;
  participantUids?: string[];
  riskFactors?: Partial<RcaRiskFactors>;
  rpnScore?: number;
  sourceRailsDisplayId?: string | null;
  sourceRailsItemId?: string | null;
  status?: RcaIncidentStatus | 'DELETED';
  tenantId?: string;
  title?: string;
  updatedAt?: FirestoreDateLike;
  updatedAtIso?: string;
}

interface RcaProfilePhoto {
  cacheKey: string;
  contentType: string;
  file: ReturnType<typeof storageBucket.file>;
}

interface RcaEvidenceFile {
  contentType: string;
  fileName: string;
  payload: Buffer;
}

interface RcaSessionRecord {
  closedAt?: FirestoreDateLike;
  closedAtIso?: string | null;
  createdAt?: FirestoreDateLike;
  createdAtIso?: string;
  incidentId?: string;
  leadInvestigatorId?: string;
  methodology?: RcaMethodology;
  status?: RcaSessionStatus;
  tenantId?: string;
  updatedAt?: FirestoreDateLike;
  updatedAtIso?: string;
}

interface RcaNodeRecord {
  attachedEvidence?: RcaAttachedEvidence[];
  connectionHandles?: RcaNodeConnectionHandles;
  createdAt?: FirestoreDateLike;
  createdAtIso?: string;
  createdByDepartmentName?: string | null;
  createdByDisplayName?: string;
  createdByProfilePhotoVersion?: number | null;
  createdByRoleName?: string;
  createdByUid?: string;
  detailFields?: Record<string, string>;
  dimensions?: RcaNodeDimensions;
  isRootCause?: boolean;
  isSuspectedCause?: boolean;
  label?: string;
  lockedAt?: FirestoreDateLike;
  lockedAtIso?: string | null;
  lockedBy?: string | null;
  nodeType?: RcaNodeType;
  parentNodeId?: string | null;
  status?: 'ACTIVE' | 'DELETED';
  tenantId?: string;
  uiCoordinates?: Partial<RcaUiCoordinates>;
  updatedAt?: FirestoreDateLike;
  updatedAtIso?: string;
  edgeStyle?: RcaNodeEdgeStyle;
  fiveWhysRole?: RcaFiveWhysNodeRole | null;
  visualStyle?: RcaNodeVisualStyle;
  whyChain?: string[];
}

interface RcaActivityLogRecord {
  action?: RcaActivityLogAction;
  actorUid?: string;
  createdAt?: FirestoreDateLike;
  createdAtIso?: string;
  incidentId?: string;
  labelSnapshot?: string;
  nextValue?: string;
  nodeId?: string;
  nodeType?: RcaNodeType;
  previousValue?: string;
  sessionId?: string;
  summary?: string;
  tenantId?: string;
}

const RCA_INCIDENTS_COLLECTION = 'rcaIncidents';
const RCA_SESSIONS_COLLECTION = 'rcaSessions';
const RCA_NODES_COLLECTION = 'nodes';
const RCA_ACTIVITY_LOGS_COLLECTION = 'activityLogs';
const RCA_NODE_FONT_FAMILIES = new Set([
  'Inter',
  'Calibri',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New'
]);
const RCA_NODE_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18];
const RCA_SPLINE_LINE_TYPES = new Set<RcaSplineLineType>(['CONTINUOUS', 'DASHED', 'DOTTED']);
const RCA_SPLINE_ARROW_HEADS = new Set<RcaSplineArrowHead>(['OPEN', 'CLOSED', 'CLOSED_FILLED']);
const RCA_SPLINE_WEIGHTS = [1.5, 2, 2.4, 3, 4, 5];
const RCA_RPN_THRESHOLD = 25;
const MAX_RCA_INCIDENTS = 100;
const MAX_RCA_NODES = 300;
const MAX_RCA_ACTIVITY_LOGS = 100;
const MAX_RCA_EVIDENCE_BYTES = 4 * 1024 * 1024;
const RCA_CANVAS_COORDINATE_LIMIT = 20000;
const RCA_SYSTEM_MANAGED_DETAIL_FIELD_KEYS: Partial<Record<RcaFiveWhysNodeRole, string[]>> = {
  APPROVAL_CLOSURE: ['closureReviewId'],
  CAPA: ['capaId'],
  EFFECTIVENESS: ['verificationId'],
  INCIDENT: ['incidentId'],
  RISK_ASSESSMENT: ['riskAssessmentId']
};

export async function getRcaWorkspaceContext(decodedToken: DecodedIdToken): Promise<RcaWorkspaceContext> {
  const context = await getAuthorizedRcaContext(decodedToken);

  return mapWorkspaceContext(context);
}

export async function listRcaIncidents(decodedToken: DecodedIdToken): Promise<{
  context: RcaWorkspaceContext;
  incidents: RcaIncident[];
  summary: {
    activeInvestigations: number;
    averageRpn: number;
    closedInvestigations: number;
    criticalIncidents: number;
  };
}> {
  const context = await getAuthorizedRcaContext(decodedToken);
  const incidentDocs = await listAccessibleIncidentDocs(context);
  const ownerByUid = await getRcaUserSummariesByUid(
    context,
    [...new Set(incidentDocs.flatMap((doc) => {
      const record = doc.data() as RcaIncidentRecord;

      return [
        record.createdByUid || '',
        ...(Array.isArray(record.participantUids) ? record.participantUids : [])
      ];
    }).filter(Boolean))]
  );
  const incidents = incidentDocs
    .map((doc) => ({
      id: doc.id,
      record: doc.data() as RcaIncidentRecord
    }))
    .filter(({ record }) => record.status !== 'DELETED')
    .map(({ id, record }) => mapIncident(id, record, context, ownerByUid));

  return {
    context: mapWorkspaceContext(context),
    incidents,
    summary: buildIncidentSummary(incidents)
  };
}

export async function getRcaIncident(
  decodedToken: DecodedIdToken,
  incidentId: string
): Promise<RcaIncident> {
  const { context, incidentRecord, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);
  const ownerByUid = await getRcaUserSummariesByUid(
    context,
    [
      incidentRecord.createdByUid || '',
      ...(Array.isArray(incidentRecord.participantUids) ? incidentRecord.participantUids : [])
    ].filter(Boolean)
  );

  return mapIncident(incidentRef.id, incidentRecord, context, ownerByUid);
}

export async function createRcaIncident(
  decodedToken: DecodedIdToken,
  input: RcaIncidentInput = {}
): Promise<{ incident: RcaIncident; session: RcaSession | null }> {
  const context = await getAuthorizedRcaContext(decodedToken);
  const incidentRef = context.organizationRef.collection(RCA_INCIDENTS_COLLECTION).doc();
  const sessionRef = incidentRef.collection(RCA_SESSIONS_COLLECTION).doc();
  const nowIso = new Date().toISOString();
  const riskFactors = normalizeRiskFactors(input.riskFactors);
  const rpnScore = calculateRpn(riskFactors);
  const shouldOpenSession = rpnScore >= RCA_RPN_THRESHOLD;
  const incidentRecord: RcaIncidentRecord = {
    activeSessionId: shouldOpenSession ? sessionRef.id : null,
    assetId: normalizeText(input.assetId, 'Unassigned asset', 120),
    companyId: context.tenantId,
    createdAtIso: nowIso,
    createdByUid: decodedToken.uid,
    departmentId: context.department.departmentId,
    departmentName: context.department.name,
    displayId: buildRcaDisplayId('RCA', incidentRef.id, nowIso),
    participantUids: [],
    riskFactors,
    rpnScore,
    sourceRailsDisplayId: normalizeText(input.sourceRailsDisplayId, '', 80) || null,
    sourceRailsItemId: normalizeText(input.sourceRailsItemId, '', 128) || null,
    status: shouldOpenSession ? 'INVESTIGATING' : 'OPEN',
    tenantId: context.tenantId,
    title: normalizeText(input.title, 'New RCA incident', 180),
    updatedAtIso: nowIso
  };
  const batch = firestore.batch();

  batch.set(incidentRef, {
    ...incidentRecord,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  let sessionRecord: RcaSessionRecord | null = null;

  if (shouldOpenSession) {
    sessionRecord = buildSessionRecord(context, incidentRef.id, nowIso, {
      leadInvestigatorId: decodedToken.uid,
      methodology: 'ISHIKAWA',
      status: 'ACTIVE'
    });
    batch.set(sessionRef, {
      ...sessionRecord,
      createdAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  return {
    incident: mapIncident(incidentRef.id, incidentRecord, context, new Map([[context.uid, buildRcaUserSummary(context.uid, context.user)]])),
    session: sessionRecord ? mapSession(sessionRef.id, sessionRecord) : null
  };
}

export async function listRcaCollaboratorCandidates(
  decodedToken: DecodedIdToken,
  incidentId: string
): Promise<{ users: RcaUserSummary[] }> {
  const { context, incidentRecord } = await getAuthorizedIncident(decodedToken, incidentId);

  assertRcaIncidentOwner(context, incidentRecord);

  const participantIds = new Set([
    incidentRecord.createdByUid,
    ...(Array.isArray(incidentRecord.participantUids) ? incidentRecord.participantUids : [])
  ].filter((uid): uid is string => Boolean(uid)));
  const snapshot = await context.organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .get();
  const users = snapshot.docs
    .filter((doc) => {
      const user = doc.data() as TenantUserRecord;

      return doc.id !== context.uid &&
        !participantIds.has(doc.id) &&
        user.tenantId === context.tenantId &&
        user.status === 'ACTIVE';
    })
    .map((doc) => buildRcaUserSummary(doc.id, doc.data() as TenantUserRecord))
    .sort((first, second) => first.displayName.localeCompare(second.displayName));

  return { users };
}

export async function inviteRcaCollaborators(
  decodedToken: DecodedIdToken,
  incidentId: string,
  userIds: string[]
): Promise<{ incident: RcaIncident; invitedUsers: RcaUserSummary[] }> {
  const { context, incidentRecord, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);

  assertRcaIncidentOwner(context, incidentRecord);

  const candidateIds = [...new Set(userIds.map(safeId))]
    .filter((uid) => uid && uid !== context.uid && uid !== incidentRecord.createdByUid)
    .slice(0, 50);

  if (!candidateIds.length) {
    throw validationError('Select at least one collaborator to invite.');
  }

  const existingParticipantUids = Array.isArray(incidentRecord.participantUids) ? incidentRecord.participantUids : [];
  const nextParticipantUids = [...new Set([...existingParticipantUids, ...candidateIds])];
  const usersByUid = await getRcaUserSummariesByUid(context, [
    incidentRecord.createdByUid || '',
    ...nextParticipantUids
  ]);
  const invitedUsers = candidateIds
    .map((uid) => usersByUid.get(uid) || null)
    .filter((user): user is RcaUserSummary => Boolean(user));

  if (invitedUsers.length !== candidateIds.length) {
    throw validationError('One selected collaborator is not active in this company.');
  }

  const nowIso = new Date().toISOString();
  await incidentRef.set({
    participantUids: fieldValue.arrayUnion(...candidateIds),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });

  return {
    incident: mapIncident(
      incidentRef.id,
      {
        ...incidentRecord,
        participantUids: nextParticipantUids,
        updatedAtIso: nowIso
      },
      context,
      usersByUid
    ),
    invitedUsers
  };
}

export async function removeRcaCollaborator(
  decodedToken: DecodedIdToken,
  incidentId: string,
  userId: string
): Promise<{ incident: RcaIncident; removedAtIso: string; removedUser: RcaUserSummary }> {
  const { context, incidentRecord, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);

  assertRcaIncidentOwner(context, incidentRecord);

  const safeUserId = safeId(userId);
  const participantUids = Array.isArray(incidentRecord.participantUids)
    ? [...new Set(incidentRecord.participantUids.map(safeId).filter(Boolean))]
    : [];

  if (!safeUserId || safeUserId === context.uid || safeUserId === incidentRecord.createdByUid) {
    throw validationError('Select an invited collaborator to remove.');
  }

  if (!participantUids.includes(safeUserId)) {
    throw notFoundError('This collaborator is not invited to this RCA project.');
  }

  const usersByUid = await getRcaUserSummariesByUid(context, [
    incidentRecord.createdByUid || '',
    ...participantUids
  ]);
  const removedUser = usersByUid.get(safeUserId);

  if (!removedUser) {
    throw notFoundError('This collaborator profile was not found.');
  }

  const removedAtIso = new Date().toISOString();
  const remainingParticipantUids = participantUids.filter((uid) => uid !== safeUserId);

  await incidentRef.set({
    participantUids: fieldValue.arrayRemove(safeUserId),
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: removedAtIso
  }, { merge: true });

  return {
    incident: mapIncident(
      incidentRef.id,
      {
        ...incidentRecord,
        participantUids: remainingParticipantUids,
        updatedAtIso: removedAtIso
      },
      context,
      usersByUid
    ),
    removedAtIso,
    removedUser
  };
}

export async function getRcaUserProfilePhoto(
  decodedToken: DecodedIdToken,
  uid: string
): Promise<RcaProfilePhoto> {
  const context = await getAuthorizedRcaContext(decodedToken);
  const safeUid = safeId(uid);
  const userSnapshot = await context.organizationRef.collection('users').doc(safeUid).get();

  if (!userSnapshot.exists) {
    throw notFoundError('Profile photo was not found.');
  }

  const user = userSnapshot.data() as TenantUserRecord;

  if (
    user.tenantId !== context.tenantId ||
    user.status !== 'ACTIVE' ||
    !user.profilePhotoStoragePath
  ) {
    throw notFoundError('Profile photo was not found.');
  }

  const file = storageBucket.file(user.profilePhotoStoragePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw notFoundError('Profile photo was not found.');
  }

  return {
    cacheKey: buildRcaProfilePhotoCacheKey(safeUid, user.profilePhotoVersion),
    contentType: user.profilePhotoContentType || 'image/jpeg',
    file
  };
}

export async function uploadRcaEvidenceFile(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  input: RcaEvidenceUploadInput
): Promise<RcaAttachedEvidence> {
  const { context, incidentRef, sessionRecord, sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);

  assertSessionIsEditable(sessionRecord);

  const parsedUpload = parseRcaEvidenceDataUrl(input.dataUrl, input.contentType);
  const evidenceId = `ev_${randomUUID().replace(/-/g, '')}`;
  const storagePath = getRcaEvidenceStoragePath(context.tenantId, incidentRef.id, sessionRef.id, evidenceId);
  const fileName = sanitizeRcaEvidenceFileName(input.fileName);
  const nowIso = new Date().toISOString();

  try {
    await storageBucket.file(storagePath).save(parsedUpload.payload, {
      contentType: parsedUpload.contentType,
      metadata: {
        cacheControl: 'private, max-age=3600',
        metadata: {
          evidenceId,
          fileName,
          incidentId: incidentRef.id,
          sessionId: sessionRef.id,
          tenantId: context.tenantId,
          uploadedAtIso: nowIso,
          uploadedByUid: context.uid
        }
      },
      resumable: false
    });
  } catch (error) {
    if (isMissingStorageBucketError(error)) {
      throw validationError('RCA evidence storage is not ready yet. Please try again later.');
    }

    throw error;
  }

  return {
    fileHash: normalizeText(input.fileHash, evidenceId, 128),
    fileName,
    fileUrl: `rca-evidence://${evidenceId}`,
    uploadedAtIso: nowIso
  };
}

export async function getRcaEvidenceFile(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  evidenceId: string
): Promise<RcaEvidenceFile> {
  const { context, incidentRef, sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);
  const safeEvidenceId = normalizeRcaEvidenceId(evidenceId);
  const storagePath = getRcaEvidenceStoragePath(context.tenantId, incidentRef.id, sessionRef.id, safeEvidenceId);
  const file = storageBucket.file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw notFoundError('This RCA evidence file was not found.');
  }

  const [metadata] = await file.getMetadata();
  const [payload] = await file.download();

  return {
    contentType: normalizeEvidenceContentType(String(metadata.contentType || 'application/octet-stream')),
    fileName: sanitizeRcaEvidenceFileName(String(metadata.metadata?.fileName || 'evidence')),
    payload
  };
}

export async function updateRcaIncident(
  decodedToken: DecodedIdToken,
  incidentId: string,
  input: RcaIncidentUpdateInput
): Promise<RcaIncident> {
  const { context, incidentRecord, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  if (input.title !== undefined) {
    update.title = normalizeText(input.title, 'Untitled RCA incident', 180);
  }

  await incidentRef.set(update, { merge: true });

  return mapIncident(incidentRef.id, {
    ...incidentRecord,
    ...update,
    updatedAtIso: nowIso
  } as RcaIncidentRecord, context, await getRcaUserSummariesByUid(context, [
    incidentRecord.createdByUid || '',
    ...(Array.isArray(incidentRecord.participantUids) ? incidentRecord.participantUids : [])
  ]));
}

export async function deleteRcaIncident(
  decodedToken: DecodedIdToken,
  incidentId: string
): Promise<{ deletedAtIso: string; incident: RcaIncident }> {
  const { context, incidentRecord, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);

  assertRcaIncidentOwner(context, incidentRecord);

  const participantUids = Array.isArray(incidentRecord.participantUids) ? incidentRecord.participantUids : [];
  const usersByUid = await getRcaUserSummariesByUid(context, [
    incidentRecord.createdByUid || '',
    ...participantUids
  ]);
  const deletedAtIso = new Date().toISOString();

  await incidentRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: deletedAtIso
  }, { merge: true });

  return {
    deletedAtIso,
    incident: mapIncident(
      incidentRef.id,
      {
        ...incidentRecord,
        updatedAtIso: deletedAtIso
      },
      context,
      usersByUid
    )
  };
}

export async function listRcaSessions(
  decodedToken: DecodedIdToken,
  incidentId: string
): Promise<{ sessions: RcaSession[] }> {
  const { context, incidentRef } = await getAuthorizedIncident(decodedToken, incidentId);
  const snapshot = await incidentRef
    .collection(RCA_SESSIONS_COLLECTION)
    .orderBy('createdAtIso', 'desc')
    .get();
  const sessions = snapshot.docs
    .map((doc) => mapSession(doc.id, doc.data() as RcaSessionRecord))
    .filter((session) => session.incidentId === incidentRef.id);

  void context;
  return { sessions };
}

export async function createRcaSession(
  decodedToken: DecodedIdToken,
  incidentId: string,
  input: RcaSessionInput = {}
): Promise<RcaSession> {
  const { context, incidentRef, incidentRecord } = await getAuthorizedIncident(decodedToken, incidentId);

  if (incidentRecord.status === 'CLOSED') {
    throw validationError('Closed incidents cannot receive a new RCA session.');
  }

  const sessionRef = incidentRef.collection(RCA_SESSIONS_COLLECTION).doc();
  const nowIso = new Date().toISOString();
  const record = buildSessionRecord(context, incidentRef.id, nowIso, {
    leadInvestigatorId: decodedToken.uid,
    methodology: input.methodology || 'ISHIKAWA',
    status: input.status || 'ACTIVE'
  });
  const batch = firestore.batch();

  batch.set(sessionRef, {
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });
  batch.set(incidentRef, {
    activeSessionId: sessionRef.id,
    status: 'INVESTIGATING',
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  }, { merge: true });

  await batch.commit();

  return mapSession(sessionRef.id, record);
}

export async function updateRcaSession(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  input: RcaSessionInput
): Promise<RcaSession> {
  const { sessionRef, sessionRecord } = await getAuthorizedSession(decodedToken, incidentId, sessionId);
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  if (input.methodology !== undefined) {
    update.methodology = normalizeMethodology(input.methodology);
  }

  if (input.status !== undefined) {
    update.status = normalizeSessionStatus(input.status);

    if (input.status === 'CLOSED') {
      update.closedAt = fieldValue.serverTimestamp();
      update.closedAtIso = nowIso;
    }
  }

  await sessionRef.set(update, { merge: true });

  return mapSession(sessionRef.id, {
    ...sessionRecord,
    ...update,
    updatedAtIso: nowIso
  } as RcaSessionRecord);
}

export async function listRcaNodes(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string
): Promise<{ nodes: RcaNode[] }> {
  const { sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);
  const snapshot = await sessionRef
    .collection(RCA_NODES_COLLECTION)
    .orderBy('createdAtIso', 'asc')
    .limit(MAX_RCA_NODES)
    .get();
  const nodes = snapshot.docs
    .map((doc) => mapNode(doc.id, doc.data() as RcaNodeRecord))
    .filter((node) => node.status === 'ACTIVE');

  return { nodes };
}

export async function listRcaActivityLogs(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string
): Promise<{ logs: RcaActivityLog[] }> {
  const { context, sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);
  const snapshot = await sessionRef
    .collection(RCA_ACTIVITY_LOGS_COLLECTION)
    .orderBy('createdAtIso', 'desc')
    .limit(MAX_RCA_ACTIVITY_LOGS)
    .get();
  const actorIds = [...new Set(snapshot.docs
    .map((doc) => (doc.data() as RcaActivityLogRecord).actorUid || '')
    .filter(Boolean))];
  const actorsByUid = await getRcaUserSummariesByUid(context, actorIds);
  const logs = snapshot.docs
    .map((doc) => mapActivityLog(doc.id, doc.data() as RcaActivityLogRecord, context, actorsByUid))
    .filter((log) => log.incidentId === incidentId && log.sessionId === sessionId);

  return { logs };
}

export async function recordRcaActivityLog(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  input: RcaActivityLogInput
): Promise<RcaActivityLog> {
  const { context, sessionRef, sessionRecord } = await getAuthorizedSession(decodedToken, incidentId, sessionId);

  assertSessionIsEditable(sessionRecord);

  const auditNode: RcaNode = {
    attachedEvidence: [],
    createdAtIso: null,
    id: '',
    isRootCause: false,
    isSuspectedCause: false,
    label: '',
    lockedAtIso: null,
    lockedBy: null,
    nodeType: 'CAUSE',
    parentNodeId: null,
    status: 'ACTIVE',
    uiCoordinates: {
      layoutMethodology: normalizeMethodology(sessionRecord.methodology || 'ISHIKAWA'),
      x: 0,
      y: 0
    },
    updatedAtIso: null,
    whyChain: []
  };

  return createRcaActivityLog(context, sessionRef, {
    action: input.action,
    incidentId,
    nextValue: normalizeText(input.nextValue, '', 8000),
    node: auditNode,
    previousValue: normalizeText(input.previousValue, '', 8000),
    sessionId,
    summary: normalizeText(input.summary, buildActivityLogSummary(input.action, auditNode), 1200)
  });
}

export async function createRcaNode(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  input: RcaNodeInput = {}
): Promise<RcaNode> {
  const { context, incidentRecord, incidentRef, sessionRef, sessionRecord } = await getAuthorizedSession(decodedToken, incidentId, sessionId);

  assertSessionIsEditable(sessionRecord);

  const nodeRef = sessionRef.collection(RCA_NODES_COLLECTION).doc();
  const nowIso = new Date().toISOString();
  const nodeCountSnapshot = await sessionRef.collection(RCA_NODES_COLLECTION).count().get();
  const nodeIndex = nodeCountSnapshot.data().count;
  const methodology = normalizeMethodology(input.uiCoordinates?.layoutMethodology || sessionRecord.methodology || 'ISHIKAWA');
  const attachedEvidence = normalizeAttachedEvidence(input.attachedEvidence);
  const whyChain = normalizeWhyChain(input.whyChain);
  const nodeType = normalizeNodeType(input.nodeType || (methodology === '5_WHYS' ? 'WHY' : 'CAUSE'));
  const fiveWhysRole = nodeType === 'WHY' ? normalizeFiveWhysRole(input.fiveWhysRole) : null;
  const detailFields = normalizeSystemManagedNodeDetailFields(
    fiveWhysRole,
    normalizeNodeDetailFields(input.detailFields),
    incidentRef.id,
    incidentRecord
  );

  await assertIncidentNodeCreateOrder(sessionRef, nodeType, fiveWhysRole);

  const dimensions = nodeType === 'STICKY_NOTE'
    ? normalizeNodeDimensions(input.dimensions)
    : undefined;
  const record: RcaNodeRecord = {
    attachedEvidence,
    connectionHandles: normalizeNodeConnectionHandles(input.connectionHandles),
    createdAtIso: nowIso,
    createdByDepartmentName: context.department.name,
    createdByDisplayName: mapWorkspaceContext(context).user.displayName,
    createdByRoleName: mapWorkspaceContext(context).user.roleName,
    createdByUid: context.uid,
    detailFields,
    edgeStyle: normalizeEdgeStyle(input.edgeStyle),
    fiveWhysRole,
    isRootCause: Boolean(input.isRootCause),
    isSuspectedCause: input.isSuspectedCause === undefined
      ? Boolean(input.isRootCause || whyChain.length)
      : Boolean(input.isSuspectedCause || input.isRootCause),
    label: normalizeText(input.label, '', 240),
    lockedAtIso: null,
    lockedBy: null,
    nodeType,
    parentNodeId: normalizeOptionalId(input.parentNodeId),
    status: 'ACTIVE',
    tenantId: context.tenantId,
    uiCoordinates: normalizeCoordinates(input.uiCoordinates, methodology, nodeIndex),
    updatedAtIso: nowIso,
    visualStyle: normalizeVisualStyle(input.visualStyle),
    whyChain
  };

  if (dimensions) {
    record.dimensions = dimensions;
  }

  if (record.isRootCause) {
    assertRootCauseReady(attachedEvidence, whyChain);
  }

  await nodeRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp()
  });

  const node = mapNode(nodeRef.id, record);

  await createRcaActivityLog(context, sessionRef, {
    action: 'NODE_CREATED',
    incidentId,
    node,
    nextValue: `${formatNodeType(node.nodeType)}: ${node.label || 'Untitled node'}`,
    sessionId
  });

  return node;
}

export async function updateRcaNode(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  nodeId: string,
  input: RcaNodeInput
): Promise<RcaNode> {
  const { context, incidentRecord, incidentRef, sessionRecord, sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);

  assertSessionIsEditable(sessionRecord);

  const nodeRef = sessionRef.collection(RCA_NODES_COLLECTION).doc(nodeId);
  const snapshot = await nodeRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This RCA node was not found.');
  }

  const existingRecord = snapshot.data() as RcaNodeRecord;

  if (existingRecord.tenantId && existingRecord.tenantId !== sessionRecord.tenantId) {
    throw authorizationError('This RCA node is not available.');
  }

  if (existingRecord.status && existingRecord.status !== 'ACTIVE' && input.status !== 'ACTIVE') {
    throw notFoundError('This RCA node was not found.');
  }

  if (existingRecord.lockedBy && existingRecord.lockedBy !== decodedToken.uid && !input.releaseLock) {
    throw validationError('This RCA node is currently being edited by another user.');
  }

  const nowIso = new Date().toISOString();
  const nextNodeType = input.nodeType !== undefined
    ? normalizeNodeType(input.nodeType)
    : normalizeNodeType(existingRecord.nodeType || 'WHY');
  const nextFiveWhysRole = nextNodeType === 'WHY'
    ? normalizeFiveWhysRole(input.fiveWhysRole ?? existingRecord.fiveWhysRole)
    : null;
  const update: Record<string, unknown> = {
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  if (input.label !== undefined) {
    update.label = normalizeText(input.label, '', 240);
  }

  if (input.nodeType !== undefined) {
    update.nodeType = nextNodeType;
  }

  if (input.fiveWhysRole !== undefined || input.nodeType !== undefined) {
    update.fiveWhysRole = nextFiveWhysRole;
  }

  if (input.parentNodeId !== undefined) {
    update.parentNodeId = normalizeOptionalId(input.parentNodeId);
  }

  if (input.status === 'ACTIVE') {
    update.status = 'ACTIVE';
    update.deletedAt = null;
    update.deletedByUid = null;
  }

  if (input.attachedEvidence !== undefined) {
    update.attachedEvidence = normalizeAttachedEvidence(input.attachedEvidence);
  }

  if (input.connectionHandles !== undefined) {
    update.connectionHandles = normalizeNodeConnectionHandles(input.connectionHandles);
  }

  if (input.detailFields !== undefined) {
    update.detailFields = normalizeSystemManagedNodeDetailFields(
      nextFiveWhysRole,
      normalizeNodeDetailFields(input.detailFields),
      incidentRef.id,
      incidentRecord,
      existingRecord.detailFields
    );
  }

  if (input.dimensions !== undefined || nextNodeType !== 'STICKY_NOTE') {
    const dimensions = nextNodeType === 'STICKY_NOTE'
      ? normalizeNodeDimensions(input.dimensions)
      : undefined;

    if (dimensions) {
      update.dimensions = dimensions;
    } else {
      update.dimensions = fieldValue.delete();
    }
  }

  if (input.edgeStyle !== undefined) {
    update.edgeStyle = normalizeEdgeStyle(input.edgeStyle);
  }

  if (input.whyChain !== undefined) {
    update.whyChain = normalizeWhyChain(input.whyChain);
  }

  if (input.isSuspectedCause !== undefined) {
    update.isSuspectedCause = Boolean(input.isSuspectedCause);
  }

  if (input.isRootCause !== undefined) {
    const attachedEvidence = input.attachedEvidence !== undefined
      ? update.attachedEvidence as RcaAttachedEvidence[]
      : normalizeAttachedEvidence(existingRecord.attachedEvidence);
    const whyChain = input.whyChain !== undefined
      ? update.whyChain as string[]
      : normalizeWhyChain(existingRecord.whyChain);

    if (input.isRootCause) {
      assertRootCauseReady(attachedEvidence, whyChain);
    }

    update.isRootCause = input.isRootCause;
    if (input.isRootCause) {
      update.isSuspectedCause = true;
    }
  }

  if (input.uiCoordinates !== undefined) {
    update.uiCoordinates = normalizeCoordinates(
      {
        ...existingRecord.uiCoordinates,
        ...input.uiCoordinates
      },
      normalizeMethodology(input.uiCoordinates.layoutMethodology || existingRecord.uiCoordinates?.layoutMethodology || sessionRecord.methodology || 'ISHIKAWA'),
      0
    );
  }

  if (input.visualStyle !== undefined) {
    update.visualStyle = normalizeVisualStyle({
      ...normalizeVisualStyle(existingRecord.visualStyle),
      ...input.visualStyle
    });
  }

  if (input.lockForEditing) {
    update.lockedBy = decodedToken.uid;
    update.lockedAt = fieldValue.serverTimestamp();
    update.lockedAtIso = nowIso;
  }

  if (input.releaseLock) {
    update.lockedBy = null;
    update.lockedAt = null;
    update.lockedAtIso = null;
  }

  await nodeRef.set(update, { merge: true });

  const node = mapNode(nodeRef.id, {
    ...existingRecord,
    ...update,
    updatedAtIso: nowIso
  } as RcaNodeRecord);
  const meaningfulUpdateKeys = Object.keys(update).filter((key) => (
    key !== 'updatedAt' &&
    key !== 'updatedAtIso' &&
    key !== 'lockedAt' &&
    key !== 'lockedAtIso' &&
    key !== 'lockedBy'
  ));

  const nonMovementUpdateKeys = meaningfulUpdateKeys.filter((key) => key !== 'uiCoordinates');

  if (nonMovementUpdateKeys.length) {
    const activityInput = await buildNodeUpdateActivityLogInput(
      sessionRef,
      input.auditIntent,
      existingRecord,
      node,
      nonMovementUpdateKeys
    );

    await createRcaActivityLog(
      context,
      sessionRef,
      {
        ...activityInput,
        incidentId,
        node,
        sessionId
      }
    );
  }

  return node;
}

export async function deleteRcaNode(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string,
  nodeId: string
): Promise<void> {
  const { context, sessionRecord, sessionRef } = await getAuthorizedSession(decodedToken, incidentId, sessionId);

  assertSessionIsEditable(sessionRecord);

  const nodeRef = sessionRef.collection(RCA_NODES_COLLECTION).doc(nodeId);
  const snapshot = await nodeRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This RCA node was not found.');
  }

  const record = snapshot.data() as RcaNodeRecord;

  if (record.tenantId && record.tenantId !== sessionRecord.tenantId) {
    throw authorizationError('This RCA node is not available.');
  }

  const deletedNode = mapNode(nodeRef.id, {
    ...record,
    status: 'DELETED',
    updatedAtIso: new Date().toISOString()
  });

  await nodeRef.set({
    deletedAt: fieldValue.serverTimestamp(),
    deletedByUid: decodedToken.uid,
    status: 'DELETED',
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: deletedNode.updatedAtIso
  }, { merge: true });

  await createRcaActivityLog(
    context,
    sessionRef,
    {
      action: 'NODE_DELETED',
      incidentId,
      node: deletedNode,
      previousValue: deletedNode.label || formatNodeType(deletedNode.nodeType),
      sessionId
    }
  );
}

function buildSessionRecord(
  context: AuthorizedRcaContext,
  incidentId: string,
  nowIso: string,
  input: {
    leadInvestigatorId: string;
    methodology: RcaMethodology;
    status: RcaSessionStatus;
  }
): RcaSessionRecord {
  return {
    closedAtIso: null,
    createdAtIso: nowIso,
    incidentId,
    leadInvestigatorId: input.leadInvestigatorId,
    methodology: normalizeMethodology(input.methodology),
    status: normalizeSessionStatus(input.status),
    tenantId: context.tenantId,
    updatedAtIso: nowIso
  };
}

async function listAccessibleIncidentDocs(
  context: AuthorizedRcaContext
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const incidentCollection = context.organizationRef.collection(RCA_INCIDENTS_COLLECTION);
  const [ownedSnapshot, participatingSnapshot] = await Promise.all([
    incidentCollection
      .where('createdByUid', '==', context.uid)
      .limit(MAX_RCA_INCIDENTS)
      .get(),
    incidentCollection
      .where('participantUids', 'array-contains', context.uid)
      .limit(MAX_RCA_INCIDENTS)
      .get()
  ]);
  const incidentDocsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  [...ownedSnapshot.docs, ...participatingSnapshot.docs].forEach((doc) => {
    const record = doc.data() as RcaIncidentRecord;

    if (
      record.tenantId !== context.tenantId ||
      record.companyId !== context.tenantId ||
      !canAccessRcaIncident(context, record)
    ) {
      return;
    }

    incidentDocsById.set(doc.id, doc);
  });

  return [...incidentDocsById.values()]
    .sort((first, second) => compareIncidentUpdatedAt(
      second.data() as RcaIncidentRecord,
      first.data() as RcaIncidentRecord
    ))
    .slice(0, MAX_RCA_INCIDENTS);
}

function canAccessRcaIncident(context: AuthorizedRcaContext, incident: RcaIncidentRecord): boolean {
  if (incident.createdByUid === context.uid) {
    return true;
  }

  return Array.isArray(incident.participantUids) && incident.participantUids.includes(context.uid);
}

function assertRcaIncidentOwner(context: AuthorizedRcaContext, incident: RcaIncidentRecord): void {
  if (incident.createdByUid !== context.uid) {
    throw authorizationError('Only the RCA project owner can invite collaborators.');
  }
}

async function getRcaUserSummaryByUid(
  context: AuthorizedRcaContext,
  uid: string
): Promise<RcaUserSummary | null> {
  const usersByUid = await getRcaUserSummariesByUid(context, [uid]);

  return usersByUid.get(uid) || null;
}

async function getRcaUserSummariesByUid(
  context: AuthorizedRcaContext,
  userIds: string[]
): Promise<Map<string, RcaUserSummary>> {
  const usersByUid = new Map<string, RcaUserSummary>();
  const safeUserIds = [...new Set(userIds.filter(Boolean).map(safeId))];

  await Promise.all(safeUserIds.map(async (uid) => {
    const snapshot = await context.organizationRef.collection('users').doc(uid).get();

    if (!snapshot.exists) {
      return;
    }

    const user = snapshot.data() as TenantUserRecord;

    if (user.tenantId !== context.tenantId || user.status !== 'ACTIVE') {
      return;
    }

    usersByUid.set(uid, buildRcaUserSummary(uid, user));
  }));

  return usersByUid;
}

function buildRcaUserSummary(uid: string, user: TenantUserRecord): RcaUserSummary {
  return {
    departmentName: user.departmentName || null,
    displayName: getDisplayName(user),
    profilePhotoCacheKey: user.profilePhotoStoragePath
      ? buildRcaProfilePhotoCacheKey(uid, user.profilePhotoVersion)
      : null,
    profilePhotoUrl: user.profilePhotoStoragePath
      ? `/api/rca/users/${encodeURIComponent(uid)}/photo?v=${encodeURIComponent(String(user.profilePhotoVersion || 1))}`
      : null,
    roleName: formatRoleName(user.roleName, user.role || 'EMPLOYEE'),
    uid
  };
}

function buildRcaProfilePhotoCacheKey(uid: string, version?: number | null): string {
  return `rca-profile-photo-${uid}-${version || 1}`;
}

function compareIncidentUpdatedAt(first: RcaIncidentRecord, second: RcaIncidentRecord): number {
  return getIncidentUpdatedAtMs(first) - getIncidentUpdatedAtMs(second);
}

function getIncidentUpdatedAtMs(incident: RcaIncidentRecord): number {
  const updatedAtIso = toIso(incident.updatedAtIso || incident.updatedAt);
  const updatedAtMs = updatedAtIso ? Date.parse(updatedAtIso) : 0;

  return Number.isFinite(updatedAtMs) ? updatedAtMs : 0;
}

async function getAuthorizedIncident(decodedToken: DecodedIdToken, incidentId: string): Promise<{
  context: AuthorizedRcaContext;
  incidentRecord: RcaIncidentRecord;
  incidentRef: FirebaseFirestore.DocumentReference;
}> {
  const context = await getAuthorizedRcaContext(decodedToken);
  const incidentRef = context.organizationRef.collection(RCA_INCIDENTS_COLLECTION).doc(safeId(incidentId));
  const snapshot = await incidentRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This RCA incident was not found.');
  }

  const incidentRecord = snapshot.data() as RcaIncidentRecord;

  if (
    incidentRecord.tenantId !== context.tenantId ||
    incidentRecord.companyId !== context.tenantId ||
    (incidentRecord.status && incidentRecord.status === 'DELETED') ||
    !canAccessRcaIncident(context, incidentRecord)
  ) {
    throw notFoundError('This RCA incident was not found.');
  }

  return {
    context,
    incidentRecord,
    incidentRef
  };
}

async function getAuthorizedSession(
  decodedToken: DecodedIdToken,
  incidentId: string,
  sessionId: string
): Promise<{
  context: AuthorizedRcaContext;
  incidentRecord: RcaIncidentRecord;
  incidentRef: FirebaseFirestore.DocumentReference;
  sessionRecord: RcaSessionRecord;
  sessionRef: FirebaseFirestore.DocumentReference;
}> {
  const authorizedIncident = await getAuthorizedIncident(decodedToken, incidentId);
  const sessionRef = authorizedIncident.incidentRef
    .collection(RCA_SESSIONS_COLLECTION)
    .doc(safeId(sessionId));
  const snapshot = await sessionRef.get();

  if (!snapshot.exists) {
    throw notFoundError('This RCA session was not found.');
  }

  const sessionRecord = snapshot.data() as RcaSessionRecord;

  if (
    sessionRecord.tenantId !== authorizedIncident.context.tenantId ||
    sessionRecord.incidentId !== authorizedIncident.incidentRef.id
  ) {
    throw notFoundError('This RCA session was not found.');
  }

  return {
    ...authorizedIncident,
    sessionRecord,
    sessionRef
  };
}

async function getAuthorizedRcaContext(decodedToken: DecodedIdToken): Promise<AuthorizedRcaContext> {
  const session = await buildAuthSession(decodedToken);
  const { role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const userRef = organizationRef.collection('users').doc(decodedToken.uid);
  const [organizationSnapshot, userSnapshot] = await Promise.all([
    organizationRef.get(),
    userRef.get()
  ]);

  if (!organizationSnapshot.exists || !userSnapshot.exists) {
    throw authorizationError('Your profile is not active.');
  }

  const organization = organizationSnapshot.data() as OrganizationRecord;
  const user = userSnapshot.data() as TenantUserRecord;

  if (
    organization.status !== 'ACTIVE' ||
    user.status !== 'ACTIVE' ||
    (organization.tenantId && organization.tenantId !== tenantId) ||
    (user.tenantId && user.tenantId !== tenantId)
  ) {
    throw authorizationError('Your profile is not active.');
  }

  return {
    department: await resolveUserDepartment(tenantId, user, role),
    organization,
    organizationRef,
    role,
    tenantId,
    user,
    uid: decodedToken.uid
  };
}

async function resolveUserDepartment(
  tenantId: string,
  user: TenantUserRecord,
  role: SynzappRole
): Promise<RcaWorkspaceContext['department']> {
  const fallbackDepartmentId = role === 'ORG_ADMIN' && !user.departmentId
    ? HUMAN_RESOURCES_DEPARTMENT_ID
    : user.departmentId || null;
  const fallbackName = role === 'ORG_ADMIN' && fallbackDepartmentId === HUMAN_RESOURCES_DEPARTMENT_ID
    ? HUMAN_RESOURCES_DEPARTMENT_NAME
    : user.departmentName || 'Unassigned department';

  if (!fallbackDepartmentId) {
    return {
      departmentId: null,
      name: fallbackName,
      status: 'ACTIVE'
    };
  }

  const departmentSnapshot = await firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('departments')
    .doc(fallbackDepartmentId)
    .get();

  if (!departmentSnapshot.exists) {
    return {
      departmentId: fallbackDepartmentId,
      name: fallbackName,
      status: 'ACTIVE'
    };
  }

  const department = departmentSnapshot.data() as TenantDepartmentRecord;

  if (department.tenantId && department.tenantId !== tenantId) {
    throw authorizationError('Your department is not available.');
  }

  return {
    departmentId: department.departmentId || fallbackDepartmentId,
    name: department.name || fallbackName,
    status: department.status || 'ACTIVE'
  };
}

function mapWorkspaceContext(context: AuthorizedRcaContext): RcaWorkspaceContext {
  return {
    company: {
      companyName: context.organization.companyName || 'Your organization',
      tenantId: context.tenantId
    },
    department: context.department,
    user: {
      displayName: getDisplayName(context.user),
      role: context.role,
      roleName: formatRoleName(context.user.roleName, context.role),
      uid: context.uid
    }
  };
}

function mapIncident(
  id: string,
  record: RcaIncidentRecord,
  context: AuthorizedRcaContext,
  usersByUid: Map<string, RcaUserSummary> = new Map()
): RcaIncident {
  const riskFactors = normalizeRiskFactors(record.riskFactors);
  const participantUids = Array.isArray(record.participantUids) ? record.participantUids : [];

  return {
    activeSessionId: record.activeSessionId || null,
    assetId: record.assetId || 'Unassigned asset',
    accessRole: record.createdByUid === context.uid ? 'OWNER' : 'INVITED',
    collaborators: participantUids
      .map((uid) => usersByUid.get(uid) || null)
      .filter((user): user is RcaUserSummary => Boolean(user)),
    createdAtIso: toIso(record.createdAtIso || record.createdAt),
    createdByUid: record.createdByUid || '',
    departmentId: record.departmentId ?? context.department.departmentId,
    departmentName: record.departmentName || context.department.name,
    displayId: record.displayId || buildRcaDisplayId('RCA', id, record.createdAtIso || record.createdAt),
    id,
    owner: usersByUid.get(record.createdByUid || '') || null,
    riskFactors,
    rpnScore: Number.isFinite(record.rpnScore) ? Number(record.rpnScore) : calculateRpn(riskFactors),
    sourceRailsDisplayId: record.sourceRailsDisplayId || null,
    sourceRailsItemId: record.sourceRailsItemId || null,
    status: normalizeIncidentStatus(record.status),
    tenantId: record.tenantId || context.tenantId,
    title: record.title || 'Untitled RCA incident',
    updatedAtIso: toIso(record.updatedAtIso || record.updatedAt)
  };
}

function mapSession(id: string, record: RcaSessionRecord): RcaSession {
  return {
    closedAtIso: toIso(record.closedAtIso || record.closedAt),
    createdAtIso: toIso(record.createdAtIso || record.createdAt),
    id,
    incidentId: record.incidentId || '',
    leadInvestigatorId: record.leadInvestigatorId || '',
    methodology: normalizeMethodology(record.methodology || 'ISHIKAWA'),
    status: normalizeSessionStatus(record.status || 'ACTIVE'),
    updatedAtIso: toIso(record.updatedAtIso || record.updatedAt)
  };
}

function mapNode(id: string, record: RcaNodeRecord): RcaNode {
  const methodology = normalizeMethodology(record.uiCoordinates?.layoutMethodology || 'ISHIKAWA');
  const nodeType = normalizeNodeType(record.nodeType || (methodology === '5_WHYS' ? 'WHY' : 'CAUSE'));

  return {
    attachedEvidence: Array.isArray(record.attachedEvidence) ? record.attachedEvidence : [],
    connectionHandles: normalizeNodeConnectionHandles(record.connectionHandles),
    createdBy: record.createdByUid ? {
      departmentName: record.createdByDepartmentName || null,
      displayName: record.createdByDisplayName || 'Synzapp user',
      profilePhotoCacheKey: `rca-profile-photo-${record.createdByUid}-${record.createdByProfilePhotoVersion || 1}`,
      profilePhotoUrl: `/api/rca/users/${encodeURIComponent(record.createdByUid)}/photo?v=${encodeURIComponent(String(record.createdByProfilePhotoVersion || 1))}`,
      roleName: record.createdByRoleName || 'User',
      uid: record.createdByUid
    } : null,
    createdAtIso: toIso(record.createdAtIso || record.createdAt),
    detailFields: normalizeNodeDetailFields(record.detailFields),
    dimensions: nodeType === 'STICKY_NOTE' ? normalizeNodeDimensions(record.dimensions) : undefined,
    edgeStyle: normalizeEdgeStyle(record.edgeStyle),
    fiveWhysRole: nodeType === 'WHY' ? normalizeFiveWhysRole(record.fiveWhysRole) : null,
    id,
    isRootCause: Boolean(record.isRootCause),
    isSuspectedCause: Boolean(record.isSuspectedCause || record.isRootCause),
    label: record.label || '',
    lockedAtIso: toIso(record.lockedAtIso || record.lockedAt),
    lockedBy: record.lockedBy || null,
    nodeType,
    parentNodeId: record.parentNodeId || null,
    status: record.status === 'DELETED' ? 'DELETED' : 'ACTIVE',
    uiCoordinates: normalizeCoordinates(record.uiCoordinates, methodology, 0),
    updatedAtIso: toIso(record.updatedAtIso || record.updatedAt),
    visualStyle: normalizeVisualStyle(record.visualStyle),
    whyChain: normalizeWhyChain(record.whyChain)
  };
}

async function createRcaActivityLog(
  context: AuthorizedRcaContext,
  sessionRef: FirebaseFirestore.DocumentReference,
  input: {
    action: RcaActivityLogAction;
    incidentId: string;
    node: RcaNode;
    nextValue?: string;
    previousValue?: string;
    sessionId: string;
    summary?: string;
  }
): Promise<RcaActivityLog> {
  const nowIso = new Date().toISOString();
  const logRef = sessionRef.collection(RCA_ACTIVITY_LOGS_COLLECTION).doc();
  const actor = buildRcaUserSummary(context.uid, context.user);
  const record: RcaActivityLogRecord = {
    action: input.action,
    actorUid: context.uid,
    createdAtIso: nowIso,
    incidentId: input.incidentId,
    labelSnapshot: input.node.label || '',
    nextValue: input.nextValue || '',
    nodeId: input.node.id,
    nodeType: input.node.nodeType,
    previousValue: input.previousValue || '',
    sessionId: input.sessionId,
    summary: input.summary || buildActivityLogSummary(input.action, input.node, input.previousValue, input.nextValue),
    tenantId: context.tenantId
  };

  await logRef.set({
    ...record,
    createdAt: fieldValue.serverTimestamp()
  });

  return mapActivityLog(logRef.id, record, context, new Map([[context.uid, actor]]));
}

function mapActivityLog(
  id: string,
  record: RcaActivityLogRecord,
  context: AuthorizedRcaContext,
  actorsByUid: Map<string, RcaUserSummary>
): RcaActivityLog {
  const actorUid = record.actorUid || '';

  return {
    action: record.action || 'NODE_UPDATED',
    actor: actorsByUid.get(actorUid) || buildRcaUserSummary(actorUid || context.uid, context.user),
    createdAtIso: toIso(record.createdAtIso || record.createdAt),
    id,
    incidentId: record.incidentId || '',
    labelSnapshot: record.labelSnapshot || '',
    nextValue: record.nextValue || '',
    nodeId: record.nodeId || '',
    nodeType: normalizeNodeType(record.nodeType || 'CAUSE'),
    previousValue: record.previousValue || '',
    sessionId: record.sessionId || '',
    summary: record.summary || 'Updated an RCA node',
    tenantId: record.tenantId || context.tenantId
  };
}

async function buildNodeUpdateActivityLogInput(
  sessionRef: FirebaseFirestore.DocumentReference,
  auditIntent: RcaAuditIntent | undefined,
  previousRecord: RcaNodeRecord,
  nextNode: RcaNode,
  changedKeys: string[]
): Promise<{
  action: RcaActivityLogAction;
  nextValue?: string;
  previousValue?: string;
  summary?: string;
}> {
  const nodeName = getActivityNodeName(nextNode);

  if (
    changedKeys.includes('parentNodeId') ||
    changedKeys.includes('connectionHandles')
  ) {
    const previousParentId = previousRecord.parentNodeId || '';
    const nextParentId = nextNode.parentNodeId || '';
    const previousParentDescriptor = previousParentId
      ? await getActivityNodeDescriptorById(sessionRef, previousParentId)
      : '';
    const nextParentDescriptor = nextParentId
      ? await getActivityNodeDescriptorById(sessionRef, nextParentId)
      : '';

    if (previousParentId && !nextParentId) {
      const action = auditIntent === 'SPLINE_DELETED' ? 'SPLINE_DELETED' : 'SPLINE_DISCONNECTED';
      const previousFlow = buildSplineFlowDescription(nextNode, previousParentDescriptor);

      return {
        action,
        previousValue: previousFlow,
        summary: `${action === 'SPLINE_DELETED' ? 'Deleted' : 'Disconnected'} spline from ${previousFlow}`
      };
    }

    if (nextParentId) {
      const nextFlow = buildSplineFlowDescription(nextNode, nextParentDescriptor);
      const previousFlow = previousParentId
        ? buildSplineFlowDescription(nextNode, previousParentDescriptor)
        : '';

      return {
        action: 'SPLINE_CONNECTED',
        nextValue: nextFlow,
        previousValue: previousFlow,
        summary: `${previousParentId ? 'Reconnected' : 'Connected'} spline from ${nextFlow}`
      };
    }
  }

  const previousLabel = normalizeText(previousRecord.label, '', 240);
  const nextLabel = nextNode.label || '';

  if (changedKeys.includes('label') && previousLabel !== nextLabel) {
    return {
      action: 'NODE_TEXT_UPDATED',
      nextValue: nextLabel,
      previousValue: previousLabel,
      summary: `Updated text on ${formatNodeType(nextNode.nodeType)}`
    };
  }

  return {
    action: 'NODE_UPDATED',
    nextValue: nextLabel,
    previousValue: previousLabel,
    summary: `Updated ${nodeName}`
  };
}

async function getActivityNodeDescriptorById(
  sessionRef: FirebaseFirestore.DocumentReference,
  nodeId: string
): Promise<string> {
  const snapshot = await sessionRef.collection(RCA_NODES_COLLECTION).doc(nodeId).get();

  if (!snapshot.exists) {
    return 'Deleted node';
  }

  const record = snapshot.data() as RcaNodeRecord;
  const node = mapNode(nodeId, record);

  return getActivityNodeDescriptor(node);
}

function getActivityNodeName(node: RcaNode): string {
  return node.label?.trim() || formatNodeType(node.nodeType);
}

function getActivityNodeDescriptor(node: RcaNode): string {
  const role = node.nodeType === 'WHY' ? normalizeFiveWhysRole(node.fiveWhysRole) : null;
  const nodeType = role ? getFiveWhysRoleLabel(role) : formatNodeType(node.nodeType);
  const primaryText = getActivityNodePrimaryText(node);

  return `${nodeType} node${primaryText ? ` (${primaryText})` : ''}`;
}

function getActivityNodePrimaryText(node: RcaNode): string {
  const directLabel = normalizeText(node.label, '', 160);

  if (directLabel) {
    return directLabel;
  }

  const fields = node.detailFields || {};
  const role = node.nodeType === 'WHY' ? normalizeFiveWhysRole(node.fiveWhysRole) : null;
  const preferredKeys = role === 'INCIDENT_DETAILS'
    ? ['whereDidItHappen', 'whenDidItHappen', 'whoWasInvolved', 'detailedDescription', 'whatHappened']
    : role === 'INCIDENT'
      ? ['incidentTitle', 'lineMachineProcess', 'areaLocation', 'dateOfIncident', 'incidentDescription']
      : role === 'PROBLEM'
        ? ['problemStatement', 'problemLocation', 'knownFacts']
        : [];
  const preferredValues = preferredKeys
    .map((key) => normalizeText(fields[key], '', 80))
    .filter(Boolean);

  if (preferredValues.length) {
    return normalizeText(preferredValues.slice(0, 3).join(', '), '', 160);
  }

  return normalizeText(Object.values(fields).find((value) => normalizeText(value, '', 80)) || '', '', 160);
}

function getFiveWhysRoleLabel(role: RcaFiveWhysNodeRole): string {
  if (role === 'INCIDENT') {
    return 'Incident';
  }

  if (role === 'INCIDENT_DETAILS') {
    return 'Incident details';
  }

  if (role === 'FIVE_WHYS') {
    return '5 Whys';
  }

  if (role === 'ROOT_CAUSE') {
    return 'Root cause';
  }

  if (role === 'CORRECTIVE_ACTION') {
    return 'Corrective action';
  }

  if (role === 'PREVENTIVE_ACTION') {
    return 'Preventive action';
  }

  if (role === 'RISK_ASSESSMENT') {
    return 'Risk assessment';
  }

  if (role === 'LESSONS_LEARNED') {
    return 'Lessons learned';
  }

  if (role === 'APPROVAL_CLOSURE') {
    return 'Approval & closure';
  }

  return role
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function buildSplineFlowDescription(node: RcaNode, parentDescriptor: string): string {
  const nodeDescriptor = getActivityNodeDescriptor(node);
  const relatedNodeDescriptor = parentDescriptor || 'selected node';
  const methodology = normalizeMethodology(node.uiCoordinates.layoutMethodology || 'ISHIKAWA');
  const sourceNodeName = methodology === '5_WHYS' ? relatedNodeDescriptor : nodeDescriptor;
  const targetNodeName = methodology === '5_WHYS' ? nodeDescriptor : relatedNodeDescriptor;

  return `${sourceNodeName} output to ${targetNodeName} input`;
}

function buildActivityLogSummary(
  action: RcaActivityLogAction,
  node: RcaNode,
  previousValue = '',
  nextValue = ''
): string {
  const nodeName = getActivityNodeName(node);

  if (action === 'NODE_CREATED') {
    return `Created ${formatNodeType(node.nodeType)} node${nodeName ? `: ${nodeName}` : ''}`;
  }

  if (action === 'NODE_DELETED') {
    return `Deleted ${nodeName}`;
  }

  if (action === 'NODE_TEXT_UPDATED') {
    return `Changed text from "${previousValue || 'blank'}" to "${nextValue || 'blank'}"`;
  }

  if (action === 'SPLINE_CONNECTED') {
    return `Connected spline from ${nextValue || `${nodeName} output to selected node input`}`;
  }

  if (action === 'SPLINE_DELETED') {
    return `Deleted spline from ${previousValue || `${nodeName} output to previous node input`}`;
  }

  if (action === 'SPLINE_DISCONNECTED') {
    return `Disconnected spline from ${previousValue || `${nodeName} output to previous node input`}`;
  }

  if (action === 'MULTI_DELETED') {
    return `Deleted multiple selected canvas items`;
  }

  if (action === 'UNDO') {
    return `Undid the last canvas action`;
  }

  if (action === 'REDO') {
    return `Redid the last canvas action`;
  }

  return `Edited ${nodeName}`;
}

function formatNodeType(nodeType: RcaNodeType): string {
  if (nodeType === 'FAULT_GATE') {
    return 'Fault gate';
  }

  if (nodeType === 'ISHIKAWA_CATEGORY') {
    return 'Category';
  }

  if (nodeType === 'WHY') {
    return 'Why';
  }

  if (nodeType === 'SUB_CAUSE') {
    return 'Sub cause';
  }

  if (nodeType === 'STICKY_NOTE') {
    return 'Sticky note';
  }

  return 'Cause';
}

function buildIncidentSummary(incidents: RcaIncident[]): {
  activeInvestigations: number;
  averageRpn: number;
  closedInvestigations: number;
  criticalIncidents: number;
} {
  const activeIncidents = incidents.filter((incident) => incident.status !== 'CLOSED');
  const totalRpn = activeIncidents.reduce((sum, incident) => sum + incident.rpnScore, 0);

  return {
    activeInvestigations: incidents.filter((incident) => incident.status === 'INVESTIGATING').length,
    averageRpn: activeIncidents.length ? Math.round(totalRpn / activeIncidents.length) : 0,
    closedInvestigations: incidents.filter((incident) => incident.status === 'CLOSED').length,
    criticalIncidents: activeIncidents.filter((incident) => incident.rpnScore >= RCA_RPN_THRESHOLD).length
  };
}

function normalizeRiskFactors(input: Partial<RcaRiskFactors> | undefined): RcaRiskFactors {
  return {
    detection: normalizeRiskFactor(input?.detection, 3),
    occurrence: normalizeRiskFactor(input?.occurrence, 3),
    severity: normalizeRiskFactor(input?.severity, 3)
  };
}

function normalizeRiskFactor(value: unknown, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(10, Math.max(1, Math.round(numericValue)));
}

function calculateRpn(riskFactors: RcaRiskFactors): number {
  return riskFactors.severity * riskFactors.occurrence * riskFactors.detection;
}

function normalizeCoordinates(
  input: Partial<RcaUiCoordinates> | undefined,
  methodology: RcaMethodology,
  nodeIndex: number
): RcaUiCoordinates {
  return {
    layoutMethodology: methodology,
    x: normalizeCoordinate(input?.x, 120 + (nodeIndex % 4) * 340),
    y: normalizeCoordinate(input?.y, 120 + Math.floor(nodeIndex / 4) * 190)
  };
}

function normalizeCoordinate(value: unknown, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(
    -RCA_CANVAS_COORDINATE_LIMIT,
    Math.min(RCA_CANVAS_COORDINATE_LIMIT, Math.round(numericValue))
  );
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return fallback;
  }

  return trimmedValue.slice(0, maxLength);
}

function normalizeWhyChain(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item, '', 260))
    .slice(0, 5);
}

function normalizeAttachedEvidence(value: unknown): RcaAttachedEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const evidence: RcaAttachedEvidence[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== 'object' || evidence.length >= 24) {
      return;
    }

    const record = item as Partial<RcaAttachedEvidence>;
    const fileName = normalizeText(record.fileName, '', 180);
    const fileUrl = normalizeText(record.fileUrl, '', 320);

    if (!fileName || !fileUrl) {
      return;
    }

    evidence.push({
      fileHash: normalizeText(record.fileHash, randomUUID(), 128),
      fileName,
      fileUrl,
      uploadedAtIso: normalizeText(record.uploadedAtIso, new Date().toISOString(), 40)
    });
  });

  return evidence;
}

function normalizeNodeDimensions(value: unknown): RcaNodeDimensions | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Partial<RcaNodeDimensions>;
  const width = normalizeDimension(record.width, 160, 720);
  const height = normalizeDimension(record.height, 96, 720);
  const dimensions: RcaNodeDimensions = {};

  if (width !== null) {
    dimensions.width = width;
  }

  if (height !== null) {
    dimensions.height = height;
  }

  return Object.keys(dimensions).length ? dimensions : undefined;
}

function normalizeDimension(value: unknown, min: number, max: number): number | null {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(min, Math.min(max, Math.round(numericValue)));
}

function parseRcaEvidenceDataUrl(dataUrl: string, declaredContentType: string): RcaEvidenceFile {
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());

  if (!match) {
    throw validationError('RCA evidence upload must be a base64 data URL.');
  }

  const contentType = normalizeEvidenceContentType(match[1] || declaredContentType);
  const payload = Buffer.from(match[2], 'base64');

  if (!payload.length) {
    throw validationError('RCA evidence upload is empty.');
  }

  if (payload.byteLength > MAX_RCA_EVIDENCE_BYTES) {
    throw validationError('RCA evidence file is too large. Please choose a file under 4 MB.');
  }

  return {
    contentType,
    fileName: 'evidence',
    payload
  };
}

function normalizeEvidenceContentType(contentType: string): string {
  const safeContentType = contentType.trim().toLowerCase();
  const normalizedContentType = safeContentType === 'image/jpg' ? 'image/jpeg' : safeContentType;

  if (/^(image|video|audio|application|text)\/[a-z0-9.+-]+$/.test(normalizedContentType)) {
    return normalizedContentType;
  }

  return 'application/octet-stream';
}

function normalizeRcaEvidenceId(evidenceId: string): string {
  const safeEvidenceId = evidenceId.trim();

  if (!/^ev_[A-Fa-f0-9]{32}$/.test(safeEvidenceId)) {
    throw notFoundError('This RCA evidence file was not found.');
  }

  return safeEvidenceId;
}

function getRcaEvidenceStoragePath(
  tenantId: string,
  incidentId: string,
  sessionId: string,
  evidenceId: string
): string {
  return [
    'organizations',
    tenantId,
    'rca',
    incidentId,
    'sessions',
    sessionId,
    'evidence',
    evidenceId
  ].join('/');
}

function sanitizeRcaEvidenceFileName(fileName: string): string {
  const safeFileName = fileName
    .trim()
    .replace(/[^\w .()+-]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);

  return safeFileName || 'evidence';
}

function hasCompletedFiveWhys(whyChain: string[]): boolean {
  return whyChain.filter((why) => why.trim()).length >= 5;
}

function assertRootCauseReady(_attachedEvidence: RcaAttachedEvidence[], whyChain: string[]): void {
  if (!hasCompletedFiveWhys(whyChain)) {
    throw validationError('Complete the 5 Whys before confirming a root cause.');
  }
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? safeId(trimmedValue) : null;
}

function normalizeIncidentStatus(status: unknown): RcaIncidentStatus {
  return status === 'INVESTIGATING' || status === 'CLOSED' ? status : 'OPEN';
}

function normalizeSessionStatus(status: unknown): RcaSessionStatus {
  if (status === 'FREEZE' || status === 'COMPLETED' || status === 'CLOSED') {
    return status;
  }

  return 'ACTIVE';
}

function normalizeMethodology(methodology: unknown): RcaMethodology {
  if (methodology === 'ISHIKAWA' || methodology === 'FAULT_TREE') {
    return methodology;
  }

  return 'ISHIKAWA';
}

function normalizeNodeType(nodeType: unknown): RcaNodeType {
  if (
    nodeType === 'ISHIKAWA_CATEGORY' ||
    nodeType === 'CAUSE' ||
    nodeType === 'SUB_CAUSE' ||
    nodeType === 'FAULT_GATE' ||
    nodeType === 'STICKY_NOTE'
  ) {
    return nodeType;
  }

  return 'WHY';
}

function normalizeFiveWhysRole(role: unknown): RcaFiveWhysNodeRole | null {
  if (
    role === 'INCIDENT' ||
    role === 'INCIDENT_DETAILS' ||
    role === 'CONTAINMENT' ||
    role === 'EVIDENCE' ||
    role === 'PROBLEM' ||
    role === 'FIVE_WHYS' ||
    role === 'ANSWER' ||
    role === 'ROOT_CAUSE' ||
    role === 'CORRECTIVE_ACTION' ||
    role === 'PREVENTIVE_ACTION' ||
    role === 'CAPA' ||
    role === 'RISK_ASSESSMENT' ||
    role === 'EFFECTIVENESS' ||
    role === 'LESSONS_LEARNED' ||
    role === 'APPROVAL_CLOSURE'
  ) {
    return role;
  }

  if (role === 'WHY') {
    return 'FIVE_WHYS';
  }

  return null;
}

function buildRcaDisplayId(prefix: string, id: string, createdAt?: FirestoreDateLike): string {
  const createdIso = toIso(createdAt);
  const year = createdIso ? new Date(createdIso).getUTCFullYear() : new Date().getUTCFullYear();
  const safePrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'RCA';
  const suffix = safeId(id).replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

  return `${safePrefix}-${year}-${suffix}`;
}

function getIncidentDisplayId(incidentId: string, incidentRecord: RcaIncidentRecord): string {
  return incidentRecord.displayId || buildRcaDisplayId('RCA', incidentId, incidentRecord.createdAtIso || incidentRecord.createdAt);
}

function getSystemManagedNodeDetailFields(
  role: RcaFiveWhysNodeRole | null,
  incidentId: string,
  incidentRecord: RcaIncidentRecord,
  existingFields: Record<string, string> = {}
): Record<string, string> {
  const incidentDisplayId = getIncidentDisplayId(incidentId, incidentRecord);

  if (role === 'INCIDENT') {
    return { incidentId: existingFields.incidentId || incidentDisplayId };
  }

  if (role === 'CAPA') {
    return { capaId: existingFields.capaId || incidentDisplayId.replace(/^RCA-/, 'CAPA-') };
  }

  if (role === 'RISK_ASSESSMENT') {
    return { riskAssessmentId: existingFields.riskAssessmentId || incidentDisplayId.replace(/^RCA-/, 'RISK-') };
  }

  if (role === 'EFFECTIVENESS') {
    return { verificationId: existingFields.verificationId || incidentDisplayId.replace(/^RCA-/, 'VER-') };
  }

  if (role === 'APPROVAL_CLOSURE') {
    return { closureReviewId: existingFields.closureReviewId || incidentDisplayId.replace(/^RCA-/, 'CLOSE-') };
  }

  return {};
}

function normalizeSystemManagedNodeDetailFields(
  role: RcaFiveWhysNodeRole | null,
  fields: Record<string, string>,
  incidentId: string,
  incidentRecord: RcaIncidentRecord,
  existingFields: Record<string, string> = {}
): Record<string, string> {
  const systemManagedKeys = new Set(RCA_SYSTEM_MANAGED_DETAIL_FIELD_KEYS[role || 'FIVE_WHYS'] || []);
  const editableFields = { ...fields };

  for (const key of systemManagedKeys) {
    delete editableFields[key];
  }

  return {
    ...editableFields,
    ...getSystemManagedNodeDetailFields(role, incidentId, incidentRecord, normalizeNodeDetailFields(existingFields))
  };
}

async function assertIncidentNodeCreateOrder(
  sessionRef: FirebaseFirestore.DocumentReference,
  nodeType: RcaNodeType,
  fiveWhysRole: RcaFiveWhysNodeRole | null
): Promise<void> {
  const isIncidentNodeRequest = nodeType === 'WHY' && fiveWhysRole === 'INCIDENT';
  const snapshot = await sessionRef.collection(RCA_NODES_COLLECTION).get();
  const hasActiveIncidentNode = snapshot.docs.some((doc) => {
    const record = doc.data() as RcaNodeRecord;

    return record.status !== 'DELETED' &&
      normalizeNodeType(record.nodeType) === 'WHY' &&
      normalizeFiveWhysRole(record.fiveWhysRole) === 'INCIDENT';
  });

  if (isIncidentNodeRequest && hasActiveIncidentNode) {
    throw validationError('This RCA canvas already has an Incident node.');
  }

  if (!isIncidentNodeRequest && !hasActiveIncidentNode) {
    throw validationError('Create the Incident node before adding other RCA nodes.');
  }
}

function normalizeNodeDetailFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const fields: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    const key = normalizeText(rawKey, '', 80)
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .slice(0, 80);

    if (!key) {
      continue;
    }

    fields[key] = normalizeText(rawValue, '', 1200);
  }

  return fields;
}

function normalizeNodeConnectionHandles(value: unknown): RcaNodeConnectionHandles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const sourceHandle = typeof record.sourceHandle === 'string' ? record.sourceHandle : null;
  const targetHandle = typeof record.targetHandle === 'string' ? record.targetHandle : null;
  const connectionHandles: RcaNodeConnectionHandles = {};

  if (sourceHandle === 'source-right' || sourceHandle === 'source-bottom') {
    connectionHandles.sourceHandle = sourceHandle;
  }

  if (targetHandle === 'target-left' || targetHandle === 'target-top') {
    connectionHandles.targetHandle = targetHandle;
  }

  return connectionHandles;
}

function normalizeVisualStyle(style: unknown): RcaNodeVisualStyle {
  if (!style || typeof style !== 'object') {
    return {};
  }

  const record = style as Record<string, unknown>;
  const visualStyle: RcaNodeVisualStyle = {};

  if (typeof record.backgroundColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(record.backgroundColor.trim())) {
    visualStyle.backgroundColor = record.backgroundColor.trim();
  }

  if (typeof record.borderColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(record.borderColor.trim())) {
    visualStyle.borderColor = record.borderColor.trim();
  }

  if (typeof record.textColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(record.textColor.trim())) {
    visualStyle.textColor = record.textColor.trim();
  }

  if (typeof record.fontFamily === 'string' && RCA_NODE_FONT_FAMILIES.has(record.fontFamily.trim())) {
    visualStyle.fontFamily = record.fontFamily.trim();
  }

  if (typeof record.fontSize === 'number' && Number.isFinite(record.fontSize)) {
    const boundedFontSize = Math.max(10, Math.min(18, Math.round(record.fontSize)));
    visualStyle.fontSize = RCA_NODE_FONT_SIZES.reduce((closestSize, candidateSize) => (
      Math.abs(candidateSize - boundedFontSize) < Math.abs(closestSize - boundedFontSize)
        ? candidateSize
        : closestSize
    ), RCA_NODE_FONT_SIZES[0]);
  }

  if (typeof record.isBold === 'boolean') {
    visualStyle.isBold = record.isBold;
  }

  if (typeof record.isItalic === 'boolean') {
    visualStyle.isItalic = record.isItalic;
  }

  if (typeof record.isUnderline === 'boolean') {
    visualStyle.isUnderline = record.isUnderline;
  }

  return visualStyle;
}

function normalizeEdgeStyle(style: unknown): RcaNodeEdgeStyle {
  if (!style || typeof style !== 'object') {
    return {};
  }

  const record = style as Record<string, unknown>;
  const edgeStyle: RcaNodeEdgeStyle = {};

  if (typeof record.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(record.color.trim())) {
    edgeStyle.color = record.color.trim();
  }

  if (typeof record.weight === 'number' && Number.isFinite(record.weight)) {
    const boundedWeight = Math.max(1.5, Math.min(5, record.weight));
    edgeStyle.weight = RCA_SPLINE_WEIGHTS.reduce((closestWeight, candidateWeight) => (
      Math.abs(candidateWeight - boundedWeight) < Math.abs(closestWeight - boundedWeight)
        ? candidateWeight
        : closestWeight
    ), RCA_SPLINE_WEIGHTS[0]);
  }

  if (typeof record.lineType === 'string' && RCA_SPLINE_LINE_TYPES.has(record.lineType as RcaSplineLineType)) {
    edgeStyle.lineType = record.lineType as RcaSplineLineType;
  }

  if (typeof record.arrowHead === 'string' && RCA_SPLINE_ARROW_HEADS.has(record.arrowHead as RcaSplineArrowHead)) {
    edgeStyle.arrowHead = record.arrowHead as RcaSplineArrowHead;
  }

  return edgeStyle;
}

function assertSessionIsEditable(session: RcaSessionRecord): void {
  if (session.status === 'CLOSED' || session.status === 'COMPLETED') {
    throw validationError('This RCA session is closed and cannot be edited.');
  }
}

function safeId(value: string): string {
  const trimmedValue = value.trim();

  if (/^[A-Za-z0-9_-]{8,128}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return randomUUID();
}

function toIso(value: FirestoreDateLike): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

function getDisplayName(user: TenantUserRecord): string {
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  const name = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim();

  return name || 'Synzapp user';
}

function formatRoleName(roleName: string | undefined, role: SynzappRole): string {
  if (roleName?.trim()) {
    return roleName.trim();
  }

  return role
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function isMissingStorageBucketError(error: unknown): boolean {
  return error instanceof Error &&
    /bucket|storage|not found|does not exist|could not load the default credentials/i.test(error.message);
}
