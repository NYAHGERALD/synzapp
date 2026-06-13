import { fromByteArray, toByteArray } from 'base64-js';
import { gcm } from '@noble/ciphers/aes.js';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import type {
  ChatImageAttachment,
  ChatMediaAttachment,
  ChatDeliveryStatus,
  ChatMessage,
  ChatReplyReference,
  EncryptionDevicePublicKey,
  EncryptedChatEnvelope
} from './chatApi';
import { getLocalDeviceKeyMaterial } from './deviceIdentity';

interface EncryptedKeyPayload {
  ciphertext: string;
  nonce: string;
  version: 1;
}

interface EncryptedTextPayload {
  forwarded?: boolean;
  replyTo?: ChatReplyReference | null;
  text: string;
  type: 'text';
  version: 1;
}

interface EncryptedImagePayload {
  forwarded?: boolean;
  image: ChatImageAttachment;
  replyTo?: ChatReplyReference | null;
  text: string;
  type: 'image';
  version: 1;
}

interface EncryptedMediaPayload {
  forwarded?: boolean;
  media: ChatMediaAttachment;
  replyTo?: ChatReplyReference | null;
  text: string;
  type: 'media';
  version: 1;
}

interface EncryptedMediaGroupPayload {
  forwarded?: boolean;
  mediaItems: ChatMediaAttachment[];
  replyTo?: ChatReplyReference | null;
  text: string;
  type: 'mediaGroup';
  version: 1;
}

type EncryptedChatPayload =
  | EncryptedTextPayload
  | EncryptedImagePayload
  | EncryptedMediaPayload
  | EncryptedMediaGroupPayload;

export interface EncryptedNotificationPreview {
  algorithm: 'x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1';
  ciphertext: string;
  nonce: string;
  version: 1;
}

export interface EncryptedMessageBody {
  algorithm: 'nacl-secretbox+x25519-xsalsa20-poly1305';
  ciphertext: string;
  clientMessageId: string;
  encryptedKeysByDevice: Record<string, string>;
  keyVersion: number;
  nonce: string;
  notificationPreviewByDevice?: Record<string, EncryptedNotificationPreview>;
  recipientDeviceIds: string[];
  senderDeviceId: string;
}

const NOTIFICATION_PREVIEW_ALGORITHM = 'x25519-sha256-aes-256-gcm+synzapp-notification-preview-v1';
const NOTIFICATION_PREVIEW_DERIVATION_LABEL = 'Synzapp notification preview v1';
const NOTIFICATION_PREVIEW_MAX_CHARS = 180;

export async function encryptChatText(input: {
  forwarded?: boolean;
  idToken: string;
  recipientDevices: EncryptionDevicePublicKey[];
  replyTo?: ChatReplyReference | null;
  senderDevice: EncryptionDevicePublicKey;
  text: string;
}): Promise<EncryptedMessageBody> {
  return encryptChatMessage(input);
}

export async function encryptChatMessage(input: {
  forwarded?: boolean;
  idToken: string;
  image?: ChatImageAttachment | null;
  media?: ChatMediaAttachment | null;
  mediaItems?: ChatMediaAttachment[] | null;
  recipientDevices: EncryptionDevicePublicKey[];
  replyTo?: ChatReplyReference | null;
  senderDevice: EncryptionDevicePublicKey;
  text?: string;
}): Promise<EncryptedMessageBody> {
  const localDevice = await getLocalDeviceKeyMaterial(input.idToken);
  const messageKey = Crypto.getRandomBytes(nacl.secretbox.keyLength);
  const messageNonce = Crypto.getRandomBytes(nacl.secretbox.nonceLength);
  const text = (input.text || '').trim();
  const mediaItems = normalizeMediaAttachments(input.mediaItems);
  const media = normalizeMediaAttachment(input.media || input.image) ||
    (mediaItems.length === 1 ? mediaItems[0] : null);
  const image = !media ? normalizeImageAttachment(input.image) : null;
  const plaintext: EncryptedChatPayload = mediaItems.length > 1
    ? {
        forwarded: Boolean(input.forwarded),
        mediaItems,
        replyTo: normalizeReplyReference(input.replyTo),
        text,
        type: 'mediaGroup',
        version: 1
      }
    : media
    ? {
        forwarded: Boolean(input.forwarded),
        media,
        replyTo: normalizeReplyReference(input.replyTo),
        text,
        type: 'media',
        version: 1
      }
    : image
    ? {
        forwarded: Boolean(input.forwarded),
        image,
        replyTo: normalizeReplyReference(input.replyTo),
        text,
        type: 'image',
        version: 1
      }
    : {
        forwarded: Boolean(input.forwarded),
        replyTo: normalizeReplyReference(input.replyTo),
        text,
        type: 'text',
        version: 1
      };

  if (!plaintext.text && plaintext.type === 'text') {
    throw new Error('Enter a message.');
  }

  const ciphertext = nacl.secretbox(utf8ToBytes(JSON.stringify(plaintext)), messageNonce, messageKey);
  const devicesById = new Map<string, EncryptionDevicePublicKey>();

  input.recipientDevices.forEach((device) => {
    devicesById.set(device.deviceId, device);
  });
  devicesById.set(input.senderDevice.deviceId, input.senderDevice);

  const encryptedKeysByDevice: Record<string, string> = {};

  devicesById.forEach((device) => {
    const keyNonce = Crypto.getRandomBytes(nacl.box.nonceLength);
    const encryptedKey = nacl.box(
      messageKey,
      keyNonce,
      toByteArray(device.keyAgreementPublicKey),
      localDevice.keyAgreementPrivateKey
    );
    const payload: EncryptedKeyPayload = {
      ciphertext: fromByteArray(encryptedKey),
      nonce: fromByteArray(keyNonce),
      version: 1
    };

    encryptedKeysByDevice[device.deviceId] = JSON.stringify(payload);
  });

  const notificationPreviewByDevice = await encryptNotificationPreviewsForDevices({
    localDevicePrivateKey: localDevice.keyAgreementPrivateKey,
    plaintext,
    recipientDevices: input.recipientDevices,
    senderKeyAgreementPublicKey: input.senderDevice.keyAgreementPublicKey
  });

  return {
    algorithm: 'nacl-secretbox+x25519-xsalsa20-poly1305',
    ciphertext: fromByteArray(ciphertext),
    clientMessageId: `client_${Date.now()}_${randomHex(6)}`,
    encryptedKeysByDevice,
    keyVersion: Math.max(input.senderDevice.keyVersion || 1, 1),
    nonce: fromByteArray(messageNonce),
    notificationPreviewByDevice,
    recipientDeviceIds: input.recipientDevices.map((device) => device.deviceId),
    senderDeviceId: localDevice.deviceId
  };
}

export async function decryptChatEnvelopes(input: {
  currentUid: string;
  envelopes: EncryptedChatEnvelope[];
  idToken: string;
}): Promise<ChatMessage[]> {
  const localDevice = await getLocalDeviceKeyMaterial(input.idToken);
  const decryptedMessages = await Promise.all(input.envelopes.map(async (envelope) => {
    const decryptedPayload = await decryptChatEnvelope({
      envelope,
      localDevicePrivateKey: localDevice.keyAgreementPrivateKey
    });

    if (!decryptedPayload) {
      return null;
    }

    const message: ChatMessage = {
      deliveryStatus: envelope.deliveryStatus as ChatDeliveryStatus | null,
      forwarded: Boolean(decryptedPayload.forwarded),
      image: decryptedPayload.type === 'image' ? decryptedPayload.image : null,
      isMine: envelope.senderUid === input.currentUid,
      media: decryptedPayload.type === 'mediaGroup'
        ? decryptedPayload.mediaItems[0] || null
        : decryptedPayload.type === 'media'
          ? decryptedPayload.media
          : decryptedPayload.type === 'image'
            ? decryptedPayload.image
            : null,
      mediaItems: decryptedPayload.type === 'mediaGroup' ? decryptedPayload.mediaItems : [],
      messageId: envelope.envelopeId,
      replyTo: decryptedPayload.replyTo || null,
      senderUid: envelope.senderUid,
      sentAt: envelope.sentAt,
      text: decryptedPayload.text
    };

    return message;
  }));

  return decryptedMessages.filter((message): message is ChatMessage => Boolean(message));
}

async function decryptChatEnvelope(input: {
  envelope: EncryptedChatEnvelope;
  localDevicePrivateKey: Uint8Array;
}): Promise<EncryptedChatPayload | null> {
  try {
    const keyPayload = JSON.parse(input.envelope.encryptedKeyForDevice) as Partial<EncryptedKeyPayload>;

    if (keyPayload.version !== 1 || !keyPayload.ciphertext || !keyPayload.nonce) {
      return null;
    }

    const messageKey = nacl.box.open(
      toByteArray(keyPayload.ciphertext),
      toByteArray(keyPayload.nonce),
      toByteArray(input.envelope.senderKeyAgreementPublicKey),
      input.localDevicePrivateKey
    );

    if (!messageKey) {
      return null;
    }

    const plaintext = nacl.secretbox.open(
      toByteArray(input.envelope.ciphertext),
      toByteArray(input.envelope.nonce),
      messageKey
    );

    return plaintext ? parseDecryptedTextPayload(bytesToUtf8(plaintext)) : null;
  } catch {
    return null;
  }
}

function parseDecryptedTextPayload(value: string): EncryptedChatPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<EncryptedChatPayload>;
    const text = typeof payload.text === 'string' ? payload.text : '';

    if (payload.version === 1 && payload.type === 'text' && text) {
      return {
        forwarded: Boolean(payload.forwarded),
        replyTo: normalizeReplyReference(payload.replyTo),
        text,
        type: 'text',
        version: 1
      };
    }

    if (payload.version === 1 && payload.type === 'image') {
      const image = normalizeImageAttachment(payload.image);

      if (image) {
        return {
          forwarded: Boolean(payload.forwarded),
          image,
          replyTo: normalizeReplyReference(payload.replyTo),
          text,
          type: 'image',
          version: 1
        };
      }
    }

    if (payload.version === 1 && payload.type === 'media') {
      const media = normalizeMediaAttachment(payload.media);

      if (media) {
        return {
          forwarded: Boolean(payload.forwarded),
          media,
          replyTo: normalizeReplyReference(payload.replyTo),
          text,
          type: 'media',
          version: 1
        };
      }
    }

    if (payload.version === 1 && payload.type === 'mediaGroup') {
      const mediaItems = normalizeMediaAttachments(payload.mediaItems);

      if (mediaItems.length > 1) {
        return {
          forwarded: Boolean(payload.forwarded),
          mediaItems,
          replyTo: normalizeReplyReference(payload.replyTo),
          text,
          type: 'mediaGroup',
          version: 1
        };
      }
    }
  } catch {
    // Legacy messages encrypted only the text string.
  }

  return value
    ? {
        replyTo: null,
        forwarded: false,
        text: value,
        type: 'text',
        version: 1
      }
    : null;
}

function normalizeImageAttachment(image?: Partial<ChatImageAttachment> | null): ChatImageAttachment | null {
  if (!image || typeof image !== 'object') {
    return null;
  }

  const dataUrl = typeof image.dataUrl === 'string' ? image.dataUrl.trim() : '';
  const width = Number.isFinite(image.width) ? Math.max(Math.round(image.width || 0), 1) : 1;
  const height = Number.isFinite(image.height) ? Math.max(Math.round(image.height || 0), 1) : 1;

  if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
    return null;
  }

  return {
    contentType: 'image/jpeg',
    dataUrl,
    fileName: typeof image.fileName === 'string' && image.fileName.trim()
      ? image.fileName.trim().slice(0, 180)
      : 'photo.jpg',
    height,
    kind: 'image',
    sizeBytes: Number.isFinite(image.sizeBytes) ? Math.max(Math.round(image.sizeBytes || 0), 0) : 0,
    width
  };
}

function normalizeMediaAttachment(media?: Partial<ChatMediaAttachment> | null): ChatMediaAttachment | null {
  if (!media || typeof media !== 'object') {
    return null;
  }

  const kind = media.kind === 'audio' || media.kind === 'image' || media.kind === 'video' || media.kind === 'file'
    ? media.kind
    : null;
  const mediaId = typeof media.mediaId === 'string' ? media.mediaId.trim() : '';
  const key = typeof media.key === 'string' ? media.key.trim() : '';
  const nonce = typeof media.nonce === 'string' ? media.nonce.trim() : '';
  const contentType = typeof media.contentType === 'string' ? media.contentType.trim().toLowerCase() : '';
  const fileName = typeof media.fileName === 'string' ? media.fileName.trim().slice(0, 180) : '';

  if (!kind || !mediaId || !key || !nonce || !contentType || !fileName) {
    return null;
  }

  return {
    contentType,
    durationMs: Number.isFinite(media.durationMs) ? Math.max(Math.round(media.durationMs || 0), 0) : undefined,
    encryptedSizeBytes: Number.isFinite(media.encryptedSizeBytes) ? Math.max(Math.round(media.encryptedSizeBytes || 0), 0) : undefined,
    fileName,
    height: Number.isFinite(media.height) ? Math.max(Math.round(media.height || 0), 1) : undefined,
    key,
    kind,
    mediaId,
    nonce,
    sizeBytes: Number.isFinite(media.sizeBytes) ? Math.max(Math.round(media.sizeBytes || 0), 0) : 0,
    width: Number.isFinite(media.width) ? Math.max(Math.round(media.width || 0), 1) : undefined
  };
}

function normalizeMediaAttachments(mediaItems?: Partial<ChatMediaAttachment>[] | null): ChatMediaAttachment[] {
  if (!Array.isArray(mediaItems)) {
    return [];
  }

  return mediaItems
    .map((media) => normalizeMediaAttachment(media))
    .filter((media): media is ChatMediaAttachment => Boolean(media))
    .slice(0, 10);
}

function normalizeReplyReference(replyTo?: ChatReplyReference | null): ChatReplyReference | null {
  if (
    !replyTo ||
    typeof replyTo.messageId !== 'string' ||
    typeof replyTo.senderUid !== 'string' ||
    typeof replyTo.sentAt !== 'string' ||
    typeof replyTo.text !== 'string'
  ) {
    return null;
  }

  const text = replyTo.text.trim();

  if (!replyTo.messageId.trim() || !replyTo.senderUid.trim() || !replyTo.sentAt.trim() || !text) {
    return null;
  }

  return {
    messageId: replyTo.messageId.trim(),
    senderUid: replyTo.senderUid.trim(),
    sentAt: replyTo.sentAt,
    text: text.slice(0, 500)
  };
}

async function encryptNotificationPreviewsForDevices(input: {
  localDevicePrivateKey: Uint8Array;
  plaintext: EncryptedChatPayload;
  recipientDevices: EncryptionDevicePublicKey[];
  senderKeyAgreementPublicKey: string;
}): Promise<Record<string, EncryptedNotificationPreview>> {
  const previewText = buildNotificationPreviewText(input.plaintext);

  if (!previewText) {
    return {};
  }

  const senderPublicKey = toByteArray(input.senderKeyAgreementPublicKey);
  const previewsByDevice: Record<string, EncryptedNotificationPreview> = {};
  const uniqueRecipientDevices = new Map<string, EncryptionDevicePublicKey>();

  input.recipientDevices.forEach((device) => {
    uniqueRecipientDevices.set(device.deviceId, device);
  });

  await Promise.all(Array.from(uniqueRecipientDevices.values()).map(async (device) => {
    const recipientPublicKey = toByteArray(device.keyAgreementPublicKey);
    const sharedSecret = nacl.scalarMult(input.localDevicePrivateKey, recipientPublicKey);
    const keyMaterial = concatBytes(
      utf8ToBytes(NOTIFICATION_PREVIEW_DERIVATION_LABEL),
      sharedSecret,
      senderPublicKey,
      recipientPublicKey
    );
    const encryptionKey = new Uint8Array(await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      toDigestBytes(keyMaterial)
    ));
    const nonce = Crypto.getRandomBytes(gcm.nonceLength);
    const previewPayload = utf8ToBytes(JSON.stringify({
      text: previewText,
      type: 'chat.notificationPreview',
      version: 1
    }));
    const ciphertext = gcm(encryptionKey, nonce).encrypt(previewPayload);

    previewsByDevice[device.deviceId] = {
      algorithm: NOTIFICATION_PREVIEW_ALGORITHM,
      ciphertext: fromByteArray(ciphertext),
      nonce: fromByteArray(nonce),
      version: 1
    };
  }));

  return previewsByDevice;
}

function buildNotificationPreviewText(payload: EncryptedChatPayload): string {
  const text = collapseWhitespace(payload.text).slice(0, NOTIFICATION_PREVIEW_MAX_CHARS);

  if (text) {
    return text;
  }

  if (payload.type === 'mediaGroup') {
    const count = payload.mediaItems.length;

    return count > 1 ? `${count} attachments` : 'Attachment';
  }

  if (payload.type === 'image') {
    return 'Photo';
  }

  if (payload.type === 'media') {
    return getMediaPreviewLabel(payload.media);
  }

  return '';
}

function getMediaPreviewLabel(media: ChatMediaAttachment): string {
  if (media.kind === 'audio') {
    return 'Voice message';
  }

  if (media.kind === 'image') {
    return 'Photo';
  }

  if (media.kind === 'video') {
    return 'Video';
  }

  return 'File';
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

function toDigestBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength);

  copy.set(bytes);

  return copy;
}

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
