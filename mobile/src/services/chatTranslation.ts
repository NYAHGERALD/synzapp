import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatMessageTranslation,
  ChatTranscriptLanguageCode
} from './chatApi';

const TRANSLATION_LANGUAGES_KEY = 'synzapp.chat.translation.languages.v1';
const TRANSLATION_CACHE_KEY = 'synzapp.chat.translation.cache.v1';
const DEFAULT_LANGUAGE_CODES: ChatTranscriptLanguageCode[] = ['en-US', 'es-MX'];
const MAX_CACHED_TRANSLATIONS = 200;

export interface CachedChatTranslation extends ChatMessageTranslation {
  cachedAt: string;
  messageId: string;
  sourceTextHash: string;
}

export async function getDownloadedTranslationLanguages(): Promise<ChatTranscriptLanguageCode[]> {
  const storedJson = await AsyncStorage.getItem(TRANSLATION_LANGUAGES_KEY).catch(() => null);
  const storedCodes = parseLanguageCodes(storedJson);

  return uniqueLanguageCodes([...DEFAULT_LANGUAGE_CODES, ...storedCodes]);
}

export async function saveDownloadedTranslationLanguage(code: ChatTranscriptLanguageCode): Promise<ChatTranscriptLanguageCode[]> {
  const languages = uniqueLanguageCodes([
    ...(await getDownloadedTranslationLanguages()),
    code
  ]);

  await AsyncStorage.setItem(TRANSLATION_LANGUAGES_KEY, JSON.stringify(languages));

  return languages;
}

export async function getCachedChatTranslation(input: {
  messageId: string;
  sourceText: string;
  targetLanguageCode: ChatTranscriptLanguageCode;
}): Promise<CachedChatTranslation | null> {
  const cache = await readTranslationCache();
  const cacheKey = getTranslationCacheKey(input.messageId, input.sourceText, input.targetLanguageCode);

  return cache[cacheKey] || null;
}

export async function saveCachedChatTranslation(input: {
  messageId: string;
  sourceText: string;
  translation: ChatMessageTranslation;
}): Promise<void> {
  const cache = await readTranslationCache();
  const cacheKey = getTranslationCacheKey(
    input.messageId,
    input.sourceText,
    input.translation.targetLanguageCode
  );

  cache[cacheKey] = {
    ...input.translation,
    cachedAt: new Date().toISOString(),
    messageId: input.messageId,
    sourceTextHash: hashText(input.sourceText)
  };

  const sortedEntries = Object.entries(cache)
    .sort(([, first], [, second]) => second.cachedAt.localeCompare(first.cachedAt))
    .slice(0, MAX_CACHED_TRANSLATIONS);

  await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(sortedEntries)));
}

function parseLanguageCodes(storedJson: string | null): ChatTranscriptLanguageCode[] {
  if (!storedJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedJson);

    return Array.isArray(parsed)
      ? parsed.filter(isChatTranscriptLanguageCode)
      : [];
  } catch {
    return [];
  }
}

async function readTranslationCache(): Promise<Record<string, CachedChatTranslation>> {
  const storedJson = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY).catch(() => null);

  if (!storedJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(storedJson);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, CachedChatTranslation>
      : {};
  } catch {
    return {};
  }
}

function getTranslationCacheKey(
  messageId: string,
  sourceText: string,
  targetLanguageCode: ChatTranscriptLanguageCode
): string {
  return `${messageId}:${targetLanguageCode}:${hashText(sourceText)}`;
}

function hashText(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function uniqueLanguageCodes(codes: ChatTranscriptLanguageCode[]): ChatTranscriptLanguageCode[] {
  return Array.from(new Set(codes.filter(isChatTranscriptLanguageCode)));
}

function isChatTranscriptLanguageCode(value: unknown): value is ChatTranscriptLanguageCode {
  return (
    value === 'ar-SA' ||
    value === 'da-DK' ||
    value === 'de-DE' ||
    value === 'en-AU' ||
    value === 'en-CA' ||
    value === 'en-GB' ||
    value === 'en-IN' ||
    value === 'en-US' ||
    value === 'es-ES' ||
    value === 'es-MX' ||
    value === 'fr-CA' ||
    value === 'fr-FR' ||
    value === 'hi-IN' ||
    value === 'it-IT' ||
    value === 'ja-JP' ||
    value === 'ko-KR' ||
    value === 'nl-BE' ||
    value === 'nl-NL' ||
    value === 'pt-BR' ||
    value === 'yue-CN' ||
    value === 'zh-CN' ||
    value === 'zh-HK' ||
    value === 'zh-TW'
  );
}
