import { createHash } from 'crypto';
import { fieldValue, firestore } from '../config/firebaseAdmin.js';

export type ChatTranscriptLanguageCode =
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

export interface ChatTranscriptLanguageResponse {
  contactId: string;
  languageCode: ChatTranscriptLanguageCode;
  updatedAt: string | null;
}

interface ChatTranscriptLanguageRecord {
  contactId?: string;
  languageCode?: ChatTranscriptLanguageCode;
  tenantId?: string;
  uid?: string;
}

export async function getChatTranscriptLanguage(
  tenantId: string,
  uid: string,
  contactId: string
): Promise<ChatTranscriptLanguageResponse> {
  const snapshot = await getChatTranscriptLanguageRef(tenantId, uid, contactId).get();

  return normalizeChatTranscriptLanguage(contactId, snapshot.exists
    ? snapshot.data() as ChatTranscriptLanguageRecord
    : null);
}

export async function updateChatTranscriptLanguage(
  tenantId: string,
  uid: string,
  contactId: string,
  languageCode: ChatTranscriptLanguageCode
): Promise<ChatTranscriptLanguageResponse> {
  const now = new Date();
  const record: ChatTranscriptLanguageRecord = {
    contactId,
    languageCode,
    tenantId,
    uid
  };

  await getChatTranscriptLanguageRef(tenantId, uid, contactId).set({
    ...record,
    updatedAt: fieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ...normalizeChatTranscriptLanguage(contactId, record),
    updatedAt: now.toISOString()
  };
}

function normalizeChatTranscriptLanguage(
  contactId: string,
  record: ChatTranscriptLanguageRecord | null
): ChatTranscriptLanguageResponse {
  return {
    contactId,
    languageCode: isChatTranscriptLanguageCode(record?.languageCode) ? record.languageCode : 'en-US',
    updatedAt: null
  };
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

function getChatTranscriptLanguageRef(tenantId: string, uid: string, contactId: string) {
  return firestore
    .collection('organizations')
    .doc(tenantId)
    .collection('users')
    .doc(uid)
    .collection('chatTranscriptLanguages')
    .doc(createHash('sha256').update(contactId).digest('hex'));
}
