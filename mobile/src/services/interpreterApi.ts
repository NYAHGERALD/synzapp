import * as FileSystem from 'expo-file-system/legacy';
import { describeDownloadFailure } from './downloadFailureMessage';
import { getSynzappApiBaseUrl } from './apiConfig';
import { getRegisteredDeviceHeaders } from './deviceIdentity';

export type InterpreterMeetingType = 'LEVEL_1' | 'LEVEL_3' | 'ONE_ON_ONE';
export type InterpreterMeetingStatus = 'ENDED' | 'LIVE' | 'SCHEDULED';

export interface InterpreterLanguage {
  code: string;
  label: string;
  realtimeTargetSupported?: boolean;
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
  cleanedText?: string | null;
  createdAtIso: string;
  detectedLanguageCode?: string | null;
  segmentId?: string;
  sourceLanguageCode?: string | null;
  text: string;
  updatedAtIso?: string | null;
  versionId?: string | null;
}

export interface InterpreterTranslationSegment {
  createdAtIso: string;
  sourceSegmentId?: string | null;
  sourceText: string;
  targetLanguageCode: string;
  translatedText: string;
  translationId?: string;
  versionId?: string | null;
  versionSequence?: number | null;
}

export interface InterpreterSummary {
  createdAtIso: string;
  languageCodes: string[];
  summaryId: string;
  summaryTextByLanguage: Record<string, string>;
  versionId?: string | null;
  versionSequence?: number | null;
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
  localUri?: string;
  sourceText: string;
  translatedText: string;
  translationId: string;
  translationModel: string;
  versionId?: string | null;
  versionSequence?: number | null;
}

export interface InterpreterVoicePreviewAudio extends InterpreterSummaryAudio {
  previewText: string;
  voiceProfile: InterpreterVoiceProfile;
}

export type InterpreterTranscriptAudioStatus = 'failed' | 'processing' | 'queued' | 'ready';

export interface InterpreterTranscriptAudioArtifact {
  artifactId: string;
  audioStoragePath?: string | null;
  contentType?: string | null;
  createdAtIso: string;
  downloadUrl?: string | null;
  downloadUrlExpiresAtIso?: string | null;
  errorMessage?: string | null;
  format: 'mp3';
  languageCode: string;
  languageLabel: string;
  meetingId: string;
  model?: string | null;
  partCount?: number | null;
  segmentId: string;
  sourceText: string;
  spokenText?: string | null;
  status: InterpreterTranscriptAudioStatus;
  tenantId: string;
  textFingerprint: string;
  translationModel?: string | null;
  updatedAtIso: string;
  voice: string;
}

export interface InterpreterTranscriptLibraryItem extends InterpreterSegment {
  audioArtifacts: InterpreterTranscriptAudioArtifact[];
  meetingId: string;
  tenantId: string;
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
  sessionMode?: 'controlled_voice' | 'translation' | 'voice_agent';
  targetLanguage: InterpreterLanguage;
}

export interface InterpreterRealtimeSdpAnswerResponse {
  answerSdp: string;
  model: string;
  sessionMode?: 'controlled_voice' | 'translation' | 'voice_agent';
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

export interface InterpreterApprovedKnowledgeResponse {
  answer: string;
  answeredAtIso: string;
  confidence: 'approved' | 'not_available';
  facts: string[];
  policy: string;
  targetLanguage?: InterpreterLanguage;
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

const INTERPRETER_DEVICE_HEADER_TIMEOUT_MS = 2500;

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

export async function updateInterpreterMeetingLanguages(
  idToken: string,
  meetingId: string,
  interpreterLanguageCodes: string[]
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/languages`, {
    body: JSON.stringify({ interpreterLanguageCodes }),
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
  targetLanguageCode?: string | null,
  sessionMode: 'controlled_voice' | 'translation' | 'voice_agent' = 'controlled_voice'
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/realtime-client-secret`, {
    body: JSON.stringify({ sessionMode, targetLanguageCode: targetLanguageCode || null }),
    method: 'POST'
  });

  return response.json() as Promise<InterpreterRealtimeClientSecretResponse>;
}

export async function createInterpreterRealtimeSdpAnswer(
  idToken: string,
  meetingId: string,
  input: {
    offerSdp: string;
    sessionMode?: 'controlled_voice' | 'translation' | 'voice_agent';
    targetLanguageCode: string;
  }
) {
  const targetLanguageCode = encodeURIComponent(input.targetLanguageCode);
  const sessionMode = encodeURIComponent(input.sessionMode || 'controlled_voice');
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/realtime-sdp-answer?targetLanguageCode=${targetLanguageCode}&sessionMode=${sessionMode}`,
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

export async function lookupInterpreterApprovedKnowledge(
  idToken: string,
  meetingId: string,
  input: {
    query: string;
    targetLanguageCode?: string | null;
  }
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/approved-knowledge`, {
    body: JSON.stringify({
      query: input.query,
      targetLanguageCode: input.targetLanguageCode || null
    }),
    method: 'POST'
  });

  return response.json() as Promise<InterpreterApprovedKnowledgeResponse>;
}

export async function exchangeInterpreterRealtimeSdpWithClientSecret(
  clientSecret: string,
  offerSdp: string,
  sessionMode: 'controlled_voice' | 'translation' | 'voice_agent' = 'controlled_voice'
): Promise<string> {
  const realtimeUrl = sessionMode === 'translation'
    ? 'https://api.openai.com/v1/realtime/translations/calls'
    : 'https://api.openai.com/v1/realtime/calls';
  const response = await fetch(realtimeUrl, {
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
  detectedLanguageCode?: string | null,
  cleanedText?: string | null,
  versionId?: string | null,
  preferredAudioLanguageCode?: string | null
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/transcripts`, {
    body: JSON.stringify({
      cleanedText: cleanedText?.trim() || null,
      detectedLanguageCode: detectedLanguageCode || null,
      preferredAudioLanguageCode: preferredAudioLanguageCode || null,
      text,
      versionId: versionId?.trim() || null
    }),
    method: 'POST'
  });

  return response.json() as Promise<{
    audioArtifact?: InterpreterTranscriptAudioArtifact | null;
    segment: InterpreterSegment;
  }>;
}

export async function listInterpreterTranscriptLibrary(
  idToken: string,
  meetingId: string
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/transcript-library`
  );

  return response.json() as Promise<{ transcripts: InterpreterTranscriptLibraryItem[] }>;
}

export async function prepareInterpreterTranscriptAudio(
  idToken: string,
  meetingId: string,
  segmentId: string,
  input: {
    languageCode: string;
    voiceId?: string | null;
  }
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(segmentId)}/audio-artifacts`,
    {
      body: JSON.stringify({
        languageCode: input.languageCode,
        voiceId: input.voiceId || null
      }),
      method: 'POST'
    }
  );

  return response.json() as Promise<{ audioArtifact: InterpreterTranscriptAudioArtifact }>;
}

export interface InterpreterTranscriptReadingState {
  isComplete: boolean;
  languageCode: string;
  /**
   * An HLS playlist. Handed straight to the player, which fetches segments as
   * they appear, plays them in order and joins them without a gap — none of
   * which this app has to implement.
   */
  playlistUrl: string;
  readingId: string;
  segmentsReady: number;
  segmentsTotal: number;
}

/**
 * Makes one more piece of a reading.
 *
 * Called repeatedly while listening. Each call does a bounded amount of work,
 * so nothing is left running unattended on the server and a failure costs one
 * retry rather than the whole recording.
 */
export async function advanceInterpreterTranscriptReading(
  idToken: string,
  meetingId: string,
  segmentId: string,
  input: {
    languageCode: string;
    voiceId?: string | null;
  }
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(segmentId)}/reading`,
    {
      body: JSON.stringify({
        languageCode: input.languageCode,
        voiceId: input.voiceId || null
      }),
      method: 'POST'
    }
  );

  return response.json() as Promise<InterpreterTranscriptReadingState>;
}

/**
 * Makes one more piece of a spoken summary.
 *
 * Same contract as the transcript reading: called repeatedly while listening,
 * and the playlist it returns goes straight to the player.
 */
export async function advanceInterpreterSummaryReading(
  idToken: string,
  meetingId: string,
  summaryId: string,
  input: {
    languageCode: string;
    voiceId?: string | null;
  }
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/summaries/${encodeURIComponent(summaryId)}/reading`,
    {
      body: JSON.stringify({
        languageCode: input.languageCode,
        voiceId: input.voiceId || null
      }),
      method: 'POST'
    }
  );

  return response.json() as Promise<InterpreterTranscriptReadingState>;
}

export type InterpreterExportFormat = 'audio' | 'pdf' | 'word';

export interface InterpreterExportFile {
  fileName: string;
  uri: string;
}



/**
 * Downloads one exported document straight to a file.
 *
 * The server sends the document itself rather than a link to a stored copy, so
 * nothing is left behind to expire, be swept up, or keep working after the
 * person who asked for it has gone.
 *
 * `downloadAsync` streams it to disk carrying the same credentials as any other
 * call, which is why the endpoint is a GET: a whole document never has to be
 * held in memory on the way past.
 */
export async function downloadInterpreterExport(
  idToken: string,
  input: {
    fileName: string;
    format: InterpreterExportFormat;
    languageCode: string;
    meetingId: string;
    ownerId: string;
    ownerKind: 'summary' | 'transcript';
    voiceId?: string | null;
  }
): Promise<InterpreterExportFile> {
  const deviceHeaders = await getInterpreterDeviceHeaders(idToken);
  const owner = input.ownerKind === 'summary'
    ? `summaries/${encodeURIComponent(input.ownerId)}`
    : `transcripts/${encodeURIComponent(input.ownerId)}`;
  const query = new URLSearchParams({
    format: input.format,
    languageCode: input.languageCode,
    ...(input.voiceId ? { voiceId: input.voiceId } : {})
  }).toString();

  const url =
    `${getSynzappApiBaseUrl()}/api/interpreter/meetings/${encodeURIComponent(input.meetingId)}/${owner}/export?${query}`;
  const uri = `${FileSystem.cacheDirectory}${input.fileName}`;

  const result = await FileSystem.downloadAsync(url, uri, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...deviceHeaders
    }
  });

  if (result.status !== 200) {
    /**
     * The reason is in the file, not in the status.
     *
     * `downloadAsync` writes whatever came back — including the server's
     * explanation — to disk and reports only a number. Reading it is the
     * difference between "that document could not be downloaded" and being
     * told which permission is missing and who can grant it.
     */
    const body = await FileSystem.readAsStringAsync(result.uri).catch(() => null);

    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);

    throw new Error(describeDownloadFailure({ body, status: result.status }));
  }

  return { fileName: input.fileName, uri: result.uri };
}

export async function deleteInterpreterTranscriptSegments(
  idToken: string,
  meetingId: string,
  segmentIds: string[]
) {
  const response = await interpreterFetch(
    idToken,
    `/meetings/${encodeURIComponent(meetingId)}/transcripts`,
    {
      body: JSON.stringify({ segmentIds }),
      method: 'DELETE'
    }
  );

  return response.json() as Promise<{
    deletedAudioArtifactCount: number;
    deletedSegmentIds: string[];
    deletedTranscriptCount: number;
  }>;
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
    includeIntro?: boolean;
    sourceSegmentId?: string | null;
    sourceText: string;
    targetLanguageCode: string;
    translatedText?: string | null;
    versionId?: string | null;
    versionSequence?: number | null;
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
  languageCodes: string[],
  transcriptText?: string | null,
  version?: {
    versionId?: string | null;
    versionSequence?: number | null;
  }
) {
  const response = await interpreterFetch(idToken, `/meetings/${encodeURIComponent(meetingId)}/summaries`, {
    body: JSON.stringify({
      languageCodes,
      transcriptText: transcriptText?.trim() || null,
      versionId: version?.versionId || null,
      versionSequence: version?.versionSequence || null
    }),
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
  const deviceHeaders = await getInterpreterDeviceHeaders(idToken);
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

async function getInterpreterDeviceHeaders(idToken: string): Promise<Record<string, string>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      getRegisteredDeviceHeaders(idToken),
      new Promise<Record<string, string>>((resolve) => {
        timeoutId = setTimeout(() => resolve({}), INTERPRETER_DEVICE_HEADER_TIMEOUT_MS);
      })
    ]);
  } catch {
    // Device identity improves audit traceability, but a cold registration must not block
    // authenticated interpreter actions such as first-tap session creation.
    return {};
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
