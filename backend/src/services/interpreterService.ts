import { createHash, randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { assertRateLimit } from '../middleware/rateLimit.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';
import { sendInterpreterPushNotification } from './notificationService.js';

export type InterpreterMeetingType = 'LEVEL_1' | 'LEVEL_3' | 'ONE_ON_ONE';
export type InterpreterMeetingStatus = 'ENDED' | 'LIVE' | 'SCHEDULED';

export interface InterpreterLanguage {
  code: string;
  label: string;
}

export interface CreateInterpreterMeetingInput {
  autoDetectSourceLanguage?: boolean;
  invitedUserIds?: string[];
  interpreterLanguageCodes: string[];
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderFrequency?: 'daily' | 'none' | 'once' | 'weekly';
  reminderLeadMinutes?: number | null;
  scheduledAtIso?: string | null;
  sourceLanguageCode?: string | null;
}

export interface InterpreterTranscriptInput {
  confidence?: number | null;
  detectedLanguageCode?: string | null;
  durationMs?: number | null;
  sourceLanguageCode?: string | null;
  text: string;
}

export interface InterpreterTranslationInput {
  sourceSegmentId?: string | null;
  sourceText: string;
  targetLanguageCode: string;
  translatedText: string;
}

export interface InterpreterSummaryInput {
  languageCodes: string[];
  meetingId: string;
}

export interface InterpreterSummaryAudioInput {
  languageCode: string;
  meetingId: string;
  summaryId: string;
}

export interface InterpreterSummaryAudio {
  audioBase64: string;
  contentType: string;
  format: 'mp3';
  languageCode: string;
  model: string;
  voice: string;
}

export interface UpdateInterpreterInvitationsInput {
  invitedUserIds: string[];
  meetingId: string;
}

export interface InterpreterRealtimeSdpAnswerInput {
  offerSdp: string;
  targetLanguageCode: string;
}

export interface InterpreterRealtimeProviderDiagnosticInput {
  targetLanguageCode?: string | null;
}

interface OrganizationRecord {
  status?: string;
  tenantId?: string;
}

interface TenantUserRecord {
  departmentId?: string | null;
  departmentName?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoStoragePath?: string | null;
  profilePhotoVersion?: number | null;
  role?: SynzappRole;
  roleName?: string;
  status?: string;
  tenantId?: string;
}

interface AuthorizedInterpreterContext {
  organizationRef: FirebaseFirestore.DocumentReference;
  permissions: string[];
  role: SynzappRole;
  tenantId: string;
  user: TenantUserRecord;
  uid: string;
}

interface InterpreterMeetingRecord {
  autoDetectSourceLanguage: boolean;
  createdAt?: FirebaseFirestore.FieldValue;
  createdAtIso: string;
  createdByDisplayName: string;
  createdByUid: string;
  deletedAt?: FirebaseFirestore.FieldValue;
  deletedAtIso?: string | null;
  deletedByDisplayName?: string | null;
  deletedByUid?: string | null;
  endedAtIso?: string | null;
  interpreterLanguages: InterpreterLanguage[];
  invitedUserIds: string[];
  meetingId: string;
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderDeliveredCount?: number;
  reminderDispatchClaimId?: string | null;
  reminderDispatchClaimedAtIso?: string | null;
  reminderFrequency: 'daily' | 'none' | 'once' | 'weekly';
  reminderLastSentAtIso?: string | null;
  reminderLeadMinutes: number | null;
  reminderNextAtIso?: string | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
  status: InterpreterMeetingStatus;
  tenantId: string;
  updatedAt?: FirebaseFirestore.FieldValue;
  updatedAtIso: string;
}

interface InterpreterSummaryRecord {
  createdAtIso: string;
  createdByDisplayName?: string;
  createdByUid?: string;
  languageCodes: string[];
  meetingId: string;
  model?: string;
  summaryId: string;
  summaryTextByLanguage: Record<string, string>;
  tenantId: string;
}

interface InterpreterParticipant {
  departmentName: string | null;
  displayName: string;
  roleName: string | null;
  uid: string;
}

const INTERPRETER_MEETINGS_COLLECTION = 'interpreterMeetings';
const INTERPRETER_AUDIT_COLLECTION = 'interpreterAuditEvents';
const TRANSCRIPT_COLLECTION = 'transcriptSegments';
const TRANSLATION_COLLECTION = 'translationSegments';
const SUMMARY_COLLECTION = 'summaries';

const SUPPORTED_LANGUAGES: InterpreterLanguage[] = [
  { code: 'en-US', label: 'English' },
  { code: 'es-MX', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'pt-BR', label: 'Portuguese' },
  { code: 'de-DE', label: 'German' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'yue-CN', label: 'Cantonese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'ja-JP', label: 'Japanese' }
];

const LANGUAGE_BY_CODE = new Map(SUPPORTED_LANGUAGES.map((language) => [language.code, language]));

export function listInterpreterSupportedLanguages(): InterpreterLanguage[] {
  return SUPPORTED_LANGUAGES;
}

export async function listInterpreterMeetings(decodedToken: DecodedIdToken) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const [ownedSnapshot, invitedSnapshot] = await Promise.all([
    context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .where('createdByUid', '==', context.uid)
    .limit(50)
    .get(),
    context.organizationRef
      .collection(INTERPRETER_MEETINGS_COLLECTION)
      .where('invitedUserIds', 'array-contains', context.uid)
      .limit(50)
      .get()
  ]);
  const meetingById = new Map<string, InterpreterMeetingRecord>();

  [...ownedSnapshot.docs, ...invitedSnapshot.docs].forEach((doc) => {
    const meeting = normalizeMeetingRecord(doc.data() as Partial<InterpreterMeetingRecord>);

    if (meeting && meeting.tenantId === context.tenantId && !meeting.deletedAtIso) {
      meetingById.set(meeting.meetingId, meeting);
    }
  });

  return {
    meetings: [...meetingById.values()].sort((left, right) =>
      right.updatedAtIso.localeCompare(left.updatedAtIso)
    ),
    supportedLanguages: SUPPORTED_LANGUAGES
  };
}

export async function listInterpreterParticipants(decodedToken: DecodedIdToken) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const snapshot = await context.organizationRef
    .collection('users')
    .where('status', '==', 'ACTIVE')
    .limit(500)
    .get();
  const participants = snapshot.docs
    .map((doc) => {
      const user = doc.data() as TenantUserRecord;

      if (user.tenantId && user.tenantId !== context.tenantId) {
        return null;
      }

      return {
        departmentName: user.departmentName || null,
        displayName: getDisplayName(user),
        roleName: user.roleName || user.role || null,
        uid: doc.id
      };
    })
    .filter((participant): participant is InterpreterParticipant => Boolean(participant))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return { participants };
}

export async function createInterpreterMeeting(
  decodedToken: DecodedIdToken,
  input: CreateInterpreterMeetingInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  assertRateLimit(`interpreter:create:${context.uid}`, 60_000, 20);
  validateCreateInterpreterMeetingInput(input);

  const nowIso = new Date().toISOString();
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc();
  const meetingId = meetingRef.id;
  const interpreterLanguages = normalizeInterpreterLanguages(input.interpreterLanguageCodes);
  const invitedUserIds = await normalizeInvitedUserIds(context, input.invitedUserIds || []);
  const reminderFrequency = input.reminderFrequency || 'none';
  const reminderLeadMinutes = typeof input.reminderLeadMinutes === 'number' ? input.reminderLeadMinutes : null;
  const scheduledAtIso = input.scheduledAtIso || null;
  const record: InterpreterMeetingRecord = {
    autoDetectSourceLanguage: input.autoDetectSourceLanguage !== false,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    createdByDisplayName: getDisplayName(context.user),
    createdByUid: context.uid,
    endedAtIso: null,
    interpreterLanguages,
    invitedUserIds,
    meetingId,
    meetingName: input.meetingName.trim(),
    meetingType: input.meetingType,
    reminderDeliveredCount: 0,
    reminderDispatchClaimId: null,
    reminderDispatchClaimedAtIso: null,
    reminderFrequency,
    reminderLastSentAtIso: null,
    reminderLeadMinutes,
    reminderNextAtIso: calculateInitialReminderNextAtIso(scheduledAtIso, reminderFrequency, reminderLeadMinutes, nowIso),
    scheduledAtIso,
    sourceLanguageCode: input.autoDetectSourceLanguage === false ? input.sourceLanguageCode || 'en-US' : null,
    status: scheduledAtIso ? 'SCHEDULED' : 'LIVE',
    tenantId: context.tenantId,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  await meetingRef.set(stripUndefined(record));
  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      interpreterLanguageCodes: interpreterLanguages.map((language) => language.code),
      invitedUserCount: invitedUserIds.length,
      meetingType: record.meetingType,
      scheduledAtIso: record.scheduledAtIso
    },
    summary: `Created interpreter meeting "${record.meetingName}".`,
    type: 'INTERPRETER_MEETING_CREATED'
  });

  return { meeting: record };
}

export async function updateInterpreterMeetingInvitations(
  decodedToken: DecodedIdToken,
  input: UpdateInterpreterInvitationsInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, input.meetingId);

  if (!canManageInterpreterMeeting(context, meeting)) {
    throw authorizationError('Only the meeting owner or an interpreter administrator can change meeting access.');
  }

  const invitedUserIds = await normalizeInvitedUserIds(context, input.invitedUserIds || []);
  const nowIso = new Date().toISOString();
  const patch = {
    invitedUserIds,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .update(patch);
  await writeInterpreterAuditEvent({
    context,
    meetingId: input.meetingId,
    metadata: {
      afterInvitedUserCount: invitedUserIds.length,
      beforeInvitedUserCount: meeting.invitedUserIds?.length || 0
    },
    summary: `Updated interpreter meeting access for "${meeting.meetingName}".`,
    type: 'INTERPRETER_MEETING_ACCESS_UPDATED'
  });

  return {
    meeting: {
      ...meeting,
      invitedUserIds,
      updatedAtIso: nowIso
    }
  };
}

export async function listInterpreterSummaries(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);

  await readAccessibleMeeting(context, meetingId);

  const summariesSnapshot = await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(meetingId)
    .collection(SUMMARY_COLLECTION)
    .limit(50)
    .get();

  return {
    summaries: sortRecordsByIso(summariesSnapshot.docs.map((doc) => doc.data()), 'desc')
  };
}

export async function getInterpreterMeeting(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);
  const [transcriptsSnapshot, translationsSnapshot, summariesSnapshot, auditSnapshot] = await Promise.all([
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(TRANSCRIPT_COLLECTION).limit(200).get(),
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(TRANSLATION_COLLECTION).limit(300).get(),
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(SUMMARY_COLLECTION).limit(20).get(),
    context.organizationRef.collection(INTERPRETER_AUDIT_COLLECTION)
      .where('meetingId', '==', meetingId)
      .limit(50)
      .get()
  ]);

  return {
    auditEvents: sortRecordsByIso(auditSnapshot.docs.map((doc) => doc.data()), 'desc'),
    meeting,
    summaries: sortRecordsByIso(summariesSnapshot.docs.map((doc) => doc.data()), 'desc'),
    transcripts: sortRecordsByIso(transcriptsSnapshot.docs.map((doc) => doc.data()), 'asc'),
    translations: sortRecordsByIso(translationsSnapshot.docs.map((doc) => doc.data()), 'asc')
  };
}

export async function startInterpreterMeeting(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId);
  const meeting = await readAccessibleMeeting(context, meetingId);
  const nowIso = new Date().toISOString();
  const patch = {
    status: 'LIVE',
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  await meetingRef.update(patch);
  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: { beforeStatus: meeting.status, afterStatus: 'LIVE' },
    summary: `Started interpreter meeting "${meeting.meetingName}".`,
    type: 'INTERPRETER_MEETING_STARTED'
  });

  return { meeting: { ...meeting, status: 'LIVE' as const, updatedAtIso: nowIso } };
}

export async function endInterpreterMeeting(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId);
  const meeting = await readAccessibleMeeting(context, meetingId);
  const nowIso = new Date().toISOString();
  const patch = {
    endedAtIso: nowIso,
    status: 'ENDED',
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  await meetingRef.update(patch);
  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: { beforeStatus: meeting.status, afterStatus: 'ENDED' },
    summary: `Ended interpreter meeting "${meeting.meetingName}".`,
    type: 'INTERPRETER_MEETING_ENDED'
  });

  return { meeting: { ...meeting, endedAtIso: nowIso, status: 'ENDED' as const, updatedAtIso: nowIso } };
}

export async function deleteInterpreterMeeting(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);

  if (!canManageInterpreterMeeting(context, meeting)) {
    throw authorizationError('Only the meeting owner or an authorized administrator can delete this interpreter session.');
  }

  if (meeting.status === 'LIVE') {
    throw validationError('End this live interpreter session before deleting it.');
  }

  const nowIso = new Date().toISOString();
  const patch = {
    deletedAt: fieldValue.serverTimestamp(),
    deletedAtIso: nowIso,
    deletedByDisplayName: getDisplayName(context.user),
    deletedByUid: context.uid,
    updatedAt: fieldValue.serverTimestamp(),
    updatedAtIso: nowIso
  };

  await context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(safeDocumentId(meeting.meetingId))
    .update(patch);

  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      deletedAtIso: nowIso,
      deletedByUid: context.uid,
      interpreterLanguageCodes: meeting.interpreterLanguages.map((language) => language.code),
      invitedUserCount: meeting.invitedUserIds.length,
      previousStatus: meeting.status
    },
    summary: `Deleted interpreter meeting "${meeting.meetingName}".`,
    type: 'INTERPRETER_MEETING_DELETED'
  });

  return {
    deleted: true,
    deletedAtIso: nowIso,
    meetingId: meeting.meetingId
  };
}

export async function addInterpreterTranscriptSegment(
  decodedToken: DecodedIdToken,
  meetingId: string,
  input: InterpreterTranscriptInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);

  if (meeting.status === 'ENDED') {
    throw validationError('This interpreter meeting has already ended.');
  }

  const nowIso = new Date().toISOString();
  const segmentId = `itr_${randomUUID().replace(/-/g, '')}`;
  const segment = stripUndefined({
    confidence: input.confidence ?? null,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    createdByUid: context.uid,
    detectedLanguageCode: input.detectedLanguageCode || null,
    durationMs: input.durationMs ?? null,
    meetingId,
    segmentId,
    sourceLanguageCode: input.sourceLanguageCode || input.detectedLanguageCode || meeting.sourceLanguageCode || null,
    tenantId: context.tenantId,
    text: input.text.trim()
  });

  await context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
    .collection(TRANSCRIPT_COLLECTION).doc(segmentId).set(segment);
  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      confidence: input.confidence ?? null,
      detectedLanguageCode: input.detectedLanguageCode || null,
      durationMs: input.durationMs ?? null,
      segmentId,
      sourceLanguageCode: segment.sourceLanguageCode || null,
      textCharacterCount: segment.text.length
    },
    summary: `Recorded interpreter transcript segment for "${meeting.meetingName}".`,
    type: 'INTERPRETER_TRANSCRIPT_SEGMENT_RECORDED'
  });

  return { segment };
}

export async function addInterpreterTranslationSegment(
  decodedToken: DecodedIdToken,
  meetingId: string,
  input: InterpreterTranslationInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);

  if (meeting.status === 'ENDED') {
    throw validationError('This interpreter meeting has already ended.');
  }

  if (!meeting.interpreterLanguages.some((language) => language.code === input.targetLanguageCode)) {
    throw validationError('That language is not enabled for this interpreter meeting.');
  }

  const nowIso = new Date().toISOString();
  const translationId = `itx_${randomUUID().replace(/-/g, '')}`;
  const translation = stripUndefined({
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    createdByUid: context.uid,
    meetingId,
    sourceSegmentId: input.sourceSegmentId || null,
    sourceText: input.sourceText.trim(),
    targetLanguageCode: input.targetLanguageCode,
    tenantId: context.tenantId,
    translatedText: input.translatedText.trim(),
    translationId
  });

  await context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
    .collection(TRANSLATION_COLLECTION).doc(translationId).set(translation);
  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      sourceCharacterCount: translation.sourceText.length,
      sourceSegmentId: input.sourceSegmentId || null,
      targetLanguageCode: input.targetLanguageCode,
      translatedCharacterCount: translation.translatedText.length,
      translationId
    },
    summary: `Recorded interpreter translation segment for "${meeting.meetingName}".`,
    type: 'INTERPRETER_TRANSLATION_SEGMENT_RECORDED'
  });

  return { translation };
}

export async function createInterpreterRealtimeClientSecret(
  decodedToken: DecodedIdToken,
  meetingId: string,
  targetLanguageCode?: string | null
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);

  const session = await createOpenAiInterpreterRealtimeSession(context, meeting, targetLanguageCode);

  return {
    clientSecret: session.clientSecret,
    expiresWithSession: true,
    model: session.realtimeModel,
    targetLanguage: session.targetLanguage
  };
}

export async function createInterpreterRealtimeSdpAnswer(
  decodedToken: DecodedIdToken,
  meetingId: string,
  input: InterpreterRealtimeSdpAnswerInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);
  const offerSdp = normalizeRealtimeOfferSdp(input.offerSdp);
  const offerSdpHash = createHash('sha256').update(offerSdp).digest('hex').slice(0, 16);
  const session = await createOpenAiInterpreterRealtimeSession(context, meeting, input.targetLanguageCode);
  const response = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
    body: offerSdp,
    headers: {
      Authorization: `Bearer ${session.clientSecret}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Safety-Identifier': session.safetyIdentifier
    },
    method: 'POST',
    signal: AbortSignal.timeout(env.openAiRequestTimeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('OpenAI interpreter realtime SDP exchange failed:', {
      error: errorText.slice(0, 500),
      model: session.realtimeModel,
      offerSdpHash,
      offerSdpHasAudio: containsRealtimeAudioMediaSection(offerSdp),
      offerSdpLength: offerSdp.length,
      offerSdpStartsWithV0: offerSdp.startsWith('v=0'),
      status: response.status,
      targetLanguageCode: session.targetLanguage.code
    });
    throw serviceError(getOpenAiRealtimeSdpExchangeError(response.status, errorText));
  }

  const answerSdp = await response.text();

  if (!answerSdp.trim()) {
    throw serviceError('Interpreter realtime audio answer was empty.');
  }

  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      model: session.realtimeModel,
      offerSdpHash,
      targetLanguageCode: session.targetLanguage.code
    },
    summary: `Completed realtime interpreter SDP exchange for "${meeting.meetingName}".`,
    type: 'INTERPRETER_REALTIME_SDP_EXCHANGED'
  });

  return {
    answerSdp,
    model: session.realtimeModel,
    targetLanguage: session.targetLanguage
  };
}

export async function runInterpreterRealtimeProviderDiagnostic(
  decodedToken: DecodedIdToken,
  input: InterpreterRealtimeProviderDiagnosticInput = {}
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);

  if (!canRunInterpreterProviderDiagnostic(context)) {
    throw authorizationError('Only an authorized administrator can run interpreter provider diagnostics.');
  }

  const nowIso = new Date().toISOString();
  const targetLanguage = getSupportedLanguage(input.targetLanguageCode || 'es-MX');
  const session = await requestOpenAiInterpreterRealtimeSession(context, targetLanguage);
  const response = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
    body: getDiagnosticRealtimeOfferSdp(),
    headers: {
      Authorization: `Bearer ${session.clientSecret}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Safety-Identifier': session.safetyIdentifier
    },
    method: 'POST',
    signal: AbortSignal.timeout(env.openAiRequestTimeoutMs)
  });
  const responseText = await response.text().catch(() => '');
  const providerMessage = getOpenAiErrorMessage(responseText);
  const credentialAccepted = response.status === 400 &&
    /invalid.*sdp|invalid.*offer|invalid_offer/i.test(responseText);

  await writeInterpreterAuditEvent({
    context,
    meetingId: 'provider-diagnostic',
    metadata: {
      checkedAtIso: nowIso,
      credentialAccepted,
      providerStatus: response.status,
      targetLanguageCode: targetLanguage.code
    },
    summary: 'Ran interpreter realtime provider diagnostic.',
    type: 'INTERPRETER_REALTIME_PROVIDER_DIAGNOSTIC'
  });

  return {
    checkedAtIso: nowIso,
    credentialAccepted,
    expectedInvalidOfferResponse: credentialAccepted,
    model: session.realtimeModel,
    providerMessage: credentialAccepted ? 'Realtime credential was accepted by the provider.' : sanitizeProviderDiagnosticMessage(response.status, providerMessage),
    providerReachable: response.status < 500,
    providerStatus: response.status,
    targetLanguage
  };
}

async function createOpenAiInterpreterRealtimeSession(
  context: AuthorizedInterpreterContext,
  meeting: InterpreterMeetingRecord,
  targetLanguageCode?: string | null
) {
  if (!env.openAiApiKey) {
    throw validationError('Interpreter AI is not configured on the backend.');
  }

  if (meeting.status === 'ENDED') {
    throw validationError('This interpreter meeting has already ended.');
  }

  const targetLanguage = targetLanguageCode
    ? meeting.interpreterLanguages.find((language) => language.code === targetLanguageCode)
    : null;

  if (targetLanguageCode && !targetLanguage) {
    throw validationError('That language is not enabled for this interpreter meeting.');
  }

  if (!targetLanguage) {
    throw validationError('Choose a language before starting the live interpreter.');
  }

  assertRateLimit(`interpreter:realtime:${context.uid}`, 60_000, 60);

  const session = await requestOpenAiInterpreterRealtimeSession(context, targetLanguage);

  await writeInterpreterAuditEvent({
    context,
    meetingId: meeting.meetingId,
    metadata: {
      model: session.realtimeModel,
      targetLanguageCode: targetLanguage.code
    },
    summary: `Prepared realtime interpreter session for "${meeting.meetingName}".`,
    type: 'INTERPRETER_REALTIME_SESSION_PREPARED'
  });

  return session;
}

async function requestOpenAiInterpreterRealtimeSession(
  context: AuthorizedInterpreterContext,
  targetLanguage: InterpreterLanguage
) {
  if (!env.openAiApiKey) {
    throw validationError('Interpreter AI is not configured on the backend.');
  }

  const safetyIdentifier = createSafetyIdentifier(context.tenantId, context.uid);
  const realtimeModel = env.openAiInterpreterRealtimeModel.trim();
  const response = await fetch('https://api.openai.com/v1/realtime/translations/client_secrets', {
    body: JSON.stringify({
      session: {
        audio: {
          output: {
            language: toOpenAiTranslationLanguage(targetLanguage.code)
          }
        },
        model: realtimeModel
      }
    }),
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': safetyIdentifier
    },
    method: 'POST',
    signal: AbortSignal.timeout(env.openAiRequestTimeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('OpenAI interpreter realtime session failed:', {
      error: errorText.slice(0, 500),
      model: realtimeModel,
      status: response.status,
      targetLanguageCode: targetLanguage.code
    });
    throw serviceError(getOpenAiRealtimePreparationError(response.status));
  }

  const clientSecretResponse = await response.json() as Record<string, unknown>;
  const clientSecret = extractRealtimeClientSecret(clientSecretResponse);

  if (!clientSecret) {
    console.warn('OpenAI interpreter realtime session did not return a client secret.');
    throw serviceError('Interpreter realtime session could not be prepared.');
  }

  return {
    clientSecret,
    realtimeModel,
    safetyIdentifier,
    targetLanguage
  };
}

export async function createInterpreterSummary(
  decodedToken: DecodedIdToken,
  input: InterpreterSummaryInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  assertRateLimit(`interpreter:summary:${context.uid}`, 60_000, 10);
  const meeting = await readAccessibleMeeting(context, input.meetingId);

  if (!env.interpreterSummaryEnabled) {
    throw validationError('Interpreter summaries are disabled for this organization.');
  }

  const languageCodes = normalizeInterpreterLanguages(input.languageCodes).map((language) => language.code);
  const transcriptSnapshot = await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .collection(TRANSCRIPT_COLLECTION)
    .limit(250)
    .get();
  const transcriptText = transcriptSnapshot.docs
    .map((doc) => doc.data())
    .sort(compareRecordsByIso('asc'))
    .map((data) => {
      return data.text?.trim();
    })
    .filter((text): text is string => Boolean(text))
    .join('\n');

  if (!transcriptText) {
    throw validationError('There is no interpreted conversation to summarize yet.');
  }

  const summaryTextByLanguage = env.openAiApiKey
    ? await requestOpenAiMeetingSummary(meeting, languageCodes, transcriptText, context)
    : Object.fromEntries(languageCodes.map((languageCode) => [
        languageCode,
        'Summary is not available until OpenAI is configured on the backend.'
      ]));
  const nowIso = new Date().toISOString();
  const summaryId = `ism_${randomUUID().replace(/-/g, '')}`;
  const summary = stripUndefined({
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    createdByDisplayName: getDisplayName(context.user),
    createdByUid: context.uid,
    languageCodes,
    meetingId: input.meetingId,
    model: env.openAiInterpreterSummaryModel,
    summaryId,
    summaryTextByLanguage,
    tenantId: context.tenantId
  }) as InterpreterSummaryRecord & { createdAt: FirebaseFirestore.FieldValue };
  const summaryAudioByLanguage = await buildInterpreterSummaryAudioByLanguage(
    meeting,
    summary,
    languageCodes,
    context
  );

  await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .collection(SUMMARY_COLLECTION)
    .doc(summaryId)
    .set(summary);
  await writeInterpreterAuditEvent({
    context,
    meetingId: input.meetingId,
    metadata: {
      audioLanguageCodes: Object.keys(summaryAudioByLanguage),
      languageCodes,
      model: env.openAiInterpreterSummaryModel,
      speechModel: env.openAiInterpreterSummaryTtsModel,
      speechVoice: env.openAiInterpreterSummaryTtsVoice
    },
    summary: `Created interpreter meeting summary for "${meeting.meetingName}".`,
    type: 'INTERPRETER_SUMMARY_CREATED'
  });

  return { summary, summaryAudioByLanguage };
}

export async function createInterpreterSummaryAudio(
  decodedToken: DecodedIdToken,
  input: InterpreterSummaryAudioInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  assertRateLimit(`interpreter:summary-audio:${context.uid}`, 60_000, 20);
  const meeting = await readAccessibleMeeting(context, input.meetingId);

  if (!env.interpreterSummaryEnabled) {
    throw validationError('Interpreter summaries are disabled for this organization.');
  }

  const language = getSupportedLanguage(input.languageCode);
  const summarySnapshot = await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .collection(SUMMARY_COLLECTION)
    .doc(safeDocumentId(input.summaryId))
    .get();

  if (!summarySnapshot.exists) {
    throw notFoundError('Interpreter summary was not found.');
  }

  const summary = normalizeInterpreterSummaryRecord(summarySnapshot.data() as Partial<InterpreterSummaryRecord>);

  if (!summary || summary.meetingId !== input.meetingId || summary.tenantId !== context.tenantId) {
    throw notFoundError('Interpreter summary was not found.');
  }

  if (!summary.languageCodes.includes(language.code)) {
    throw validationError('That summary language is not available for this meeting summary.');
  }

  const audio = await requestOpenAiSummarySpeechAudio({
    context,
    language,
    meeting,
    summary,
    summaryText: summary.summaryTextByLanguage[language.code] || ''
  });

  await writeInterpreterAuditEvent({
    context,
    meetingId: input.meetingId,
    metadata: {
      languageCode: language.code,
      speechModel: env.openAiInterpreterSummaryTtsModel,
      speechVoice: env.openAiInterpreterSummaryTtsVoice,
      summaryId: summary.summaryId
    },
    summary: `Created spoken interpreter meeting summary for "${meeting.meetingName}".`,
    type: 'INTERPRETER_SUMMARY_AUDIO_CREATED'
  });

  return { audio };
}

let reminderWorkerTimer: NodeJS.Timeout | null = null;
let reminderWorkerRunning = false;

export function startInterpreterReminderWorker(): void {
  if (!env.interpreterReminderWorkerEnabled || reminderWorkerTimer) {
    return;
  }

  reminderWorkerTimer = setInterval(() => {
    void runInterpreterReminderDispatchCycle().catch((error) => {
      console.error('Interpreter reminder worker failed:', error);
    });
  }, env.interpreterReminderWorkerIntervalMs);
  reminderWorkerTimer.unref?.();

  void runInterpreterReminderDispatchCycle().catch((error) => {
    console.error('Interpreter reminder worker startup cycle failed:', error);
  });
}

export async function runInterpreterReminderDispatchCycle(now = new Date()) {
  if (reminderWorkerRunning) {
    return { claimed: 0, sent: 0, skipped: 0 };
  }

  reminderWorkerRunning = true;

  try {
    const nowIso = now.toISOString();
    const scheduledMeetingDocs = await listScheduledInterpreterReminderMeetingDocs();
    let claimed = 0;
    let sent = 0;
    let skipped = 0;

    for (const doc of scheduledMeetingDocs) {
      const meeting = normalizeMeetingRecord(doc.data() as Partial<InterpreterMeetingRecord>);

      if (!meeting || !isInterpreterReminderDue(meeting, nowIso)) {
        skipped += 1;
        continue;
      }

      const claim = await claimInterpreterReminder(doc.ref, nowIso);

      if (!claim) {
        skipped += 1;
        continue;
      }

      claimed += 1;

      try {
        await dispatchInterpreterReminder(claim.meeting, claim.claimId, nowIso);
        sent += 1;
      } catch (error) {
        await doc.ref.set({
          reminderDeliveryError: error instanceof Error ? error.message : 'Interpreter reminder delivery failed.',
          reminderDispatchClaimId: null,
          reminderDispatchClaimedAtIso: null,
          updatedAt: fieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString()
        }, { merge: true });
        console.error('Unable to send interpreter reminder:', error);
      }
    }

    return { claimed, sent, skipped };
  } finally {
    reminderWorkerRunning = false;
  }
}

async function listScheduledInterpreterReminderMeetingDocs(): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const organizationSnapshot = await firestore
    .collection('organizations')
    .where('status', '==', 'ACTIVE')
    .limit(env.interpreterReminderWorkerTenantBatchSize)
    .get();
  const scheduledMeetingDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const organizationDoc of organizationSnapshot.docs) {
    if (scheduledMeetingDocs.length >= env.interpreterReminderWorkerBatchSize) {
      break;
    }

    const organization = organizationDoc.data() as OrganizationRecord;

    if (organization.status !== 'ACTIVE') {
      continue;
    }

    const remainingBatchSize = env.interpreterReminderWorkerBatchSize - scheduledMeetingDocs.length;
    const meetingSnapshot = await organizationDoc.ref
      .collection(INTERPRETER_MEETINGS_COLLECTION)
      .where('status', '==', 'SCHEDULED')
      .limit(remainingBatchSize)
      .get();

    scheduledMeetingDocs.push(...meetingSnapshot.docs);
  }

  return scheduledMeetingDocs;
}

async function claimInterpreterReminder(
  meetingRef: FirebaseFirestore.DocumentReference,
  nowIso: string
): Promise<{ claimId: string; meeting: InterpreterMeetingRecord } | null> {
  const claimId = randomUUID();

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(meetingRef);
    const meeting = normalizeMeetingRecord(snapshot.data() as Partial<InterpreterMeetingRecord>);

    if (!meeting || !isInterpreterReminderDue(meeting, nowIso)) {
      return null;
    }

    transaction.update(meetingRef, {
      reminderDispatchClaimId: claimId,
      reminderDispatchClaimedAtIso: nowIso,
      updatedAt: fieldValue.serverTimestamp(),
      updatedAtIso: nowIso
    });

    return { claimId, meeting };
  });
}

async function dispatchInterpreterReminder(
  meeting: InterpreterMeetingRecord,
  claimId: string,
  nowIso: string
): Promise<void> {
  const recipientUids = Array.from(new Set([
    meeting.createdByUid,
    ...(meeting.invitedUserIds || [])
  ].filter(Boolean)));
  const notificationId = `interpreter_reminder_${meeting.meetingId}_${claimId.replace(/-/g, '')}`;
  const scheduledAt = meeting.scheduledAtIso ? new Date(meeting.scheduledAtIso) : null;
  const nextReminderAtIso = calculateNextReminderAtIso(meeting, nowIso);

  await sendInterpreterPushNotification({
    body: scheduledAt
      ? `${meeting.meetingName} starts ${formatReminderScheduledTime(scheduledAt)}.`
      : `${meeting.meetingName} is ready to start.`,
    meetingId: meeting.meetingId,
    metadata: {
      meetingType: meeting.meetingType,
      scheduledAtIso: meeting.scheduledAtIso || ''
    },
    notificationId,
    recipientUids,
    tenantId: meeting.tenantId,
    title: 'Interpreter meeting reminder',
    type: 'INTERPRETER_MEETING_REMINDER'
  });

  await firestore
    .collection('organizations')
    .doc(meeting.tenantId)
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(meeting.meetingId)
    .set({
      reminderDeliveredCount: fieldValue.increment(1),
      reminderDeliveryError: null,
      reminderDispatchClaimId: null,
      reminderDispatchClaimedAtIso: null,
      reminderLastSentAtIso: nowIso,
      reminderNextAtIso: nextReminderAtIso,
      updatedAt: fieldValue.serverTimestamp(),
      updatedAtIso: nowIso
    }, { merge: true });

  await firestore
    .collection('organizations')
    .doc(meeting.tenantId)
    .collection(INTERPRETER_AUDIT_COLLECTION)
    .doc()
    .set(stripUndefined({
      actorDisplayName: 'Synzapp Reminder Worker',
      actorRole: 'SYSTEM',
      actorUid: 'system',
      createdAt: fieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      meetingId: meeting.meetingId,
      metadata: {
        notificationId,
        recipientCount: recipientUids.length,
        reminderFrequency: meeting.reminderFrequency,
        reminderLeadMinutes: meeting.reminderLeadMinutes,
        reminderNextAtIso: nextReminderAtIso
      },
      summary: `Sent interpreter meeting reminder for "${meeting.meetingName}".`,
      tenantId: meeting.tenantId,
      type: 'INTERPRETER_MEETING_REMINDER_SENT'
    }));
}

async function requestOpenAiMeetingSummary(
  meeting: InterpreterMeetingRecord,
  languageCodes: string[],
  transcriptText: string,
  context: AuthorizedInterpreterContext
): Promise<Record<string, string>> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: [
                'You are Synzapp Interpreter. Summarize this workplace meeting in simple spoken language.',
                'Do not add facts that were not discussed.',
                `Meeting type: ${meeting.meetingType}.`,
                `Return valid JSON keyed by these language codes: ${languageCodes.join(', ')}.`,
                'Each value must be a concise summary in that language.',
                '',
                transcriptText
              ].join('\n'),
              type: 'input_text'
            }
          ],
          role: 'user'
        }
      ],
      model: env.openAiInterpreterSummaryModel,
      text: {
        format: {
          type: 'json_object'
        }
      }
    }),
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(context.tenantId, context.uid)
    },
    method: 'POST',
    signal: AbortSignal.timeout(env.openAiRequestTimeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('OpenAI interpreter summary failed:', response.status, errorText.slice(0, 300));
    throw serviceError('Interpreter summary could not be created.');
  }

  const body = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const outputText = body.output_text ||
    body.output?.flatMap((item) => item.content || []).map((content) => content.text).filter(Boolean).join('\n') ||
    '{}';

  try {
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    return Object.fromEntries(languageCodes.map((languageCode) => [
      languageCode,
      typeof parsed[languageCode] === 'string' && parsed[languageCode].trim()
        ? parsed[languageCode].trim()
        : 'Summary is not available in this language yet.'
    ]));
  } catch {
    return Object.fromEntries(languageCodes.map((languageCode, index) => [
      languageCode,
      index === 0 ? outputText.trim() : 'Summary is not available in this language yet.'
    ]));
  }
}

async function buildInterpreterSummaryAudioByLanguage(
  meeting: InterpreterMeetingRecord,
  summary: InterpreterSummaryRecord,
  languageCodes: string[],
  context: AuthorizedInterpreterContext
): Promise<Record<string, InterpreterSummaryAudio>> {
  if (!env.openAiApiKey || !env.interpreterSummaryAudioEnabled) {
    return {};
  }

  const audioEntries = await Promise.all(languageCodes.map(async (languageCode) => {
    const language = getSupportedLanguage(languageCode);
    const summaryText = summary.summaryTextByLanguage[language.code] || '';

    if (!summaryText.trim()) {
      return null;
    }

    try {
      const audio = await requestOpenAiSummarySpeechAudio({
        context,
        language,
        meeting,
        summary,
        summaryText
      });

      return [language.code, audio] as const;
    } catch (error) {
      console.warn('OpenAI interpreter summary speech failed:', {
        languageCode: language.code,
        meetingId: meeting.meetingId,
        message: error instanceof Error ? error.message : 'Unknown summary speech error',
        summaryId: summary.summaryId
      });

      return null;
    }
  }));

  return Object.fromEntries(audioEntries.filter((entry): entry is readonly [string, InterpreterSummaryAudio] =>
    Boolean(entry)
  ));
}

async function requestOpenAiSummarySpeechAudio({
  context,
  language,
  meeting,
  summary,
  summaryText
}: {
  context: AuthorizedInterpreterContext;
  language: InterpreterLanguage;
  meeting: InterpreterMeetingRecord;
  summary: InterpreterSummaryRecord;
  summaryText: string;
}): Promise<InterpreterSummaryAudio> {
  if (!env.openAiApiKey) {
    throw serviceError('Interpreter spoken summary is not configured on the backend.');
  }

  if (!env.interpreterSummaryAudioEnabled) {
    throw validationError('Interpreter spoken summaries are disabled for this organization.');
  }

  const cleanSummaryText = summaryText.trim();

  if (!cleanSummaryText) {
    throw validationError('There is no summary text to speak in this language yet.');
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    body: JSON.stringify({
      input: [
        `Speak this Synzapp interpreter meeting summary in ${language.label}.`,
        'Use clear, calm, simple workplace language.',
        'Do not add new facts.',
        `Meeting name: ${meeting.meetingName}.`,
        '',
        cleanSummaryText
      ].join('\n'),
      model: env.openAiInterpreterSummaryTtsModel,
      response_format: 'mp3',
      voice: env.openAiInterpreterSummaryTtsVoice
    }),
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(context.tenantId, context.uid)
    },
    method: 'POST',
    signal: AbortSignal.timeout(env.openAiRequestTimeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.warn('OpenAI interpreter summary speech failed:', {
      error: errorText.slice(0, 300),
      languageCode: language.code,
      model: env.openAiInterpreterSummaryTtsModel,
      status: response.status,
      summaryId: summary.summaryId
    });
    throw serviceError('Interpreter spoken summary could not be created.');
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'audio/mpeg';

  return {
    audioBase64: audioBuffer.toString('base64'),
    contentType,
    format: 'mp3',
    languageCode: language.code,
    model: env.openAiInterpreterSummaryTtsModel,
    voice: env.openAiInterpreterSummaryTtsVoice
  };
}

async function readAccessibleMeeting(
  context: AuthorizedInterpreterContext,
  meetingId: string
): Promise<InterpreterMeetingRecord> {
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(safeDocumentId(meetingId));
  const snapshot = await meetingRef.get();

  if (!snapshot.exists) {
    throw notFoundError('Interpreter meeting was not found.');
  }

  const meeting = normalizeMeetingRecord(snapshot.data() as Partial<InterpreterMeetingRecord>);

  if (!meeting || meeting.tenantId !== context.tenantId || !canAccessInterpreterMeeting(context, meeting)) {
    throw authorizationError('You do not have access to this interpreter meeting.');
  }

  if (meeting.deletedAtIso) {
    throw notFoundError('Interpreter meeting was not found.');
  }

  return meeting;
}

function normalizeRealtimeOfferSdp(offerSdp: string): string {
  const normalizedOfferSdp = offerSdp.replace(/\r?\n/g, '\r\n').trimEnd();

  if (!normalizedOfferSdp.startsWith('v=0')) {
    throw validationError('The device sent an invalid realtime audio offer.');
  }

  if (!containsRealtimeAudioMediaSection(normalizedOfferSdp)) {
    throw validationError('The device realtime audio offer did not include a microphone media lane.');
  }

  return `${normalizedOfferSdp}\r\n`;
}

function containsRealtimeAudioMediaSection(offerSdp: string): boolean {
  return /(^|\r?\n)m=audio\s+/i.test(offerSdp);
}

function canAccessInterpreterMeeting(
  context: AuthorizedInterpreterContext,
  meeting: InterpreterMeetingRecord
): boolean {
  return canManageInterpreterMeeting(context, meeting) || meeting.invitedUserIds?.includes(context.uid) === true;
}

function canManageInterpreterMeeting(
  context: AuthorizedInterpreterContext,
  meeting: InterpreterMeetingRecord
): boolean {
  return context.role === 'ORG_ADMIN' ||
    context.role === 'SYSTEM_ADMIN' ||
    meeting.createdByUid === context.uid ||
    context.permissions.includes('interpreter.manage') ||
    context.permissions.includes('tenant.update');
}

function canRunInterpreterProviderDiagnostic(context: AuthorizedInterpreterContext): boolean {
  return context.role === 'ORG_ADMIN' ||
    context.role === 'SYSTEM_ADMIN' ||
    context.permissions.includes('interpreter.manage') ||
    context.permissions.includes('tenant.update');
}

function getSupportedLanguage(languageCode: string): InterpreterLanguage {
  const language = LANGUAGE_BY_CODE.get(languageCode);

  if (!language) {
    throw validationError('The selected interpreter language is not supported yet.');
  }

  return language;
}

function sortRecordsByIso<T extends { createdAtIso?: unknown }>(records: T[], direction: 'asc' | 'desc'): T[] {
  return [...records].sort(compareRecordsByIso(direction));
}

function compareRecordsByIso(direction: 'asc' | 'desc') {
  return (left: { createdAtIso?: unknown }, right: { createdAtIso?: unknown }) => {
    const leftIso = typeof left.createdAtIso === 'string' ? left.createdAtIso : '';
    const rightIso = typeof right.createdAtIso === 'string' ? right.createdAtIso : '';
    const comparison = leftIso.localeCompare(rightIso);

    return direction === 'asc' ? comparison : -comparison;
  };
}

async function normalizeInvitedUserIds(
  context: AuthorizedInterpreterContext,
  invitedUserIds: string[]
): Promise<string[]> {
  const uniqueIds = [...new Set(invitedUserIds.map((uid) => safeDocumentId(uid)).filter(Boolean))]
    .filter((uid) => uid !== context.uid)
    .slice(0, 50);

  if (!uniqueIds.length) {
    return [];
  }

  const userSnapshots = await Promise.all(uniqueIds.map((uid) =>
    context.organizationRef.collection('users').doc(uid).get()
  ));
  const activeUserIds = userSnapshots
    .map((snapshot) => {
      if (!snapshot.exists) {
        return null;
      }

      const user = snapshot.data() as TenantUserRecord;

      return user.status === 'ACTIVE' && (!user.tenantId || user.tenantId === context.tenantId)
        ? snapshot.id
        : null;
    })
    .filter((uid): uid is string => Boolean(uid));

  if (activeUserIds.length !== uniqueIds.length) {
    throw validationError('One or more selected interpreter participants are not active company users.');
  }

  return activeUserIds;
}

function normalizeMeetingRecord(meeting: Partial<InterpreterMeetingRecord>): InterpreterMeetingRecord | null {
  if (!meeting.meetingId || !meeting.tenantId || !meeting.createdByUid || !meeting.meetingName) {
    return null;
  }

  return {
    ...meeting,
    autoDetectSourceLanguage: meeting.autoDetectSourceLanguage !== false,
    createdAtIso: meeting.createdAtIso || meeting.updatedAtIso || new Date(0).toISOString(),
    deletedAtIso: meeting.deletedAtIso || null,
    deletedByDisplayName: meeting.deletedByDisplayName || null,
    deletedByUid: meeting.deletedByUid || null,
    interpreterLanguages: Array.isArray(meeting.interpreterLanguages) ? meeting.interpreterLanguages : [],
    invitedUserIds: Array.isArray(meeting.invitedUserIds) ? meeting.invitedUserIds.filter((uid) => typeof uid === 'string') : [],
    reminderDeliveredCount: typeof meeting.reminderDeliveredCount === 'number' ? meeting.reminderDeliveredCount : 0,
    reminderDispatchClaimId: meeting.reminderDispatchClaimId || null,
    reminderDispatchClaimedAtIso: meeting.reminderDispatchClaimedAtIso || null,
    reminderFrequency: meeting.reminderFrequency || 'none',
    reminderLastSentAtIso: meeting.reminderLastSentAtIso || null,
    reminderLeadMinutes: typeof meeting.reminderLeadMinutes === 'number' ? meeting.reminderLeadMinutes : null,
    reminderNextAtIso: meeting.reminderNextAtIso || calculateInitialReminderNextAtIso(
      meeting.scheduledAtIso || null,
      meeting.reminderFrequency || 'none',
      typeof meeting.reminderLeadMinutes === 'number' ? meeting.reminderLeadMinutes : null,
      meeting.createdAtIso || meeting.updatedAtIso || new Date().toISOString()
    ),
    scheduledAtIso: meeting.scheduledAtIso || null,
    sourceLanguageCode: meeting.sourceLanguageCode || null,
    status: meeting.status || 'LIVE',
    updatedAtIso: meeting.updatedAtIso || meeting.createdAtIso || new Date(0).toISOString()
  } as InterpreterMeetingRecord;
}

function normalizeInterpreterSummaryRecord(summary: Partial<InterpreterSummaryRecord>): InterpreterSummaryRecord | null {
  if (!summary.summaryId || !summary.meetingId || !summary.tenantId) {
    return null;
  }

  return {
    ...summary,
    createdAtIso: summary.createdAtIso || new Date(0).toISOString(),
    meetingId: summary.meetingId,
    summaryId: summary.summaryId,
    tenantId: summary.tenantId,
    languageCodes: Array.isArray(summary.languageCodes)
      ? summary.languageCodes.filter((languageCode) => typeof languageCode === 'string')
      : [],
    summaryTextByLanguage: typeof summary.summaryTextByLanguage === 'object' && summary.summaryTextByLanguage
      ? Object.fromEntries(Object.entries(summary.summaryTextByLanguage).filter((entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
        ))
      : {}
  };
}

async function getAuthorizedInterpreterContext(decodedToken: DecodedIdToken): Promise<AuthorizedInterpreterContext> {
  const session = await buildAuthSession(decodedToken);
  const { permissions, role, status, tenantId } = session.user;

  if (session.access !== 'ACTIVE' || status !== 'ACTIVE' || !tenantId || !role) {
    throw authorizationError('Your profile is not active.');
  }

  const organizationRef = firestore.collection('organizations').doc(tenantId);
  const [organizationSnapshot, userSnapshot] = await Promise.all([
    organizationRef.get(),
    organizationRef.collection('users').doc(decodedToken.uid).get()
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
    organizationRef,
    permissions,
    role,
    tenantId,
    user,
    uid: decodedToken.uid
  };
}

function normalizeInterpreterLanguages(languageCodes: string[]): InterpreterLanguage[] {
  const requestedCodes = ['en-US', ...languageCodes]
    .map((code) => code.trim())
    .filter(Boolean);
  const uniqueCodes = [...new Set(requestedCodes)];

  if (uniqueCodes.length > env.interpreterMaxTargetLanguages) {
    throw validationError(`Interpreter meetings support up to ${env.interpreterMaxTargetLanguages} target languages.`);
  }

  const languages = uniqueCodes.map((code) => LANGUAGE_BY_CODE.get(code));

  if (languages.some((language) => !language)) {
    throw validationError('One or more interpreter languages are not supported yet.');
  }

  return languages as InterpreterLanguage[];
}

function calculateInitialReminderNextAtIso(
  scheduledAtIso: string | null,
  reminderFrequency: InterpreterMeetingRecord['reminderFrequency'],
  reminderLeadMinutes: number | null,
  nowIso: string
): string | null {
  if (!scheduledAtIso || reminderFrequency === 'none' || typeof reminderLeadMinutes !== 'number') {
    return null;
  }

  const scheduledAtMs = Date.parse(scheduledAtIso);

  if (!Number.isFinite(scheduledAtMs)) {
    return null;
  }

  const nowMs = Date.parse(nowIso);
  const firstDueMs = scheduledAtMs - reminderLeadMinutes * 60_000;

  if (scheduledAtMs <= nowMs) {
    return null;
  }

  return new Date(Math.max(firstDueMs, nowMs)).toISOString();
}

function calculateNextReminderAtIso(
  meeting: InterpreterMeetingRecord,
  nowIso: string
): string | null {
  if (
    !meeting.scheduledAtIso ||
    meeting.reminderFrequency === 'none' ||
    meeting.reminderFrequency === 'once' ||
    typeof meeting.reminderLeadMinutes !== 'number'
  ) {
    return null;
  }

  const scheduledAtMs = Date.parse(meeting.scheduledAtIso);
  const nowMs = Date.parse(nowIso);
  const intervalMs = meeting.reminderFrequency === 'daily'
    ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(scheduledAtMs) || scheduledAtMs <= nowMs) {
    return null;
  }

  let nextDueMs = nowMs + intervalMs;

  while (nextDueMs < nowMs) {
    nextDueMs += intervalMs;
  }

  return nextDueMs < scheduledAtMs ? new Date(nextDueMs).toISOString() : null;
}

function isInterpreterReminderDue(meeting: InterpreterMeetingRecord, nowIso: string): boolean {
  if (meeting.status !== 'SCHEDULED' || meeting.reminderFrequency === 'none') {
    return false;
  }

  const scheduledAtMs = meeting.scheduledAtIso ? Date.parse(meeting.scheduledAtIso) : Number.NaN;
  const nowMs = Date.parse(nowIso);
  const nextAtIso = meeting.reminderNextAtIso || calculateInitialReminderNextAtIso(
    meeting.scheduledAtIso,
    meeting.reminderFrequency,
    meeting.reminderLeadMinutes,
    nowIso
  );
  const nextAtMs = nextAtIso ? Date.parse(nextAtIso) : Number.NaN;

  return Number.isFinite(scheduledAtMs) &&
    Number.isFinite(nowMs) &&
    Number.isFinite(nextAtMs) &&
    scheduledAtMs > nowMs &&
    nextAtMs <= nowMs;
}

function formatReminderScheduledTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short'
  }).format(date);
}

function validateCreateInterpreterMeetingInput(input: CreateInterpreterMeetingInput) {
  if (input.autoDetectSourceLanguage === false) {
    const sourceLanguageCode = input.sourceLanguageCode || 'en-US';

    if (!LANGUAGE_BY_CODE.has(sourceLanguageCode)) {
      throw validationError('The selected speaker language is not supported yet.');
    }
  }

  if (input.scheduledAtIso) {
    const scheduledAt = Date.parse(input.scheduledAtIso);

    if (!Number.isFinite(scheduledAt)) {
      throw validationError('The scheduled meeting date is invalid.');
    }

    if (scheduledAt < Date.now() - 60_000) {
      throw validationError('Scheduled interpreter meetings must be set for a future time.');
    }
  }

  if (input.reminderFrequency && input.reminderFrequency !== 'none' && !input.scheduledAtIso) {
    throw validationError('A reminder requires a scheduled meeting date and time.');
  }
}

function buildRealtimeInstructions(
  meeting: InterpreterMeetingRecord,
  targetLanguage: InterpreterLanguage
): string {
  const languageList = meeting.interpreterLanguages.map((language) => `${language.label} (${language.code})`).join(', ');

  return [
    'You are Synzapp AI Interpreter for a workplace meeting.',
    'Listen continuously and prepare clean, simple spoken interpretations while people are speaking.',
    'Do not answer as an assistant or add opinions.',
    'Only interpret the meaning of what the speaker said.',
    'Correct obvious grammar, filler, and mumbling into clear spoken language while preserving intent.',
    'Use a calm professional human-interpreter tone.',
    `Interpret the live source audio into ${targetLanguage.label}.`,
    `Meeting type: ${meeting.meetingType}.`,
    `Meeting languages enabled in Synzapp: ${languageList}.`,
    'English is always available as a default interpretation language.',
    'Never use or reference Synzapp chat messages.'
  ].join('\n');
}

function toOpenAiTranslationLanguage(languageCode: string): string {
  return languageCode.split('-')[0]?.toLowerCase() || languageCode.toLowerCase();
}

function extractRealtimeClientSecret(response: Record<string, unknown>): string | null {
  const directClientSecret = response.client_secret;

  if (typeof directClientSecret === 'string') {
    return directClientSecret;
  }

  if (
    directClientSecret &&
    typeof directClientSecret === 'object' &&
    'value' in directClientSecret &&
    typeof (directClientSecret as { value?: unknown }).value === 'string'
  ) {
    return (directClientSecret as { value: string }).value;
  }

  if (typeof response.value === 'string') {
    return response.value;
  }

  return null;
}

function getOpenAiRealtimePreparationError(status: number): string {
  if (status === 400) {
    return 'Interpreter realtime request was rejected by the AI provider configuration.';
  }

  if (status === 401) {
    return 'Interpreter AI credentials are not valid on the backend.';
  }

  if (status === 403) {
    return 'Interpreter realtime access is not enabled for this AI project.';
  }

  if (status === 404) {
    return 'Interpreter realtime model or endpoint is not available for this AI project.';
  }

  if (status === 408 || status === 504) {
    return 'Interpreter realtime setup timed out. Please try again.';
  }

  if (status === 429) {
    return 'Interpreter realtime setup is rate limited or out of quota.';
  }

  if (status >= 500) {
    return 'Interpreter realtime provider is temporarily unavailable.';
  }

  return 'Interpreter realtime session could not be prepared.';
}

function getOpenAiRealtimeSdpExchangeError(status: number, errorText = ''): string {
  if (status === 400) {
    const detail = getOpenAiErrorMessage(errorText);

    return detail
      ? sanitizeRealtimeSdpExchangeError(detail)
      : 'Interpreter realtime audio offer was rejected by the AI provider.';
  }

  if (status === 401 || status === 403) {
    return 'Interpreter realtime authorization was rejected during audio setup.';
  }

  if (status === 404) {
    return 'Interpreter realtime audio endpoint is not available for this AI project.';
  }

  if (status === 408 || status === 504) {
    return 'Interpreter realtime audio setup timed out. Please try again.';
  }

  if (status === 429) {
    return 'Interpreter realtime audio setup is rate limited or out of quota.';
  }

  if (status >= 500) {
    return 'Interpreter realtime audio provider is temporarily unavailable.';
  }

  return 'Interpreter realtime audio could not be prepared.';
}

function sanitizeRealtimeSdpExchangeError(detail: string): string {
  if (/unmarshal SDP|parse offer|sdp/i.test(detail)) {
    return 'Interpreter realtime audio could not read a valid microphone connection. Please close the live interpreter and start it again.';
  }

  return `Interpreter realtime audio offer was rejected: ${detail}`;
}

function sanitizeProviderDiagnosticMessage(status: number, providerMessage: string): string {
  if (status === 401) {
    return 'Realtime credentials were rejected by the provider.';
  }

  if (status === 403) {
    return 'Realtime translation access is not enabled for this AI project.';
  }

  if (status === 429) {
    return 'Realtime translation is rate limited or out of quota.';
  }

  if (status >= 500) {
    return 'Realtime translation provider is temporarily unavailable.';
  }

  return providerMessage || 'Realtime translation provider check did not pass.';
}

function getDiagnosticRealtimeOfferSdp(): string {
  return [
    'v=0',
    'o=- 46117317 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 0.0.0.0',
    'a=rtpmap:111 opus/48000/2',
    ''
  ].join('\r\n');
}

function getOpenAiErrorMessage(errorText: string): string {
  if (!errorText.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(errorText) as { error?: { message?: unknown }; message?: unknown };
    const message = typeof parsed.error?.message === 'string'
      ? parsed.error.message
      : typeof parsed.message === 'string'
        ? parsed.message
        : '';

    return message.slice(0, 220);
  } catch {
    return errorText.slice(0, 220);
  }
}

async function writeInterpreterAuditEvent({
  context,
  meetingId,
  metadata,
  summary,
  type
}: {
  context: AuthorizedInterpreterContext;
  meetingId: string;
  metadata?: Record<string, unknown>;
  summary: string;
  type: string;
}) {
  const eventId = `int_evt_${randomUUID().replace(/-/g, '')}`;
  const nowIso = new Date().toISOString();
  const event = stripUndefined({
    actorDisplayName: getDisplayName(context.user),
    actorRole: context.role,
    actorUid: context.uid,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    eventId,
    meetingId,
    metadata: metadata || {},
    summary,
    tenantId: context.tenantId,
    type
  });

  await context.organizationRef.collection(INTERPRETER_AUDIT_COLLECTION).doc(eventId).set(event);
}

function getDisplayName(user: TenantUserRecord): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.displayName?.trim() || fullName || 'Synzapp user';
}

function safeDocumentId(value: string): string {
  return value.replace(/[/.#[\]\s]/g, '_').slice(0, 128);
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

function createSafetyIdentifier(tenantId: string, uid: string): string {
  return createHash('sha256')
    .update(`${tenantId}:${uid}`)
    .digest('hex');
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

function authorizationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthorizationError';
  return error;
}

function notFoundError(message: string): Error {
  const error = new Error(message);
  error.name = 'NotFoundError';
  return error;
}

function serviceError(message: string): Error {
  const error = new Error(message);
  error.name = 'TranslationServiceError';
  return error;
}
