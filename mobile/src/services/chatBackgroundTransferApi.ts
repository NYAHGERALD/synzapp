import { Platform } from 'react-native';
import SynzappBackgroundTransfers, {
  type SynzappBackgroundTransferEvent,
  type SynzappBackgroundTransferStatusResult
} from 'synzapp-background-transfers';

const BACKGROUND_TRANSFER_POLL_INTERVAL_MS = 1000;

export interface NativeBackgroundTransferResult {
  destinationUri?: string;
  transferId: string;
}

export async function isNativeBackgroundTransferAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  if (!SynzappBackgroundTransfers?.isAvailable) {
    return false;
  }

  return SynzappBackgroundTransfers.isAvailable().catch(() => false);
}

export async function uploadFileWithNativeBackgroundTransfer(input: {
  fileUri: string;
  headers?: Record<string, string>;
  method?: string;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
  url: string;
}): Promise<NativeBackgroundTransferResult | null> {
  const result = await startUploadFileWithNativeBackgroundTransfer(input);

  if (!result) {
    return null;
  }

  input.onNativeTransferStarted?.(result.transferId);

  await waitForNativeTransfer({
    onProgress: input.onProgress,
    transferId: result.transferId
  });

  return {
    transferId: result.transferId
  };
}

export async function startUploadFileWithNativeBackgroundTransfer(input: {
  fileUri: string;
  headers?: Record<string, string>;
  method?: string;
  url: string;
}): Promise<NativeBackgroundTransferResult | null> {
  if (!await isNativeBackgroundTransferAvailable() || !SynzappBackgroundTransfers?.startUploadFile) {
    return null;
  }

  const result = await SynzappBackgroundTransfers.startUploadFile({
    fileUri: input.fileUri,
    headers: input.headers,
    method: input.method,
    url: input.url
  });

  return {
    transferId: result.transferId
  };
}

export async function downloadFileWithNativeBackgroundTransfer(input: {
  destinationUri: string;
  headers?: Record<string, string>;
  onNativeTransferStarted?: (transferId: string) => void;
  onProgress?: (progress: number) => void;
  url: string;
}): Promise<NativeBackgroundTransferResult | null> {
  if (!await isNativeBackgroundTransferAvailable() || !SynzappBackgroundTransfers?.startDownloadFile) {
    return null;
  }

  const result = await SynzappBackgroundTransfers.startDownloadFile({
    destinationUri: input.destinationUri,
    headers: input.headers,
    url: input.url
  });

  input.onNativeTransferStarted?.(result.transferId);

  const status = await waitForNativeTransfer({
    onProgress: input.onProgress,
    transferId: result.transferId
  });

  return {
    destinationUri: status.destinationUri || input.destinationUri,
    transferId: result.transferId
  };
}

export async function getNativeBackgroundTransferStatus(
  transferId: string
): Promise<SynzappBackgroundTransferStatusResult | null> {
  if (!SynzappBackgroundTransfers?.getTransferStatus) {
    return null;
  }

  return SynzappBackgroundTransfers.getTransferStatus(transferId).catch(() => null);
}

export async function cancelNativeBackgroundTransfer(transferId: string): Promise<boolean> {
  const safeTransferId = typeof transferId === 'string' ? transferId.trim() : '';

  if (!safeTransferId || !SynzappBackgroundTransfers?.cancelTransfer) {
    return false;
  }

  await SynzappBackgroundTransfers.cancelTransfer(safeTransferId).catch(() => undefined);
  return true;
}

export async function waitForNativeTransfer(input: {
  onProgress?: (progress: number) => void;
  transferId: string;
}): Promise<SynzappBackgroundTransferStatusResult> {
  let settled = false;
  let cleanupListener: (() => void) | undefined;

  try {
    return await new Promise<SynzappBackgroundTransferStatusResult>((resolve, reject) => {
      const finish = (status: SynzappBackgroundTransferStatusResult) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupListener?.();

        if (status.status === 'completed') {
          input.onProgress?.(1);
          resolve(status);
          return;
        }

        reject(new Error(status.errorMessage || 'Unable to complete background media transfer.'));
      };

      const handleStatus = (status: SynzappBackgroundTransferStatusResult | SynzappBackgroundTransferEvent | null) => {
        if (!status || status.transferId !== input.transferId || settled) {
          return;
        }

        input.onProgress?.(normalizeProgress(status.progress));

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'not_found') {
          finish(status as SynzappBackgroundTransferStatusResult);
        }
      };

      const subscription = SynzappBackgroundTransfers?.addListener?.(
        'onSynzappBackgroundTransferEvent',
        handleStatus
      );
      cleanupListener = () => subscription?.remove();

      const poll = async () => {
        if (settled) {
          return;
        }

        handleStatus(await getNativeBackgroundTransferStatus(input.transferId));

        if (!settled) {
          setTimeout(() => {
            void poll();
          }, BACKGROUND_TRANSFER_POLL_INTERVAL_MS);
        }
      };

      void poll();
    });
  } finally {
    settled = true;
    cleanupListener?.();
  }
}

function normalizeProgress(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0;
}
