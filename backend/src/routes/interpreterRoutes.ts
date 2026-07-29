import { Router, text } from 'express';
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
  deleteInterpreterMeeting,
  endInterpreterMeeting,
  getInterpreterMeeting,
  listInterpreterMeetings,
  listInterpreterParticipants,
  listInterpreterSummaries,
  listInterpreterSupportedLanguages,
  listInterpreterVoiceProfiles,
  runInterpreterRealtimeProviderDiagnostic,
  startInterpreterMeeting,
  updateInterpreterMeetingInvitations
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
  targetLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeDiagnosticBodySchema = z.object({
  targetLanguageCode: languageCodeSchema.nullable().optional()
});

const realtimeSdpAnswerBodySchema = z.object({
  offerSdp: z.string().min(20).max(200_000),
  targetLanguageCode: languageCodeSchema
});

const realtimeSdpAnswerQuerySchema = z.object({
  targetLanguageCode: languageCodeSchema
});

const transcriptBodySchema = z.object({
  confidence: z.number().min(0).max(1).nullable().optional(),
  detectedLanguageCode: languageCodeSchema.nullable().optional(),
  durationMs: z.number().int().min(0).max(30 * 60_000).nullable().optional(),
  sourceLanguageCode: languageCodeSchema.nullable().optional(),
  text: z.string().trim().min(1).max(8_000)
});

const translationBodySchema = z.object({
  sourceSegmentId: z.string().trim().max(128).nullable().optional(),
  sourceText: z.string().trim().min(1).max(8_000),
  targetLanguageCode: languageCodeSchema,
  translatedText: z.string().trim().min(1).max(8_000)
});

const segmentAudioBodySchema = z.object({
  sourceSegmentId: z.string().trim().max(128).nullable().optional(),
  sourceText: z.string().trim().min(1).max(8_000),
  targetLanguageCode: languageCodeSchema,
  translatedText: z.string().trim().min(1).max(8_000).nullable().optional(),
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const summaryBodySchema = z.object({
  languageCodes: z.array(languageCodeSchema).min(1).max(10)
});

const summaryAudioBodySchema = z.object({
  languageCode: languageCodeSchema,
  voiceId: interpreterVoiceIdSchema.nullable().optional()
});

const invitationsBodySchema = z.object({
  invitedUserIds: z.array(meetingIdSchema).max(50)
});

interpreterRouter.get('/languages', verifyAppCheck, (_req, res) => {
  res.json({
    languages: listInterpreterSupportedLanguages(),
    voices: listInterpreterVoiceProfiles()
  });
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

interpreterRouter.post('/meetings/:meetingId/realtime-client-secret', verifyAppCheck, async (req, res, next) => {
  try {
    const decodedToken = await getDecodedToken(req.header('Authorization') || '');
    const meetingId = meetingIdSchema.parse(req.params.meetingId);
    const body = realtimeSessionBodySchema.parse(req.body);
    const result = await createInterpreterRealtimeClientSecret(decodedToken, meetingId, body.targetLanguageCode);

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
    const body = typeof req.body === 'string'
      ? realtimeSdpAnswerBodySchema.parse({
          offerSdp: req.body,
          targetLanguageCode: realtimeSdpAnswerQuerySchema.parse(req.query).targetLanguageCode
        })
      : realtimeSdpAnswerBodySchema.parse(req.body);
    const result = await createInterpreterRealtimeSdpAnswer(decodedToken, meetingId, body);

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
      meetingId
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
