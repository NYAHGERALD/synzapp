import { createHash, randomUUID } from 'node:crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';
import { assertRateLimit } from '../middleware/rateLimit.js';
import { SynzappRole } from '../types/auth.js';
import { buildAuthSession } from './authSessionService.js';

export type InterpreterMeetingType = 'LEVEL_1' | 'LEVEL_3' | 'ONE_ON_ONE';
export type InterpreterMeetingStatus = 'ENDED' | 'LIVE' | 'SCHEDULED';

export interface InterpreterLanguage {
  code: string;
  label: string;
}

export interface CreateInterpreterMeetingInput {
  autoDetectSourceLanguage?: boolean;
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
  endedAtIso?: string | null;
  interpreterLanguages: InterpreterLanguage[];
  meetingId: string;
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderFrequency: 'daily' | 'none' | 'once' | 'weekly';
  reminderLeadMinutes: number | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
  status: InterpreterMeetingStatus;
  tenantId: string;
  updatedAt?: FirebaseFirestore.FieldValue;
  updatedAtIso: string;
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
  const snapshot = await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .where('createdByUid', '==', context.uid)
    .orderBy('updatedAtIso', 'desc')
    .limit(50)
    .get();

  return {
    meetings: snapshot.docs.map((doc) => doc.data() as InterpreterMeetingRecord),
    supportedLanguages: SUPPORTED_LANGUAGES
  };
}

export async function createInterpreterMeeting(
  decodedToken: DecodedIdToken,
  input: CreateInterpreterMeetingInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  assertRateLimit(`interpreter:create:${context.uid}`, 60_000, 20);

  const nowIso = new Date().toISOString();
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc();
  const meetingId = meetingRef.id;
  const interpreterLanguages = normalizeInterpreterLanguages(input.interpreterLanguageCodes);
  const record: InterpreterMeetingRecord = {
    autoDetectSourceLanguage: input.autoDetectSourceLanguage !== false,
    createdAt: fieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    createdByDisplayName: getDisplayName(context.user),
    createdByUid: context.uid,
    endedAtIso: null,
    interpreterLanguages,
    meetingId,
    meetingName: input.meetingName.trim(),
    meetingType: input.meetingType,
    reminderFrequency: input.reminderFrequency || 'none',
    reminderLeadMinutes: typeof input.reminderLeadMinutes === 'number' ? input.reminderLeadMinutes : null,
    scheduledAtIso: input.scheduledAtIso || null,
    sourceLanguageCode: input.autoDetectSourceLanguage === false ? input.sourceLanguageCode || 'en-US' : null,
    status: input.scheduledAtIso ? 'SCHEDULED' : 'LIVE',
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
      meetingType: record.meetingType,
      scheduledAtIso: record.scheduledAtIso
    },
    summary: `Created interpreter meeting "${record.meetingName}".`,
    type: 'INTERPRETER_MEETING_CREATED'
  });

  return { meeting: record };
}

export async function getInterpreterMeeting(decodedToken: DecodedIdToken, meetingId: string) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);
  const [transcriptsSnapshot, translationsSnapshot, summariesSnapshot, auditSnapshot] = await Promise.all([
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(TRANSCRIPT_COLLECTION).orderBy('createdAtIso', 'asc').limit(200).get(),
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(TRANSLATION_COLLECTION).orderBy('createdAtIso', 'asc').limit(300).get(),
    context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(meetingId)
      .collection(SUMMARY_COLLECTION).orderBy('createdAtIso', 'desc').limit(20).get(),
    context.organizationRef.collection(INTERPRETER_AUDIT_COLLECTION)
      .where('meetingId', '==', meetingId)
      .orderBy('createdAtIso', 'desc')
      .limit(50)
      .get()
  ]);

  return {
    auditEvents: auditSnapshot.docs.map((doc) => doc.data()),
    meeting,
    summaries: summariesSnapshot.docs.map((doc) => doc.data()),
    transcripts: transcriptsSnapshot.docs.map((doc) => doc.data()),
    translations: translationsSnapshot.docs.map((doc) => doc.data())
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

  return { translation };
}

export async function createInterpreterRealtimeClientSecret(
  decodedToken: DecodedIdToken,
  meetingId: string,
  targetLanguageCode?: string | null
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, meetingId);

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

  assertRateLimit(`interpreter:realtime:${context.uid}`, 60_000, 60);

  const safetyIdentifier = createSafetyIdentifier(context.tenantId, context.uid);
  const instructions = buildRealtimeInstructions(meeting, targetLanguage || null);
  const response = await fetch('https://api.openai.com/v1/realtime/translations/client_secrets', {
    body: JSON.stringify({
      session: {
        instructions,
        model: env.openAiInterpreterRealtimeModel
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
    console.warn('OpenAI interpreter realtime session failed:', response.status, errorText.slice(0, 300));
    throw serviceError('Interpreter realtime session could not be prepared.');
  }

  const clientSecret = await response.json() as Record<string, unknown>;

  await writeInterpreterAuditEvent({
    context,
    meetingId,
    metadata: {
      model: env.openAiInterpreterRealtimeModel,
      targetLanguageCode: targetLanguage?.code || 'multi-language'
    },
    summary: `Prepared realtime interpreter session for "${meeting.meetingName}".`,
    type: 'INTERPRETER_REALTIME_SESSION_PREPARED'
  });

  return {
    clientSecret,
    expiresWithSession: true,
    model: env.openAiInterpreterRealtimeModel
  };
}

export async function createInterpreterSummary(
  decodedToken: DecodedIdToken,
  input: InterpreterSummaryInput
) {
  const context = await getAuthorizedInterpreterContext(decodedToken);
  const meeting = await readAccessibleMeeting(context, input.meetingId);

  if (!env.interpreterSummaryEnabled) {
    throw validationError('Interpreter summaries are disabled for this organization.');
  }

  const languageCodes = normalizeInterpreterLanguages(input.languageCodes).map((language) => language.code);
  const transcriptSnapshot = await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .collection(TRANSCRIPT_COLLECTION)
    .orderBy('createdAtIso', 'asc')
    .limit(250)
    .get();
  const transcriptText = transcriptSnapshot.docs
    .map((doc) => {
      const data = doc.data() as { text?: string };
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
  });

  await context.organizationRef
    .collection(INTERPRETER_MEETINGS_COLLECTION)
    .doc(input.meetingId)
    .collection(SUMMARY_COLLECTION)
    .doc(summaryId)
    .set(summary);
  await writeInterpreterAuditEvent({
    context,
    meetingId: input.meetingId,
    metadata: { languageCodes, model: env.openAiInterpreterSummaryModel },
    summary: `Created interpreter meeting summary for "${meeting.meetingName}".`,
    type: 'INTERPRETER_SUMMARY_CREATED'
  });

  return { summary };
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

async function readAccessibleMeeting(
  context: AuthorizedInterpreterContext,
  meetingId: string
): Promise<InterpreterMeetingRecord> {
  const meetingRef = context.organizationRef.collection(INTERPRETER_MEETINGS_COLLECTION).doc(safeDocumentId(meetingId));
  const snapshot = await meetingRef.get();

  if (!snapshot.exists) {
    throw notFoundError('Interpreter meeting was not found.');
  }

  const meeting = snapshot.data() as InterpreterMeetingRecord;

  if (meeting.tenantId !== context.tenantId || !canAccessInterpreterMeeting(context, meeting)) {
    throw authorizationError('You do not have access to this interpreter meeting.');
  }

  return meeting;
}

function canAccessInterpreterMeeting(
  context: AuthorizedInterpreterContext,
  meeting: InterpreterMeetingRecord
): boolean {
  return context.role === 'ORG_ADMIN' ||
    context.role === 'SYSTEM_ADMIN' ||
    meeting.createdByUid === context.uid ||
    context.permissions.includes('interpreter.manage') ||
    context.permissions.includes('tenant.update');
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

function buildRealtimeInstructions(
  meeting: InterpreterMeetingRecord,
  targetLanguage: InterpreterLanguage | null
): string {
  const languageList = meeting.interpreterLanguages.map((language) => `${language.label} (${language.code})`).join(', ');
  const targetInstruction = targetLanguage
    ? `When asked to respond, interpret into ${targetLanguage.label}.`
    : `Prepare interpretation options for these languages: ${languageList}.`;

  return [
    'You are Synzapp AI Interpreter for a workplace meeting.',
    'Listen continuously and prepare clean, simple spoken interpretations while people are speaking.',
    'Do not answer as an assistant or add opinions.',
    'Only interpret the meaning of what the speaker said.',
    'Correct obvious grammar, filler, and mumbling into clear spoken language while preserving intent.',
    'Use a calm professional human-interpreter tone.',
    targetInstruction,
    `Meeting type: ${meeting.meetingType}.`,
    'English is always available as a default interpretation language.',
    'Never use or reference Synzapp chat messages.'
  ].join('\n');
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
