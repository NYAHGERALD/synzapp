import { requireOptionalNativeModule } from 'expo-modules-core';

export type SynzappBackgroundTransferStatus =
  | 'completed'
  | 'failed'
  | 'not_found'
  | 'running';

export type SynzappBackgroundTransferType = 'download' | 'upload';

export interface SynzappBackgroundTransferEvent {
  bytesExpected: number;
  bytesTransferred: number;
  destinationUri?: string;
  errorMessage?: string;
  progress: number;
  status: SynzappBackgroundTransferStatus;
  transferId: string;
  transferType: SynzappBackgroundTransferType;
}

export interface SynzappBackgroundTransferStartResult {
  transferId: string;
}

export interface SynzappBackgroundTransferStatusResult extends SynzappBackgroundTransferEvent {}

export interface SynzappBackgroundTransfersModule {
  addListener?: (
    eventName: 'onSynzappBackgroundTransferEvent',
    listener: (event: SynzappBackgroundTransferEvent) => void
  ) => { remove: () => void };
  cancelTransfer?: (transferId: string) => Promise<void>;
  getTransferStatus?: (transferId: string) => Promise<SynzappBackgroundTransferStatusResult>;
  isAvailable?: () => Promise<boolean>;
  startDownloadFile?: (input: {
    destinationUri: string;
    headers?: Record<string, string>;
    url: string;
  }) => Promise<SynzappBackgroundTransferStartResult>;
  startUploadFile?: (input: {
    fileUri: string;
    headers?: Record<string, string>;
    method?: string;
    url: string;
  }) => Promise<SynzappBackgroundTransferStartResult>;
}

export default requireOptionalNativeModule<SynzappBackgroundTransfersModule>('SynzappBackgroundTransfers');
