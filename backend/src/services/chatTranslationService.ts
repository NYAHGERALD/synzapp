import { DecodedIdToken } from 'firebase-admin/auth';
import { assertRateLimit } from '../middleware/rateLimit.js';

export type ChatTranslationLanguageCode =
  | 'ar-SA'
  | 'da-DK'
  | 'de-DE'
  | 'en-AU'
  | 'en-CA'
  | 'en-GB'
  | 'en-IN'
  | 'en-US'
  | 'es-ES'
  | 'es-MX'
  | 'fr-CA'
  | 'fr-FR'
  | 'hi-IN'
  | 'it-IT'
  | 'ja-JP'
  | 'ko-KR'
  | 'nl-BE'
  | 'nl-NL'
  | 'pt-BR'
  | 'yue-CN'
  | 'zh-CN'
  | 'zh-HK'
  | 'zh-TW';

export interface ChatMessageTranslationInput {
  messageId: string;
  sourceLanguageCode: ChatTranslationLanguageCode;
  targetLanguageCode: ChatTranslationLanguageCode;
  text: string;
}

export interface ChatMessageTranslationResponse {
  detectedSourceLanguageCode: ChatTranslationLanguageCode;
  model: string;
  sourceLanguageCode: ChatTranslationLanguageCode;
  targetLanguageCode: ChatTranslationLanguageCode;
  translatedText: string;
}

const MAX_TRANSLATION_TEXT_LENGTH = 4_000;

const LANGUAGE_LABELS: Record<ChatTranslationLanguageCode, string> = {
  'ar-SA': 'Arabic',
  'da-DK': 'Danish',
  'de-DE': 'German',
  'en-AU': 'English',
  'en-CA': 'English',
  'en-GB': 'English',
  'en-IN': 'English',
  'en-US': 'English',
  'es-ES': 'Spanish',
  'es-MX': 'Spanish',
  'fr-CA': 'French',
  'fr-FR': 'French',
  'hi-IN': 'Hindi',
  'it-IT': 'Italian',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'nl-BE': 'Dutch',
  'nl-NL': 'Dutch',
  'pt-BR': 'Portuguese',
  'yue-CN': 'Cantonese',
  'zh-CN': 'Chinese',
  'zh-HK': 'Chinese',
  'zh-TW': 'Chinese'
};

export async function translateChatMessage(
  decodedToken: DecodedIdToken,
  input: ChatMessageTranslationInput
): Promise<ChatMessageTranslationResponse> {
  const text = normalizeTranslationText(input.text);

  assertRateLimit(`chat-translation:${decodedToken.uid}`, 60_000, 20);

  if (input.sourceLanguageCode === input.targetLanguageCode) {
    return {
      detectedSourceLanguageCode: input.sourceLanguageCode,
      model: 'same-language',
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      translatedText: text
    };
  }

  throw validationError('Cloud chat translation is disabled for security and audit compliance. Use on-device translation in the Synzapp mobile app.');
}

export function getChatTranslationLanguageName(code: ChatTranslationLanguageCode): string {
  return LANGUAGE_LABELS[code] || code;
}

function normalizeTranslationText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    throw validationError('Select a text message to translate.');
  }

  if (normalized.length > MAX_TRANSLATION_TEXT_LENGTH) {
    throw validationError(`Translation supports messages up to ${MAX_TRANSLATION_TEXT_LENGTH} characters.`);
  }

  return normalized;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
