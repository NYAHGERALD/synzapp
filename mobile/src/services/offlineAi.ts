import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { strFromU8, unzipSync } from 'fflate';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';

const OFFLINE_AI_STATE_KEY = 'synzapp.offlineAi.state.v1';
const OFFLINE_AI_CHAT_KEY_STORAGE_KEY = 'synzapp.offlineAi.chatKey.v1';
const OFFLINE_AI_CONVERSATION_LIMIT = 60;
const OFFLINE_AI_MESSAGE_LIMIT = 160;
const OFFLINE_AI_ATTACHMENT_LIMIT_PER_MESSAGE = 8;
const OFFLINE_AI_NATIVE_ATTACHMENT_LIMIT = 6;
const OFFLINE_AI_TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;
const OFFLINE_AI_TEXT_PREVIEW_MAX_CHARS = 12000;
const OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
const OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_CHARS = 12000;
const OFFLINE_AI_ANDROID_RESPONSE_MAX_TOKENS = 384;
const OFFLINE_AI_IOS_RESPONSE_MAX_TOKENS = 768;
const OFFLINE_AI_ANDROID_PROMPT_LIMITS = {
  attachmentTextChars: 520,
  latestUserMessageChars: 560,
  recentMessageChars: 180,
  recentMessageCount: 6
};
const OFFLINE_AI_DEFAULT_PROMPT_LIMITS = {
  attachmentTextChars: 1400,
  latestUserMessageChars: 1200,
  recentMessageChars: 500,
  recentMessageCount: 18
};
const OFFLINE_AI_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}Synzapp/OfflineAI/`
  : FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}Synzapp/OfflineAI/`
    : '';
const offlineAiSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'synzapp.offline.ai.chat.v1'
};

export const synzappOfflineAiModel = {
  displayName: 'Synzapp Offline AI',
  fileName: 'gemma-4-E2B-it.litertlm',
  id: 'gemma-4-e2b-it-litertlm',
  license: 'Apache-2.0',
  provider: 'Synzapp AI',
  repository: 'litert-community/gemma-4-E2B-it-litert-lm',
  sizeBytes: 2588147712,
  sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
  supportsNativeAudioInput: false,
  supportsNativeImageInput: false
} as const;

export type OfflineAiInstallStatus = 'available' | 'downloading' | 'failed' | 'installed';

export interface OfflineAiModelState {
  downloadedBytes: number;
  errorMessage?: string;
  installedAt?: string;
  localUri?: string;
  modelId: string;
  progress: number;
  status: OfflineAiInstallStatus;
  totalBytes: number;
  updatedAt: string;
}

export interface OfflineAiInstallProgress {
  downloadedBytes: number;
  progress: number;
  totalBytes: number;
}

export interface OfflineAiChatScope {
  ownerUid: string;
  tenantId: string;
}

export interface OfflineAiProfileContext {
  companyName?: string | null;
  departmentName?: string | null;
  displayName?: string | null;
  phoneFormatted?: string | null;
  roleName?: string | null;
}

export interface OfflineAiAttachment {
  contentType: string;
  createdAt: string;
  durationMs?: number;
  fileName: string;
  height?: number;
  id: string;
  kind: 'audio' | 'file' | 'image' | 'video';
  sizeBytes: number;
  textPreview?: string;
  uri?: string;
  width?: number;
}

export interface OfflineAiAttachmentInput {
  contentType: string;
  durationMs?: number;
  fileName: string;
  height?: number;
  kind: OfflineAiAttachment['kind'];
  sizeBytes: number;
  uri?: string;
  width?: number;
}

export interface OfflineAiChatMessage {
  attachments?: OfflineAiAttachment[];
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
  status?: 'seen';
  text: string;
}

export interface OfflineAiConversation {
  createdAt: string;
  id: string;
  messages: OfflineAiChatMessage[];
  ownerUid: string;
  tenantId: string;
  title: string;
  updatedAt: string;
  version: 1;
}

interface OfflineAiConversationListRecord {
  conversations: OfflineAiConversation[];
  ownerUid: string;
  tenantId: string;
  updatedAt: string;
  version: 1;
}

interface OfflineAiEncryptedPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

interface OfflineAiGenerationContext {
  profile?: OfflineAiProfileContext | null;
  recentMessages?: OfflineAiChatMessage[];
}

interface NativeOfflineAiAttachmentPayload {
  contentType: string;
  fileName: string;
  kind: 'audio' | 'image';
  uri: string;
}

interface NativeOfflineAiDocumentTextResult {
  pageCount?: number;
  source?: string;
  text?: string;
}

interface SynzappOfflineAiNativeModule {
  extractDocumentText?: (
    uri: string,
    contentType?: string,
    fileName?: string,
    maxChars?: number
  ) => Promise<NativeOfflineAiDocumentTextResult>;
  generate?: (
    modelPath: string,
    prompt: string,
    maxTokens?: number,
    temperature?: number
  ) => Promise<{ text?: string } | string>;
  generateWithAttachments?: (
    modelPath: string,
    prompt: string,
    attachmentsJson?: string,
    maxTokens?: number,
    temperature?: number
  ) => Promise<{ text?: string } | string>;
  isAvailable?: () => Promise<boolean>;
}

const defaultOfflineAiState: OfflineAiModelState = {
  downloadedBytes: 0,
  modelId: synzappOfflineAiModel.id,
  progress: 0,
  status: 'available',
  totalBytes: synzappOfflineAiModel.sizeBytes,
  updatedAt: new Date(0).toISOString()
};

export async function loadOfflineAiState(): Promise<OfflineAiModelState> {
  const storedState = await readStoredOfflineAiState();
  const localUri = storedState.localUri || getOfflineAiModelUri();

  if (localUri) {
    const modelInfo = await FileSystem.getInfoAsync(localUri).catch(() => null);

    if (modelInfo?.exists && isCompleteOfflineAiModelSize(modelInfo.size)) {
      const installedState: OfflineAiModelState = {
        ...storedState,
        downloadedBytes: modelInfo.size || synzappOfflineAiModel.sizeBytes,
        errorMessage: undefined,
        installedAt: storedState.installedAt || new Date().toISOString(),
        localUri,
        modelId: synzappOfflineAiModel.id,
        progress: 1,
        status: 'installed',
        totalBytes: synzappOfflineAiModel.sizeBytes,
        updatedAt: new Date().toISOString()
      };

      await persistOfflineAiState(installedState);

      return installedState;
    }
  }

  if (storedState.status === 'installed') {
    const repairedState: OfflineAiModelState = {
      ...defaultOfflineAiState,
      errorMessage: 'Synzapp AI offline support is no longer on this device.',
      status: 'failed',
      updatedAt: new Date().toISOString()
    };

    await persistOfflineAiState(repairedState);

    return repairedState;
  }

  return {
    ...defaultOfflineAiState,
    ...storedState,
    modelId: synzappOfflineAiModel.id,
    totalBytes: synzappOfflineAiModel.sizeBytes
  };
}

export async function installOfflineAiModel(
  onProgress?: (progress: OfflineAiInstallProgress) => void
): Promise<OfflineAiModelState> {
  if (!OFFLINE_AI_DIRECTORY) {
    throw new Error('This device cannot create secure local storage for Synzapp AI.');
  }

  const totalBytes = synzappOfflineAiModel.sizeBytes;
  const freeDiskBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);

  if (typeof freeDiskBytes === 'number' && freeDiskBytes < totalBytes + 700 * 1024 * 1024) {
    throw new Error(`Synzapp Offline AI needs about ${formatOfflineAiBytes(totalBytes)} plus working space. Free storage is too low on this device.`);
  }

  await FileSystem.makeDirectoryAsync(OFFLINE_AI_DIRECTORY, { intermediates: true });

  const modelUri = getOfflineAiModelUri();
  const temporaryUri = `${modelUri}.download`;
  await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);

  const downloadingState: OfflineAiModelState = {
    downloadedBytes: 0,
    localUri: modelUri,
    modelId: synzappOfflineAiModel.id,
    progress: 0,
    status: 'downloading',
    totalBytes,
    updatedAt: new Date().toISOString()
  };
  await persistOfflineAiState(downloadingState);

  const download = FileSystem.createDownloadResumable(
    synzappOfflineAiModel.sourceUrl,
    temporaryUri,
    {},
    (progressEvent) => {
      const expectedBytes = progressEvent.totalBytesExpectedToWrite || totalBytes;
      const writtenBytes = progressEvent.totalBytesWritten || 0;
      const nextProgress = expectedBytes > 0
        ? Math.max(0, Math.min(writtenBytes / expectedBytes, 1))
        : 0;

      onProgress?.({
        downloadedBytes: writtenBytes,
        progress: nextProgress,
        totalBytes: expectedBytes
      });
    }
  );

  try {
    const result = await download.downloadAsync();

    if (!result?.uri) {
      throw new Error('Synzapp AI did not finish installing.');
    }

    const downloadedInfo = await FileSystem.getInfoAsync(result.uri);

    if (!downloadedInfo.exists || !isCompleteOfflineAiModelSize(downloadedInfo.size)) {
      throw new Error('Synzapp AI did not install completely. Please try again on a stable Wi-Fi connection.');
    }

    await FileSystem.deleteAsync(modelUri, { idempotent: true }).catch(() => undefined);
    await FileSystem.moveAsync({ from: result.uri, to: modelUri });

    const installedState: OfflineAiModelState = {
      downloadedBytes: downloadedInfo.size || totalBytes,
      installedAt: new Date().toISOString(),
      localUri: modelUri,
      modelId: synzappOfflineAiModel.id,
      progress: 1,
      status: 'installed',
      totalBytes,
      updatedAt: new Date().toISOString()
    };

    await persistOfflineAiState(installedState);

    return installedState;
  } catch (error) {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);

    const failedState: OfflineAiModelState = {
      ...defaultOfflineAiState,
      errorMessage: error instanceof Error ? error.message : 'Unable to install Synzapp Offline AI.',
      status: 'failed',
      updatedAt: new Date().toISOString()
    };
    await persistOfflineAiState(failedState);

    throw error;
  }
}

export async function deleteOfflineAiModel(): Promise<OfflineAiModelState> {
  const modelUri = getOfflineAiModelUri();
  await FileSystem.deleteAsync(modelUri, { idempotent: true }).catch(() => undefined);
  await FileSystem.deleteAsync(`${modelUri}.download`, { idempotent: true }).catch(() => undefined);

  const nextState: OfflineAiModelState = {
    ...defaultOfflineAiState,
    updatedAt: new Date().toISOString()
  };

  await persistOfflineAiState(nextState);

  return nextState;
}

export async function isOfflineAiRuntimeAvailable(): Promise<boolean> {
  const nativeModule = getNativeOfflineAiModule();

  if (!nativeModule?.isAvailable) {
    return false;
  }

  return nativeModule.isAvailable().catch(() => false);
}

export async function loadOfflineAiConversations(input: OfflineAiChatScope): Promise<OfflineAiConversation[]> {
  const scope = normalizeOfflineAiScope(input);

  if (!scope) {
    return [];
  }

  const encryptedValue = await AsyncStorage.getItem(getOfflineAiConversationsStorageKey(scope));

  if (!encryptedValue) {
    return [];
  }

  const record = await decryptOfflineAiJson<OfflineAiConversationListRecord>(encryptedValue);

  if (!isMatchingOfflineAiRecord(record, scope)) {
    return [];
  }

  return normalizeOfflineAiConversations(record.conversations, scope);
}

export async function saveOfflineAiConversations(input: {
  conversations: OfflineAiConversation[];
  ownerUid: string;
  tenantId: string;
}): Promise<void> {
  const scope = normalizeOfflineAiScope(input);

  if (!scope) {
    return;
  }

  const conversations = normalizeOfflineAiConversations(input.conversations, scope);
  const record: OfflineAiConversationListRecord = {
    conversations,
    ownerUid: scope.ownerUid,
    tenantId: scope.tenantId,
    updatedAt: new Date().toISOString(),
    version: 1
  };

  await AsyncStorage.setItem(
    getOfflineAiConversationsStorageKey(scope),
    await encryptOfflineAiJson(record)
  );
}

export function createOfflineAiConversation(input: OfflineAiChatScope): OfflineAiConversation {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    id: `ai_${Date.now()}_${randomHex(6)}`,
    messages: [],
    ownerUid: input.ownerUid,
    tenantId: input.tenantId,
    title: 'New Synzapp AI chat',
    updatedAt: now,
    version: 1
  };
}

export function createOfflineAiMessage(input: {
  attachments?: OfflineAiAttachment[];
  role: OfflineAiChatMessage['role'];
  status?: OfflineAiChatMessage['status'];
  text: string;
}): OfflineAiChatMessage {
  const attachments = normalizeOfflineAiAttachments(input.attachments);

  return {
    attachments: attachments.length ? attachments : undefined,
    createdAt: new Date().toISOString(),
    id: `aimsg_${Date.now()}_${randomHex(6)}`,
    role: input.role,
    status: input.status,
    text: input.text.trim() || (attachments.length ? getOfflineAiAttachmentFallbackText(attachments) : '')
  };
}

export async function createOfflineAiAttachment(
  input: OfflineAiAttachmentInput
): Promise<OfflineAiAttachment> {
  const safeContentType = input.contentType.trim() || 'application/octet-stream';
  const safeFileName = sanitizeOfflineAiFileName(input.fileName);

  return {
    contentType: safeContentType,
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    fileName: safeFileName,
    height: input.height,
    id: `aiatt_${Date.now()}_${randomHex(6)}`,
    kind: input.kind,
    sizeBytes: Math.max(Math.round(input.sizeBytes || 0), 0),
    textPreview: await readOfflineAiTextPreview(input),
    uri: input.uri,
    width: input.width
  };
}

export function getOfflineAiConversationTitle(messageText: string): string {
  const normalizedText = messageText.trim().replace(/\s+/g, ' ');

  if (!normalizedText) {
    return 'New Synzapp AI chat';
  }

  return normalizedText.length > 42
    ? `${normalizedText.slice(0, 39)}...`
    : normalizedText;
}

export async function generateOfflineAiResponse(
  prompt: string,
  modelPath: string,
  context?: OfflineAiGenerationContext
): Promise<string> {
  const nativeModule = getNativeOfflineAiModule();

  if (!nativeModule?.generate) {
    throw new Error('Synzapp AI is installed, but this app build does not include offline AI support yet. Install the latest development build and try again.');
  }

  const nativeAttachments = await buildNativeOfflineAiAttachmentPayload(context?.recentMessages, {
    includeAudio: synzappOfflineAiModel.supportsNativeAudioInput,
    includeImage: synzappOfflineAiModel.supportsNativeImageInput
  });
  const compiledPrompt = buildSynzappOfflinePrompt(prompt, context, nativeAttachments.length);
  const maxOutputTokens = getOfflineAiResponseMaxTokens();
  const response = nativeAttachments.length && nativeModule.generateWithAttachments
    ? await nativeModule.generateWithAttachments(
        modelPath,
        compiledPrompt,
        JSON.stringify(nativeAttachments),
        maxOutputTokens,
        0.4
      )
    : await nativeModule.generate(
        modelPath,
        compiledPrompt,
        maxOutputTokens,
        0.4
      );

  if (typeof response === 'string') {
    return response.trim();
  }

  return (response.text || '').trim();
}

export function getOfflineAiModelUri(): string {
  return OFFLINE_AI_DIRECTORY
    ? `${OFFLINE_AI_DIRECTORY}${synzappOfflineAiModel.fileName}`
    : '';
}

export function formatOfflineAiBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }

  const gib = bytes / (1024 * 1024 * 1024);

  if (gib >= 1) {
    return `${gib.toFixed(gib >= 10 ? 0 : 1)} GB`;
  }

  const mib = bytes / (1024 * 1024);

  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MB`;
}

function getNativeOfflineAiModule(): SynzappOfflineAiNativeModule | null {
  return requireOptionalNativeModule<SynzappOfflineAiNativeModule>('SynzappOfflineAi');
}

async function readStoredOfflineAiState(): Promise<OfflineAiModelState> {
  const storedJson = await AsyncStorage.getItem(OFFLINE_AI_STATE_KEY).catch(() => null);

  if (!storedJson) {
    return defaultOfflineAiState;
  }

  try {
    const parsedState = JSON.parse(storedJson) as Partial<OfflineAiModelState>;

    return {
      ...defaultOfflineAiState,
      ...parsedState,
      downloadedBytes: typeof parsedState.downloadedBytes === 'number' ? parsedState.downloadedBytes : 0,
      progress: typeof parsedState.progress === 'number' ? parsedState.progress : 0,
      totalBytes: synzappOfflineAiModel.sizeBytes
    };
  } catch {
    return defaultOfflineAiState;
  }
}

async function persistOfflineAiState(state: OfflineAiModelState): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_AI_STATE_KEY, JSON.stringify(state));
}

function isCompleteOfflineAiModelSize(size?: number): boolean {
  if (typeof size !== 'number') {
    return false;
  }

  return size >= synzappOfflineAiModel.sizeBytes * 0.995;
}

function buildSynzappOfflinePrompt(
  prompt: string,
  context?: OfflineAiGenerationContext,
  nativeAttachmentCount = 0
): string {
  const promptLimits = getOfflineAiPromptLimits();
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'mobile';
  const profileLines = buildOfflineAiProfileLines(context?.profile);
  const attachmentCapabilityLine = buildOfflineAiAttachmentCapabilityLine(context?.recentMessages, nativeAttachmentCount);
  const recentMessages = (context?.recentMessages || [])
    .slice(-promptLimits.recentMessageCount)
    .map((message) => {
      const attachmentLines = buildOfflineAiAttachmentPromptLines(message.attachments, promptLimits.attachmentTextChars);
      const textLine = `${message.role === 'user' ? 'User' : 'Synzapp AI'}: ${truncatePromptText(message.text, promptLimits.recentMessageChars)}`;

      return [textLine, ...attachmentLines.map((line) => `  ${line}`)].join('\n');
    });

  return [
    'You are Synzapp AI, a private on-device workplace assistant.',
    `You are running locally on the user's ${platformLabel} device.`,
    'Be direct, practical, respectful, and security-conscious.',
    'Answer the latest user message first. Do not respond with a list of clarifying questions before giving useful guidance.',
    'When exact company policy is not provided, give general workplace best-practice guidance tailored to the available profile context and clearly say what you are assuming.',
    'Ask at most one short clarifying question at the end only when it is truly needed for the next step.',
    'For supervisor, manager, team, delegation, responsibility, policy, or workplace-process questions, provide a concrete step-by-step answer with examples the user can act on.',
    'Use only the profile context and conversation context provided below.',
    'Do not claim to access cloud data, organization data, workplace chat history, live internet, or files unless those details appear in this prompt.',
    attachmentCapabilityLine,
    profileLines.length ? '' : null,
    profileLines.length ? 'Current user profile context:' : null,
    ...profileLines,
    recentMessages.length ? '' : null,
    recentMessages.length ? 'Recent conversation:' : null,
    ...recentMessages,
    '',
    `Latest user message: ${truncatePromptText(prompt.trim(), promptLimits.latestUserMessageChars)}`
  ].filter((line): line is string => line !== null).join('\n');
}

function getOfflineAiResponseMaxTokens(): number {
  return Platform.OS === 'android'
    ? OFFLINE_AI_ANDROID_RESPONSE_MAX_TOKENS
    : OFFLINE_AI_IOS_RESPONSE_MAX_TOKENS;
}

function getOfflineAiPromptLimits(): typeof OFFLINE_AI_ANDROID_PROMPT_LIMITS {
  return Platform.OS === 'android'
    ? OFFLINE_AI_ANDROID_PROMPT_LIMITS
    : OFFLINE_AI_DEFAULT_PROMPT_LIMITS;
}

function buildOfflineAiProfileLines(profile?: OfflineAiProfileContext | null): string[] {
  if (!profile) {
    return [];
  }

  return [
    ['Name', profile.displayName],
    ['Company', profile.companyName],
    ['Department', profile.departmentName],
    ['Role', profile.roleName],
    ['Phone', profile.phoneFormatted]
  ]
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([label, value]) => `${label}: ${truncatePromptText(String(value).trim(), 120)}`);
}

function buildOfflineAiAttachmentCapabilityLine(
  messages: OfflineAiChatMessage[] | undefined,
  nativeAttachmentCount: number
): string {
  if (nativeAttachmentCount > 0) {
    return `${nativeAttachmentCount} image/audio attachment${nativeAttachmentCount === 1 ? ' is' : 's are'} included as native device input for this response.`;
  }

  const attachments = (messages || []).flatMap((message) => normalizeOfflineAiAttachments(message.attachments));
  const hasImage = attachments.some((attachment) => attachment.kind === 'image' || attachment.contentType.toLowerCase().startsWith('image/'));
  const hasAudio = attachments.some((attachment) => attachment.kind === 'audio' || attachment.contentType.toLowerCase().startsWith('audio/'));
  const hasFile = attachments.some((attachment) => attachment.kind === 'file');

  if (hasImage || hasAudio || hasFile) {
    return [
      'Attachments are represented by extracted text and metadata in the conversation below.',
      hasImage
        ? 'For images, use OCR text when present plus file name, type, size, and dimensions; do not claim visual details that are not in the extracted text or metadata.'
        : null,
      hasAudio
        ? 'For audio, use only the provided metadata or transcript text when present; do not claim to hear audio that has not been transcribed.'
        : null,
      hasFile
        ? 'For files, use only extracted document text when present plus file metadata.'
        : null,
      'If the user asks what is in an attachment and no readable content is available, explain the limitation briefly and say what information is available.'
    ].filter((line): line is string => Boolean(line)).join(' ');
  }

  return 'If an attachment includes only file details and no extracted content, be clear about what you can and cannot inspect.';
}

function normalizeOfflineAiConversations(
  conversations: OfflineAiConversation[] | undefined,
  scope: OfflineAiChatScope
): OfflineAiConversation[] {
  return (conversations || [])
    .filter((conversation) =>
      conversation?.version === 1 &&
      conversation.ownerUid === scope.ownerUid &&
      conversation.tenantId === scope.tenantId &&
      typeof conversation.id === 'string'
    )
    .map((conversation) => ({
      ...conversation,
      messages: normalizeOfflineAiMessages(conversation.messages),
      title: conversation.title?.trim() || 'Synzapp AI chat',
      updatedAt: conversation.updatedAt || conversation.createdAt || new Date(0).toISOString()
    }))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
    .slice(0, OFFLINE_AI_CONVERSATION_LIMIT);
}

function normalizeOfflineAiMessages(messages: OfflineAiChatMessage[] | undefined): OfflineAiChatMessage[] {
  return (messages || [])
    .filter((message) =>
      typeof message?.id === 'string' &&
      (message.role === 'assistant' || message.role === 'user') &&
      typeof message.text === 'string'
    )
    .map((message) => ({
      ...message,
      attachments: normalizeOfflineAiAttachments(message.attachments),
      text: message.text.trim()
    }))
    .filter((message) => message.text || message.attachments?.length)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .slice(-OFFLINE_AI_MESSAGE_LIMIT);
}

function normalizeOfflineAiAttachments(
  attachments: OfflineAiAttachment[] | undefined
): OfflineAiAttachment[] {
  return (attachments || [])
    .filter((attachment) =>
      typeof attachment?.id === 'string' &&
      typeof attachment.fileName === 'string' &&
      typeof attachment.contentType === 'string' &&
      (attachment.kind === 'audio' || attachment.kind === 'file' || attachment.kind === 'image' || attachment.kind === 'video')
    )
    .map((attachment) => ({
      ...attachment,
      contentType: attachment.contentType.trim() || 'application/octet-stream',
      fileName: sanitizeOfflineAiFileName(attachment.fileName),
      sizeBytes: Math.max(Math.round(attachment.sizeBytes || 0), 0),
      textPreview: typeof attachment.textPreview === 'string'
        ? truncatePromptText(attachment.textPreview, OFFLINE_AI_TEXT_PREVIEW_MAX_CHARS)
        : undefined
    }))
    .slice(0, OFFLINE_AI_ATTACHMENT_LIMIT_PER_MESSAGE);
}

function isMatchingOfflineAiRecord(
  record: Partial<OfflineAiConversationListRecord> | null | undefined,
  scope: OfflineAiChatScope
): record is OfflineAiConversationListRecord {
  return record?.version === 1 &&
    record.ownerUid === scope.ownerUid &&
    record.tenantId === scope.tenantId &&
    Array.isArray(record.conversations);
}

function normalizeOfflineAiScope(input: {
  ownerUid?: string | null;
  tenantId?: string | null;
}): OfflineAiChatScope | null {
  const ownerUid = typeof input.ownerUid === 'string' ? input.ownerUid.trim() : '';
  const tenantId = typeof input.tenantId === 'string' ? input.tenantId.trim() : '';

  if (!ownerUid || !tenantId) {
    return null;
  }

  return {
    ownerUid,
    tenantId
  };
}

function getOfflineAiConversationsStorageKey(scope: OfflineAiChatScope): string {
  return `synzapp.offlineAi.conversations.v1.${sanitizeStorageKey(scope.ownerUid)}.${sanitizeStorageKey(scope.tenantId)}`;
}

async function encryptOfflineAiJson(value: unknown): Promise<string> {
  const key = await getOrCreateOfflineAiChatKey();
  const nonce = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const plaintext = utf8ToBytes(JSON.stringify(value));
  const ciphertext = nacl.secretbox(plaintext, nonce, key);
  const payload: OfflineAiEncryptedPayload = {
    ciphertext: fromByteArray(ciphertext),
    nonce: fromByteArray(nonce),
    version: 1
  };

  return JSON.stringify(payload);
}

async function decryptOfflineAiJson<T>(encryptedValue: string): Promise<T | null> {
  try {
    const payload = JSON.parse(encryptedValue) as Partial<OfflineAiEncryptedPayload>;

    if (payload.version !== 1 || !payload.ciphertext || !payload.nonce) {
      return null;
    }

    const key = await getOrCreateOfflineAiChatKey();
    const plaintext = nacl.secretbox.open(
      toByteArray(payload.ciphertext),
      toByteArray(payload.nonce),
      key
    );

    if (!plaintext) {
      return null;
    }

    return JSON.parse(bytesToUtf8(plaintext)) as T;
  } catch {
    return null;
  }
}

async function getOrCreateOfflineAiChatKey(): Promise<Uint8Array> {
  const secureStoreAvailable = await SecureStore.isAvailableAsync();

  if (!secureStoreAvailable) {
    throw new Error('Secure device storage is not available.');
  }

  const existingKey = await SecureStore.getItemAsync(
    OFFLINE_AI_CHAT_KEY_STORAGE_KEY,
    offlineAiSecureStoreOptions
  );

  if (existingKey) {
    return toByteArray(existingKey);
  }

  const key = Crypto.getRandomBytes(nacl.secretbox.keyLength);

  await SecureStore.setItemAsync(
    OFFLINE_AI_CHAT_KEY_STORAGE_KEY,
    fromByteArray(key),
    offlineAiSecureStoreOptions
  );

  return key;
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeStorageKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function truncatePromptText(value: string, maxLength: number): string {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength - 3)}...`
    : normalizedValue;
}

function buildOfflineAiAttachmentPromptLines(attachments?: OfflineAiAttachment[], textPreviewMaxChars = 900): string[] {
  return normalizeOfflineAiAttachments(attachments).flatMap((attachment, index) => {
    const dimensions = attachment.width && attachment.height
      ? `, ${attachment.width}x${attachment.height}`
      : '';
    const duration = attachment.durationMs
      ? `, duration ${formatOfflineAiDuration(attachment.durationMs)}`
      : '';
    const baseLine = `Attachment ${index + 1}: ${attachment.kind}, ${attachment.fileName}, ${attachment.contentType}, ${formatOfflineAiBytes(attachment.sizeBytes)}${dimensions}${duration}.`;

    if (!attachment.textPreview) {
      return [baseLine];
    }

    return [
      baseLine,
      `Extracted text preview: ${truncatePromptText(attachment.textPreview, textPreviewMaxChars)}`
    ];
  });
}

async function buildNativeOfflineAiAttachmentPayload(
  messages: OfflineAiChatMessage[] | undefined,
  options: { includeAudio: boolean; includeImage: boolean }
): Promise<NativeOfflineAiAttachmentPayload[]> {
  const candidates = (messages || [])
    .slice(-8)
    .flatMap((message) => message.attachments || [])
    .filter((attachment) => {
      const nativeKind = getNativeOfflineAiAttachmentKind(attachment);

      return nativeKind &&
        isNativeOfflineAiAttachmentEnabled(nativeKind, options) &&
        attachment.uri;
    })
    .slice(-OFFLINE_AI_NATIVE_ATTACHMENT_LIMIT);
  const payload: NativeOfflineAiAttachmentPayload[] = [];

  for (const attachment of candidates) {
    const nativeKind = getNativeOfflineAiAttachmentKind(attachment);

    if (!nativeKind || !attachment.uri || !isLocalOfflineAiAttachmentUri(attachment.uri)) {
      continue;
    }

    const fileInfo = await FileSystem.getInfoAsync(attachment.uri).catch(() => null);

    if (!fileInfo?.exists) {
      continue;
    }

    payload.push({
      contentType: attachment.contentType,
      fileName: attachment.fileName,
      kind: nativeKind,
      uri: attachment.uri
    });
  }

  return payload;
}

function isNativeOfflineAiAttachmentEnabled(
  kind: NativeOfflineAiAttachmentPayload['kind'],
  options: { includeAudio: boolean; includeImage: boolean }
): boolean {
  return kind === 'image'
    ? options.includeImage
    : options.includeAudio;
}

function getNativeOfflineAiAttachmentKind(
  attachment: OfflineAiAttachment
): NativeOfflineAiAttachmentPayload['kind'] | null {
  const safeContentType = attachment.contentType.trim().toLowerCase();

  if (attachment.kind === 'image' || safeContentType.startsWith('image/')) {
    return 'image';
  }

  if (attachment.kind === 'audio' || safeContentType.startsWith('audio/')) {
    return 'audio';
  }

  return null;
}

function isLocalOfflineAiAttachmentUri(uri: string): boolean {
  return uri.startsWith('file://') ||
    (FileSystem.documentDirectory ? uri.startsWith(FileSystem.documentDirectory) : false) ||
    (FileSystem.cacheDirectory ? uri.startsWith(FileSystem.cacheDirectory) : false);
}

async function readOfflineAiTextPreview(input: OfflineAiAttachmentInput): Promise<string | undefined> {
  if (!input.uri || !isLocalOfflineAiAttachmentUri(input.uri)) {
    return undefined;
  }

  const plainTextPreview = await readOfflineAiPlainTextPreview(input);

  if (plainTextPreview) {
    return plainTextPreview;
  }

  const openXmlPreview = await readOfflineAiOpenXmlTextPreview(input);

  if (openXmlPreview) {
    return openXmlPreview;
  }

  return readNativeOfflineAiDocumentTextPreview(input);
}

async function readOfflineAiPlainTextPreview(input: OfflineAiAttachmentInput): Promise<string | undefined> {
  if (!input.uri || input.kind !== 'file' || input.sizeBytes > OFFLINE_AI_TEXT_PREVIEW_MAX_BYTES) {
    return undefined;
  }

  if (!isOfflineAiTextReadable(input.contentType, input.fileName)) {
    return undefined;
  }

  try {
    const fileText = await FileSystem.readAsStringAsync(input.uri, {
      encoding: FileSystem.EncodingType.UTF8
    });

    return truncatePromptText(
      fileText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' '),
      OFFLINE_AI_TEXT_PREVIEW_MAX_CHARS
    );
  } catch {
    return undefined;
  }
}

async function readOfflineAiOpenXmlTextPreview(input: OfflineAiAttachmentInput): Promise<string | undefined> {
  if (
    !input.uri ||
    input.kind !== 'file' ||
    input.sizeBytes > OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_BYTES ||
    !isOfflineAiOpenXmlReadable(input.contentType, input.fileName)
  ) {
    return undefined;
  }

  try {
    const fileBase64 = await FileSystem.readAsStringAsync(input.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    const entries = unzipSync(toByteArray(fileBase64));
    const documentType = getOfflineAiOpenXmlDocumentType(input.contentType, input.fileName);
    const text = extractOfflineAiOpenXmlText(entries, documentType, OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_CHARS);

    return text
      ? truncatePromptText(text, OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_CHARS)
      : undefined;
  } catch {
    return undefined;
  }
}

async function readNativeOfflineAiDocumentTextPreview(input: OfflineAiAttachmentInput): Promise<string | undefined> {
  if (
    !input.uri ||
    input.sizeBytes > OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_BYTES ||
    !isNativeOfflineAiDocumentTextReadable(input.contentType, input.fileName, input.kind)
  ) {
    return undefined;
  }

  const nativeModule = getNativeOfflineAiModule();

  if (!nativeModule?.extractDocumentText) {
    return undefined;
  }

  try {
    const result = await nativeModule.extractDocumentText(
      input.uri,
      input.contentType,
      input.fileName,
      OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_CHARS
    );
    const text = result?.text?.trim();

    return text
      ? truncatePromptText(text, OFFLINE_AI_DOCUMENT_TEXT_PREVIEW_MAX_CHARS)
      : undefined;
  } catch {
    return undefined;
  }
}

function isOfflineAiTextReadable(contentType: string, fileName: string): boolean {
  const safeContentType = contentType.trim().toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  return safeContentType.startsWith('text/') ||
    [
      'application/json',
      'application/ld+json',
      'application/xml',
      'application/yaml',
      'application/x-yaml',
      'application/javascript',
      'application/x-javascript',
      'application/csv'
    ].includes(safeContentType) ||
    ['csv', 'json', 'log', 'md', 'txt', 'xml', 'yaml', 'yml'].includes(extension);
}

function isOfflineAiOpenXmlReadable(contentType: string, fileName: string): boolean {
  return getOfflineAiOpenXmlDocumentType(contentType, fileName) !== null;
}

function getOfflineAiOpenXmlDocumentType(
  contentType: string,
  fileName: string
): 'docx' | 'pptx' | 'xlsx' | null {
  const safeContentType = contentType.trim().toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (
    extension === 'docx' ||
    safeContentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }

  if (
    extension === 'pptx' ||
    safeContentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'pptx';
  }

  if (
    extension === 'xlsx' ||
    safeContentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx';
  }

  return null;
}

function isNativeOfflineAiDocumentTextReadable(
  contentType: string,
  fileName: string,
  kind: OfflineAiAttachment['kind']
): boolean {
  const safeContentType = contentType.trim().toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  return kind === 'image' ||
    safeContentType.startsWith('image/') ||
    safeContentType === 'application/pdf' ||
    extension === 'pdf';
}

function extractOfflineAiOpenXmlText(
  entries: Record<string, Uint8Array>,
  documentType: 'docx' | 'pptx' | 'xlsx' | null,
  maxChars: number
): string {
  if (!documentType) {
    return '';
  }

  const entryNames = Object.keys(entries)
    .filter((entryName) => isOfflineAiOpenXmlTextEntry(entryName, documentType))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));
  let extractedText = '';

  for (const entryName of entryNames) {
    if (extractedText.length >= maxChars) {
      break;
    }

    const xmlText = strFromU8(entries[entryName]);
    const text = stripOfflineAiXmlText(xmlText);
    extractedText = appendOfflineAiTextWithLimit(extractedText, text, maxChars);
  }

  return extractedText.trim();
}

function isOfflineAiOpenXmlTextEntry(
  entryName: string,
  documentType: 'docx' | 'pptx' | 'xlsx'
): boolean {
  if (documentType === 'docx') {
    return entryName === 'word/document.xml' ||
      /^word\/(header|footer)\d+\.xml$/.test(entryName);
  }

  if (documentType === 'pptx') {
    return /^ppt\/slides\/slide\d+\.xml$/.test(entryName) ||
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entryName);
  }

  return entryName === 'xl/sharedStrings.xml' ||
    /^xl\/worksheets\/sheet\d+\.xml$/.test(entryName);
}

function stripOfflineAiXmlText(xmlText: string): string {
  const textWithoutMarkup = xmlText
    .replace(/<\?xml[\s\S]*?\?>/g, ' ')
    .replace(/<[^>]+(?:br|tab)[^>]*\/>/gi, ' ')
    .replace(/<\/(?:w:p|a:p|p:txBody|si|row)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeOfflineAiXmlEntities(textWithoutMarkup)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeOfflineAiXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, codePoint: string) => {
      const parsedCodePoint = Number.parseInt(codePoint, 10);

      return Number.isFinite(parsedCodePoint)
        ? String.fromCodePoint(parsedCodePoint)
        : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint: string) => {
      const parsedCodePoint = Number.parseInt(codePoint, 16);

      return Number.isFinite(parsedCodePoint)
        ? String.fromCodePoint(parsedCodePoint)
        : ' ';
    });
}

function appendOfflineAiTextWithLimit(currentText: string, nextText: string, maxChars: number): string {
  const safeNextText = nextText.trim();

  if (!safeNextText || currentText.length >= maxChars) {
    return currentText;
  }

  const separator = currentText ? '\n\n' : '';
  const remainingChars = maxChars - currentText.length - separator.length;

  if (remainingChars <= 0) {
    return currentText;
  }

  return `${currentText}${separator}${safeNextText.slice(0, remainingChars)}`;
}

function getOfflineAiAttachmentFallbackText(attachments: OfflineAiAttachment[]): string {
  return attachments.length > 1
    ? `${attachments.length} attachments`
    : `Attachment: ${attachments[0]?.fileName || 'file'}`;
}

function sanitizeOfflineAiFileName(fileName: string): string {
  return (fileName || 'attachment')
    .replace(/[^\w .()+-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'attachment';
}

function formatOfflineAiDuration(durationMs: number): string {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function utf8ToBytes(value: string): Uint8Array {
  const encodedValue = encodeURIComponent(value);
  const bytes: number[] = [];

  for (let index = 0; index < encodedValue.length; index += 1) {
    if (encodedValue[index] === '%') {
      bytes.push(Number.parseInt(encodedValue.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }

    bytes.push(encodedValue.charCodeAt(index));
  }

  return new Uint8Array(bytes);
}

function bytesToUtf8(bytes: Uint8Array): string {
  const encodedValue = Array.from(bytes)
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  return decodeURIComponent(encodedValue);
}
