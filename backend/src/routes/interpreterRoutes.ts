import { Router, type Response, text } from 'express';
import { z } from 'zod';
import { verifyAppCheck } from '../middleware/appCheck.js';
import { verifyFirebaseSession } from '../services/authSessionService.js';
import {
  addInterpreterTranscriptSegment,
  addInterpreterTranslationSegment,
  createInterpreterMeeting,
  createInterpreterRealtimeClientSecret,
  createInterpreterRealtimeSdpAnswer,
  createInterpreterSegmentAudio,
  createInterpreterSummary,
  createInterpreterSummaryAudio,
  createInterpreterTranslationReplayAudio,
  createInterpreterVoicePreviewAudio,
  deleteInterpreterMeeting,
  deleteInterpreterTranscriptSegments,
  endInterpreterMeeting,
  getInterpreterMeeting,
  lookupInterpreterApprovedKnowledge,
  listInterpreterMeetings,
  listInterpreterParticipants,
  listInterpreterSummaries,
  listInterpreterTranscriptLibrary,
  listInterpreterSupportedLanguages,
  listInterpreterVoiceProfiles,
  advanceInterpreterSummaryReading,
  exportInterpreterSummary,
  exportInterpreterTranscript,
  advanceInterpreterTranscriptReading,
  prepareInterpreterTranscriptAudio,
  runInterpreterRealtimeProviderDiagnostic,
  startInterpreterMeeting,
  updateInterpreterMeetingInvitations,
  updateInterpreterMeetingLanguages,
  updateInterpreterMeetingVoice
} from '../services/interpreterService.js';

const interpreterRouter = Router();
const realtimeSdpBodyParser = text({ limit: '256kb', type: ['application/sdp', 'text/plain'] });

const languageCodeSchema = z.string().trim().min(2).max(16).regex(/^[a-z]{2,3}(?:-[A-Z0-9]{2,4})?$/);
const meetingIdSchema = z.string().trim().min(6).max(128).regex(/^[A-Za-z0-9_-]+$/);
const interpreterVoiceIdSchema = z.string().trim().min(2).max(32).regex(/^[a-z0-9_-]+$/);

const createMeetingBodySchema = z.object({
  autoDetectSourceLanguage: z.boolean().optional(),
  interpreterVoiceId: interpreterVoiceIdSchema.nullable().optional(),
  invitedUserIds: z.array(meetingIdSchema).max(50).optional(),
  interpreterLanguageCodes: z.array(languageCodeSchema).min(1).max(10),
  meetingName: z.string().trim().min(2).max(140),
  meetingType: z.enum(['ONE_ON_ONE', 'LEVEL_1', 'LEVEL_3']),
  reminderFrequency: z.enum(['none', 'once', 'daily', 'weekly']).optional(),
  reminderLeadMinutes: z.number().int().min(0).max(10_080).nullable().optional(),
  scheduledAtIso: z.string().trim().datetime().nullable().optional(),
  sourceLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeSessionBodySchema = z.object({
  sessionMode: z.enum(['controlled_voice', 'translation', 'voice_agent']).optional(),
  targetLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeDiagnosticBodySchema = z.object({
  targetLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeSdpAnswerBodySchema = z.object({
  offerSdp: z.string().min(20).max(200_000),
  sessionMode: z.enum(['controlled_voice', 'translation', 'voice_agent']).optional(),
  targetLanguageCode: languageCodeSchema
});

const approvedKnowledgeBodySchema = z.object({
  query: z.string().trim().min(2).max(500),
  targetLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeSdpAnswerQuerySchema = z.object({
  sessionMode: z.enum(['controlled_voice', 'translation', 'voice_agent']).optional(),
  targetLanguageCode: languageCodeSchema
});

const transcriptBodySchema = z.object({
  cleanedText: z.string().trim().min(1).max(120_000).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  detectedLanguageCode: languageCodeSchema.nullable().optional(),
  durationMs: z.number().int().min(0).max(30 * 60_000).nullable().optional(),
  preferredAudioLanguageCode: languageCodeSchema.nullable().optional(),
  sourceLanguageCode: languageCodeSchema.nullable().optional(),
  text: z.string().trim().min(1).max(120_000),
  versionId: z.string().trim().min(3).max(120).nullable().optional()
});

const transcriptAudioBodySchema = z.object({
  languageCode: languageCodeSchema,
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

/**
 * One file per request, asked for by GET.
 *
 * A GET is what lets the phone's file system fetch this straight to disk with
 * its own credentials, rather than loading a whole document into memory first.
 * It is also the honest verb: this asks for a document, it does not change
 * anything.
 */
const summaryExportQuerySchema = z.object({
  format: z.enum(['audio', 'pdf', 'word']),
  languageCode: languageCodeSchema,
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const EXPORT_CONTENT_TYPES = {
  audio: 'audio/mpeg',
  pdf: 'application/pdf',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
} as const;

const EXPORT_EXTENSIONS = { audio: 'mp3', pdf: 'pdf', word: 'docx' } as const;

/**
 * Sends the file back, named, and refuses to cache it anywhere.
 *
 * These documents are confidential by definition, so no proxy, CDN or browser
 * is invited to keep a copy of one.
 */
function sendInterpreterExport(
  res: Response,
  format: 'audio' | 'pdf' | 'word',
  result: { audio: Buffer | null; digest: { full: string }; fileNameStem: string; pdf: Buffer | null; word: Buffer | null }
) {
  const body = format === 'audio' ? result.audio : format === 'pdf' ? result.pdf : result.word;

  if (!body) {
    throw new Error('The requested document could not be produced.');
  }

  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[format]);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.fileNameStem}.${EXPORT_EXTENSIONS[format]}"`
  );
  res.setHeader('X-Synzapp-Content-Digest', result.digest.full);
  res.send(body);
}

const deleteTranscriptsBodySchema = z.object({
  segmentIds: z.array(meetingIdSchema).min(1).max(50)
});

const translationBodySchema = z.object({
  sourceSegmentId: z.string().trim().max(128).nullable().optional(),
  sourceText: z.string().trim().min(1).max(8_000),
  targetLanguageCode: languageCodeSchema,
  translatedText: z.string().trim().min(1).max(8_000)
});

const segmentAudioBodySchema = z.object({
  includeIntro: z.boolean().optional(),
  sourceSegmentId: z.string().trim().max(128).nullable().optional(),
  sourceText: z.string().trim().min(1).max(8_000),
  targetLanguageCode: languageCodeSchema,
  translatedText: z.string().trim().min(1).max(8_000).nullable().optional(),
  versionId: z.string().trim().max(128).nullable().optional(),
  versionSequence: z.number().int().positive().max(10_000).nullable().optional(),
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const summaryBodySchema = z.object({
  languageCodes: z.array(languageCodeSchema).min(1).max(10),
  transcriptText: z.string().trim().min(1).max(120_000).nullable().optional(),
  versionId: z.string().trim().max(128).nullable().optional(),
  versionSequence: z.number().int().positive().max(10_000).nullable().optional()
});

const summaryAudioBodySchema = z.object({
  languageCode: languageCodeSchema,
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const translationReplayAudioBodySchema = z.object({
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const voicePreviewBodySchema = z.object({
  languageCode: languageCodeSchema.nullable().optional(),
  voiceId: interpreterVoiceIdSchema
});

const invitationsBodySchema = z.object({
  invitedUserIds: z.array(meetingIdSchema).max(50)
});

const meetingLanguagesBodySchema = z.object({
  interpreterLanguageCodes: z.array(languageCodeSchema).min(1).max(10)
});

const meetingVoiceBodySchema = z.object({
  interpreterVoiceId: interpreterVoiceIdSchema
});

interpreterRouter.get('/languages', verifyAppCheck, (_req, res) => {
  res.json({
    languages: listInterpreterSupportedLanguages(),
    voices: listInterpreterVoiceProfiles()
  });
});

interpreterRouter.post('/voices/preview', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = voicePreviewBodySchema.parse(req.body);
    const result = await createInterpreterVoicePreviewAudio(decodedToken, {
      languageCode: body.languageCode || null,
      voiceId: body.voiceId
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.get('/meetings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const result = await listInterpreterMeetings(decodedToken);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.get('/participants', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const result = await listInterpreterParticipants(decodedToken);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = createMeetingBodySchema.parse(req.body);
    const result = await createInterpreterMeeting(decodedToken, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.get('/meetings/:meetingId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await getInterpreterMeeting(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/start', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await startInterpreterMeeting(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/end', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await endInterpreterMeeting(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.delete('/meetings/:meetingId', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await deleteInterpreterMeeting(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/invitations', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = invitationsBodySchema.parse(req.body);
    const result = await updateInterpreterMeetingInvitations(decodedToken, {
      invitedUserIds: body.invitedUserIds,
      meetingId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/languages', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = meetingLanguagesBodySchema.parse(req.body);
    const result = await updateInterpreterMeetingLanguages(decodedToken, {
      interpreterLanguageCodes: body.interpreterLanguageCodes,
      meetingId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/voice', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = meetingVoiceBodySchema.parse(req.body);
    const result = await updateInterpreterMeetingVoice(decodedToken, {
      interpreterVoiceId: body.interpreterVoiceId,
      meetingId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/realtime-client-secret', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = realtimeSessionBodySchema.parse(req.body);
    const result = await createInterpreterRealtimeClientSecret(
      decodedToken,
      meetingId,
      body.targetLanguageCode,
      body.sessionMode
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/realtime-diagnostics', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const body = realtimeDiagnosticBodySchema.parse(req.body || {});
    const result = await runInterpreterRealtimeProviderDiagnostic(decodedToken, body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/realtime-sdp-answer', verifyAppCheck, realtimeSdpBodyParser, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const query = realtimeSdpAnswerQuerySchema.parse(req.query);
    const body = typeof req.body === 'string'
      ? realtimeSdpAnswerBodySchema.parse({
          offerSdp: req.body,
          sessionMode: query.sessionMode,
          targetLanguageCode: query.targetLanguageCode
        })
      : realtimeSdpAnswerBodySchema.parse(req.body);
    const result = await createInterpreterRealtimeSdpAnswer(decodedToken, meetingId, body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/approved-knowledge', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = approvedKnowledgeBodySchema.parse(req.body);
    const result = await lookupInterpreterApprovedKnowledge(decodedToken, meetingId, {
      query: body.query,
      targetLanguageCode: body.targetLanguageCode || null
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/transcripts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = transcriptBodySchema.parse(req.body);
    const result = await addInterpreterTranscriptSegment(decodedToken, meetingId, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.get('/meetings/:meetingId/transcript-library', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await listInterpreterTranscriptLibrary(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.delete('/meetings/:meetingId/transcripts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = deleteTranscriptsBodySchema.parse(req.body || {});
    const result = await deleteInterpreterTranscriptSegments(decodedToken, meetingId, body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/transcripts/:segmentId/audio-artifacts', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const segmentId = meetingIdSchema.parse(req.params.segmentId);
    const body = transcriptAudioBodySchema.parse(req.body || {});
    const result = await prepareInterpreterTranscriptAudio(decodedToken, meetingId, segmentId, {
      languageCode: body.languageCode,
      voiceId: body.voiceId || null
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Makes one more piece of a reading and returns the playlist.
 *
 * Called repeatedly by the phone while it listens. Each call does a bounded
 * amount of work inside the request, which is the only place Cloud Run
 * guarantees CPU — see advanceInterpreterTranscriptReading.
 */
interpreterRouter.post('/meetings/:meetingId/transcripts/:segmentId/reading', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const segmentId = meetingIdSchema.parse(req.params.segmentId);
    const body = transcriptAudioBodySchema.parse(req.body || {});
    const result = await advanceInterpreterTranscriptReading(decodedToken, meetingId, segmentId, {
      languageCode: body.languageCode,
      voiceId: body.voiceId || null
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/** Makes one more piece of a spoken summary. Same shape as a transcript reading. */
interpreterRouter.post('/meetings/:meetingId/summaries/:summaryId/reading', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const summaryId = meetingIdSchema.parse(req.params.summaryId);
    const body = transcriptAudioBodySchema.parse(req.body || {});
    const result = await advanceInterpreterSummaryReading(decodedToken, {
      languageCode: body.languageCode,
      meetingId,
      summaryId,
      voiceId: body.voiceId || null
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/** The same download for a saved transcript, in whichever formats were asked for. */
interpreterRouter.get('/meetings/:meetingId/transcripts/:segmentId/export', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const segmentId = meetingIdSchema.parse(req.params.segmentId);
    const body = summaryExportQuerySchema.parse(req.query || {});
    const result = await exportInterpreterTranscript(decodedToken, {
      formats: [body.format],
      languageCode: body.languageCode,
      meetingId,
      segmentId,
      voiceId: body.voiceId || null
    });

    sendInterpreterExport(res, body.format, result);
  } catch (error) {
    next(error);
  }
});

/** Builds the documents and the MP3 somebody asked to take away. */
interpreterRouter.get('/meetings/:meetingId/summaries/:summaryId/export', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const summaryId = meetingIdSchema.parse(req.params.summaryId);
    const body = summaryExportQuerySchema.parse(req.query || {});
    const result = await exportInterpreterSummary(decodedToken, {
      formats: [body.format],
      languageCode: body.languageCode,
      meetingId,
      summaryId,
      voiceId: body.voiceId || null
    });

    sendInterpreterExport(res, body.format, result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/translations', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = translationBodySchema.parse(req.body);
    const result = await addInterpreterTranslationSegment(decodedToken, meetingId, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/interpretation-audio', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = segmentAudioBodySchema.parse(req.body);
    const result = await createInterpreterSegmentAudio(decodedToken, meetingId, body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/translations/:translationId/audio', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const translationId = meetingIdSchema.parse(req.params.translationId);
    const body = translationReplayAudioBodySchema.parse(req.body || {});
    const result = await createInterpreterTranslationReplayAudio(decodedToken, {
      meetingId,
      translationId,
      voiceId: body.voiceId || null
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.get('/meetings/:meetingId/summaries', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const result = await listInterpreterSummaries(decodedToken, meetingId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/summaries', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = summaryBodySchema.parse(req.body);
    const result = await createInterpreterSummary(decodedToken, {
      languageCodes: body.languageCodes,
      meetingId,
      transcriptText: body.transcriptText || null,
      versionId: body.versionId || null,
      versionSequence: body.versionSequence || null
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

interpreterRouter.post('/meetings/:meetingId/summaries/:summaryId/audio', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const summaryId = meetingIdSchema.parse(req.params.summaryId);
    const body = summaryAudioBodySchema.parse(req.body);
    const result = await createInterpreterSummaryAudio(decodedToken, {
      languageCode: body.languageCode,
      meetingId,
      summaryId,
      voiceId: body.voiceId || null
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

async function getDecodedToken(authorizationHeader: string) {
  const idToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : authorizationHeader;

  if (!idToken) {
    throw authenticationError('Missing authorization token.');
  }

  return verifyFirebaseSession(idToken);
}

function authenticationError(message: string): Error {
  const error = new Error(message);
  error.name = 'AuthenticationError';
  return error;
}

export { interpreterRouter };
