import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

export type InterpreterMeetingType = 'LEVEL_1' | 'LEVEL_3' | 'ONE_ON_ONE';
export type InterpreterMeetingStatus = 'ENDED' | 'LIVE' | 'SCHEDULED';

export interface InterpreterLanguage {
  code: string;
  label: string;
}

export interface InterpreterVoiceProfile {
  description: string;
  id: string;
  label: string;
}

export interface InterpreterMeeting {
  autoDetectSourceLanguage: boolean;
  createdAtIso: string;
  createdByDisplayName: string;
  createdByUid: string;
  endedAtIso?: string | null;
  interpreterLanguages: InterpreterLanguage[];
  interpreterVoiceId?: string;
  invitedUserIds: string[];
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

export interface InterpreterParticipant {
  departmentName: string | null;
  displayName: string;
  roleName: string | null;
  uid: string;
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

export interface InterpreterSummaryAudio {
  audioBase64: string;
  contentType: string;
  format: 'mp3';
  languageCode: string;
  model: string;
  voice: string;
}

export interface InterpreterSegmentAudio extends InterpreterSummaryAudio {
  introText?: string;
  sourceText: string;
  translatedText: string;
  translationId: string;
  translationModel: string;
}

export interface InterpreterVoicePreviewAudio extends InterpreterSummaryAudio {
  previewText: string;
  voiceProfile: InterpreterVoiceProfile;
}

export interface InterpreterMeetingDetails {
  auditEvents: unknown[];
  meeting: InterpreterMeeting;
  summaries: InterpreterSummary[];
  transcripts: InterpreterSegment[];
  translations: InterpreterTranslationSegment[];
}

export interface InterpreterRealtimeClientSecretResponse {
  clientSecret: string;
  expiresWithSession: boolean;
  model: string;
  targetLanguage: InterpreterLanguage;
}

export interface InterpreterRealtimeSdpAnswerResponse {
  answerSdp: string;
  model: string;
  targetLanguage: InterpreterLanguage;
}

export interface InterpreterRealtimeProviderDiagnosticResponse {
  checkedAtIso: string;
  credentialAccepted: boolean;
  expectedInvalidOfferResponse: boolean;
  model: string;
  providerMessage: string;
  providerReachable: boolean;
  providerStatus: number;
  targetLanguage: InterpreterLanguage;
}

export interface CreateInterpreterMeetingInput {
  autoDetectSourceLanguage: boolean;
  interpreterVoiceId?: string | null;
  invitedUserIds?: string[];
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
    supportedVoices?: InterpreterVoiceProfile[];
  }>;
}

export async function listInterpreterLanguages(idToken: string) {
  const response = await interpreterFetch(idToken, '/languages');

  return response.json() as Promise<{ languages: InterpreterLanguage[]; voices?: InterpreterVoiceProfile[] }>;
}

export async function listInterpreterParticipants(idToken: string) {
  const response = await interpreterFetch(idToken, '/participants');

  return response.json() as Promise<{ participants: InterpreterParticipant[] }>;
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

export async function listInterpreterSummaries(idToken: string, meetingId: string) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/summaries`);

  return response.json() as Promise<{ summaries: InterpreterSummary[] }>;
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

export async function deleteInterpreterMeeting(idToken: string, meetingId: string) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE'
  });

  return response.json() as Promise<{ deleted: boolean; deletedAtIso: string; meetingId: string }>;
}

export async function updateInterpreterMeetingInvitations(
  idToken: string,
  meetingId: string,
  invitedUserIds: string[]
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/invitations`, {
    body: JSON.stringify({ invitedUserIds }),
    method: 'POST'
  });

  return response.json() as Promise<{ meeting: InterpreterMeeting }>;
}

export async function updateInterpreterMeetingVoice(
  idToken: string,
  meetingId: string,
  interpreterVoiceId: string
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/voice`, {
    body: JSON.stringify({ interpreterVoiceId }),
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

export async function createInterpreterRealtimeSdpAnswer(
  idToken: string,
  meetingId: string,
  input: { offerSdp: string; targetLanguageCode: string }
) {
  const targetLanguageCode = encodeURIComponent(input.targetLanguageCode);
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/realtime-sdp-answer?targetLanguageCode=${targetLanguageCode}`,
    {
      body: input.offerSdp,
      headers: {
        'Content-Type': 'application/sdp'
      },
      method: 'POST'
    }
  );

  return response.json() as Promise<InterpreterRealtimeSdpAnswerResponse>;
}

export async function exchangeInterpreterRealtimeSdpWithClientSecret(
  clientSecret: string,
  offerSdp: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
    body: offerSdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp'
    },
    method: 'POST'
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(getRealtimeSdpExchangeMessage(response.status, responseText));
  }

  if (!responseText.trim()) {
    throw new Error('Interpreter realtime audio answer was empty.');
  }

  return responseText;
}

export async function runInterpreterRealtimeProviderDiagnostic(
  idToken: string,
  targetLanguageCode?: string | null
) {
  const response = await interpreterFetch(idToken, '/realtime-diagnostics', {
    body: JSON.stringify({ targetLanguageCode: targetLanguageCode || null }),
    method: 'POST'
  });

  return response.json() as Promise<InterpreterRealtimeProviderDiagnosticResponse>;
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

export async function createInterpreterInterpretationAudio(
  idToken: string,
  meetingId: string,
  input: {
    sourceSegmentId?: string | null;
    sourceText: string;
    targetLanguageCode: string;
    translatedText?: string | null;
    voiceId?: string | null;
  }
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/interpretation-audio`, {
    body: JSON.stringify(input),
    method: 'POST'
  });

  return response.json() as Promise<{ audio: InterpreterSegmentAudio }>;
}

export async function createInterpreterTranslationReplayAudio(
  idToken: string,
  meetingId: string,
  translationId: string,
  voiceId?: string | null
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/translations/${encodeURIComponent(translationId)}/audio`,
    {
      body: JSON.stringify({ voiceId: voiceId || null }),
      method: 'POST'
    }
  );

  return response.json() as Promise<{ audio: InterpreterSegmentAudio }>;
}

export async function createInterpreterVoicePreviewAudio(
  idToken: string,
  input: {
    languageCode?: string | null;
    voiceId: string;
  }
) {
  const response = await interpreterFetch(idToken, '/voices/preview', {
    body: JSON.stringify({
      languageCode: input.languageCode || null,
      voiceId: input.voiceId
    }),
    method: 'POST'
  });

  return response.json() as Promise<{ audio: InterpreterVoicePreviewAudio }>;
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

  return response.json() as Promise<{
    summary: InterpreterSummary;
    summaryAudioByLanguage?: Record<string, InterpreterSummaryAudio>;
  }>;
}

export async function createInterpreterSummaryAudio(
  idToken: string,
  meetingId: string,
  summaryId: string,
  languageCode: string,
  voiceId?: string | null
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/summaries/${encodeURIComponent(summaryId)}/audio`,
    {
      body: JSON.stringify({ languageCode, voiceId: voiceId || null }),
      method: 'POST'
    }
  );

  return response.json() as Promise<{ audio: InterpreterSummaryAudio }>;
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

function getRealtimeSdpExchangeMessage(status: number, responseText: string): string {
  const providerMessage = getProviderErrorMessage(responseText);

  if (status === 400) {
    return providerMessage && /sdp|offer|parse|unmarshal/i.test(providerMessage)
      ? 'Interpreter realtime audio could not read a valid microphone connection. Close the live interpreter and start it again.'
      : providerMessage || 'Interpreter realtime audio offer was rejected by the AI provider.';
  }

  if (status === 401 || status === 403) {
    return providerMessage || 'Interpreter realtime authorization was rejected during audio setup.';
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

  return providerMessage || 'Interpreter realtime audio could not be prepared.';
}

function getProviderErrorMessage(responseText: string): string {
  if (!responseText.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(responseText) as { error?: { message?: unknown }; message?: unknown };
    const message = typeof parsed.error?.message === 'string'
      ? parsed.error.message
      : typeof parsed.message === 'string'
        ? parsed.message
        : '';

    return message.slice(0, 220);
  } catch {
    return responseText.slice(0, 220);
  }
}
