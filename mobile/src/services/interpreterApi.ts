import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

export type InterpreterMeetingType = 'LEVEL_1' | 'LEVEL_3' | 'ONE_ON_ONE';
export type InterpreterMeetingStatus = 'ENDED' | 'LIVE' | 'SCHEDULED';

export interface InterpreterLanguage {
  code: string;
  label: string;
}

export interface InterpreterMeeting {
  autoDetectSourceLanguage: boolean;
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
  updatedAtIso: string;
}

export interface InterpreterSegment {
  createdAtIso: string;
  detectedLanguageCode?: string | null;
  segmentId?: string;
  sourceLanguageCode?: string | null;
  text: string;
}

export interface InterpreterTranslationSegment {
  createdAtIso: string;
  sourceSegmentId?: string | null;
  sourceText: string;
  targetLanguageCode: string;
  translatedText: string;
  translationId?: string;
}

export interface InterpreterSummary {
  createdAtIso: string;
  languageCodes: string[];
  summaryId: string;
  summaryTextByLanguage: Record<string, string>;
}

export interface InterpreterMeetingDetails {
  auditEvents: unknown[];
  meeting: InterpreterMeeting;
  summaries: InterpreterSummary[];
  transcripts: InterpreterSegment[];
  translations: InterpreterTranslationSegment[];
}

export interface InterpreterRealtimeClientSecretResponse {
  clientSecret: unknown;
  expiresWithSession: boolean;
  model: string;
}

export interface CreateInterpreterMeetingInput {
  autoDetectSourceLanguage: boolean;
  interpreterLanguageCodes: string[];
  meetingName: string;
  meetingType: InterpreterMeetingType;
  reminderFrequency: 'daily' | 'none' | 'once' | 'weekly';
  reminderLeadMinutes: number | null;
  scheduledAtIso: string | null;
  sourceLanguageCode: string | null;
}

export async function listInterpreterMeetings(idToken: string) {
  const response = await interpreterFetch(idToken, '/meetings');

  return response.json() as Promise<{
    meetings: InterpreterMeeting[];
    supportedLanguages: InterpreterLanguage[];
  }>;
}

export async function listInterpreterLanguages(idToken: string) {
  const response = await interpreterFetch(idToken, '/languages');

  return response.json() as Promise<{ languages: InterpreterLanguage[] }>;
}

export async function createInterpreterMeeting(idToken: string, input: CreateInterpreterMeetingInput) {
  const response = await interpreterFetch(idToken, '/meetings', {
    body: JSON.stringify(input),
    method: 'POST'
  });

  return response.json() as Promise<{ meeting: InterpreterMeeting }>;
}

export async function getInterpreterMeeting(idToken: string, meetingId: string) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}`);

  return response.json() as Promise<InterpreterMeetingDetails>;
}

export async function startInterpreterMeeting(idToken: string, meetingId: string) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/start`, {
    method: 'POST'
  });

  return response.json() as Promise<{ meeting: InterpreterMeeting }>;
}

export async function endInterpreterMeeting(idToken: string, meetingId: string) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/end`, {
    method: 'POST'
  });

  return response.json() as Promise<{ meeting: InterpreterMeeting }>;
}

export async function createInterpreterRealtimeClientSecret(
  idToken: string,
  meetingId: string,
  targetLanguageCode?: string | null
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/realtime-client-secret`, {
    body: JSON.stringify({ targetLanguageCode: targetLanguageCode || null }),
    method: 'POST'
  });

  return response.json() as Promise<InterpreterRealtimeClientSecretResponse>;
}

export async function addInterpreterTranscriptSegment(
  idToken: string,
  meetingId: string,
  text: string,
  detectedLanguageCode?: string | null
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/transcripts`, {
    body: JSON.stringify({ detectedLanguageCode: detectedLanguageCode || null, text }),
    method: 'POST'
  });

  return response.json() as Promise<{ segment: InterpreterSegment }>;
}

export async function addInterpreterTranslationSegment(
  idToken: string,
  meetingId: string,
  input: {
    sourceSegmentId?: string | null;
    sourceText: string;
    targetLanguageCode: string;
    translatedText: string;
  }
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/translations`, {
    body: JSON.stringify(input),
    method: 'POST'
  });

  return response.json() as Promise<{ translation: InterpreterTranslationSegment }>;
}

export async function createInterpreterSummary(
  idToken: string,
  meetingId: string,
  languageCodes: string[]
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/summaries`, {
    body: JSON.stringify({ languageCodes }),
    method: 'POST'
  });

  return response.json() as Promise<{ summary: InterpreterSummary }>;
}

async function interpreterFetch(
  idToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const deviceHeaders = await getRegisteredDeviceHeaders(idToken).catch(() => ({}));
  const response = await fetch(`${getSynzappApiBaseUrl()}/api/interpreter${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...deviceHeaders,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    return 'Interpreter service is not available right now.';
  }

  return 'Interpreter service is not available right now.';
}
