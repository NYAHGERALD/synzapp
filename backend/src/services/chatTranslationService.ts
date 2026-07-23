import { DecodedIdToken } from 'firebase-admin/auth';
import { env } from '../config/env.js';
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

  if (!env.openAiApiKey) {
    throw validationError('Translation is not configured on this Synzapp environment.');
  }

  const translatedText = await requestOpenAiTranslation(input.sourceLanguageCode, input.targetLanguageCode, text);

  return {
    detectedSourceLanguageCode: input.sourceLanguageCode,
    model: env.openAiModel,
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    translatedText
  };
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

async function requestOpenAiTranslation(
  sourceLanguageCode: ChatTranslationLanguageCode,
  targetLanguageCode: ChatTranslationLanguageCode,
  text: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.openAiRequestTimeoutMs);
  const sourceLanguage = getChatTranslationLanguageName(sourceLanguageCode);
  const targetLanguage = getChatTranslationLanguageName(targetLanguageCode);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content: [{
              text: [
                'You are Synzapp secure message translation.',
                'Translate only the provided user message.',
                'Preserve meaning, names, dates, and numbers.',
                'Do not add explanations, quotation marks, markdown, or commentary.',
                'If the text is already in the target language, return it unchanged.'
              ].join('\n'),
              type: 'input_text'
            }],
            role: 'system'
          },
          {
            content: [{
              text: [
                `Translate from ${sourceLanguage} (${sourceLanguageCode}) to ${targetLanguage} (${targetLanguageCode}).`,
                'Message:',
                text
              ].join('\n'),
              type: 'input_text'
            }],
            role: 'user'
          }
        ],
        max_output_tokens: Math.min(1_200, Math.max(120, text.length * 2)),
        model: env.openAiModel
      }),
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    });

    if (!response.ok) {
      throw translationServiceError(await getOpenAiErrorMessage(response));
    }

    const body = await response.json() as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
        }>;
      }>;
    };
    const translatedText = body.output_text ||
      body.output?.flatMap((item) => item.content || [])
        .map((content) => content.text || '')
        .join('\n')
        .trim();

    if (!translatedText) {
      throw new Error('OpenAI returned an empty translation.');
    }

    return translatedText.trim().slice(0, MAX_TRANSLATION_TEXT_LENGTH * 2);
  } catch (error) {
    if (error instanceof Error && error.name === 'TranslationServiceError') {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw translationServiceError('Translation timed out. Please try again.');
    }

    throw translationServiceError('Translation service is temporarily unavailable. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

async function getOpenAiErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as {
      error?: {
        message?: string;
      };
    };

    if (typeof body.error?.message === 'string' && body.error.message.trim()) {
      return 'Translation service rejected the request. Please try again.';
    }
  } catch {
    // Keep the client-facing response stable.
  }

  return `Translation service failed with status ${response.status}. Please try again.`;
}

function translationServiceError(message: string): Error {
  const error = new Error(message);
  error.name = 'TranslationServiceError';
  return error;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
