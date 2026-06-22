import { requireOptionalNativeModule } from 'expo-modules-core';

export interface SynzappOfflineAiResponse {
  text?: string;
}

export interface SynzappOfflineAiDocumentTextResult {
  pageCount?: number;
  source?: string;
  text?: string;
}

export interface SynzappOfflineAiModule {
  extractDocumentText?: (
    uri: string,
    contentType?: string,
    fileName?: string,
    maxChars?: number
  ) => Promise<SynzappOfflineAiDocumentTextResult>;
  generate: (
    modelPath: string,
    prompt: string,
    maxTokens?: number,
    temperature?: number
  ) => Promise<SynzappOfflineAiResponse | string>;
  generateWithAttachments?: (
    modelPath: string,
    prompt: string,
    attachmentsJson?: string,
    maxTokens?: number,
    temperature?: number
  ) => Promise<SynzappOfflineAiResponse | string>;
  isAvailable: () => Promise<boolean>;
}

export default requireOptionalNativeModule<SynzappOfflineAiModule>('SynzappOfflineAi');
