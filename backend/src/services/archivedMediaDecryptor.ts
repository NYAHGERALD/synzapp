import { createDecipheriv } from 'node:crypto';
import { Transform } from 'node:stream';
import nacl from 'tweetnacl';

/**
 * Turns an encrypted attachment back into the original file, on the server.
 *
 * Exports have to contain **the actual bytes, not links to them**. A link
 * expires, and an export taken today has to still be complete years from now
 * when somebody opens it in a dispute. So the export copies the file in, which
 * means the server has to be able to unscramble it.
 *
 * The keys come from the archived message itself — the same copy the sending
 * app encrypted to the organization's archive. There is no separate key store
 * for attachments, and the server can read an attachment only when it can
 * already read the message that carried it.
 *
 * **This mirrors the phones exactly.** Three encryption modes exist in the wild
 * and older messages still use the older two, so all three are handled. A mode
 * this file does not recognise returns null rather than guessing, because a
 * wrong guess produces a corrupt file that looks like a real one.
 * Scope note: chat compliance only. This does not touch the interpreter or any
 * other part of Synzapp.
 */

export interface ArchivedMediaDescriptor {
  chunkSizeBytes?: number;
  encryptionMode?: string;
  key?: string;
  nonce?: string;
  partCount?: number;
  partNonces?: string[];
  sizeBytes?: number;
}

const AEAD_TAG_LENGTH = 16;

/** Null means "could not decrypt", and the caller records that in the manifest. */
export function decryptArchivedMedia(input: {
  encrypted: Buffer;
  media: ArchivedMediaDescriptor;
}): Buffer | null {
  const key = decodeBase64(input.media.key);

  if (!key) {
    return null;
  }

  try {
    if (input.media.encryptionMode === 'native-chacha20poly1305-chunked-v1') {
      return decryptNativeAeadChunks(input.encrypted, input.media, key);
    }

    if (input.media.encryptionMode === 'chunked-secretbox-v1') {
      return decryptSecretBoxChunks(input.encrypted, input.media, key);
    }

    return decryptSinglePart(input.encrypted, input.media, key);
  } catch {
    // Any failure is reported as an exclusion with a reason rather than
    // aborting the export. One unreadable attachment must not cost a lawyer the
    // other ten thousand messages.
    return null;
  }
}

function decryptNativeAeadChunks(
  encrypted: Buffer,
  media: ArchivedMediaDescriptor,
  key: Buffer
): Buffer | null {
  const partCount = media.partCount || 0;
  const chunkSizeBytes = media.chunkSizeBytes || 0;
  const partNonces = media.partNonces || [];

  if (!partCount || !chunkSizeBytes || partNonces.length !== partCount) {
    return null;
  }

  const parts: Buffer[] = [];
  let offset = 0;
  let remainingPlainBytes = media.sizeBytes || 0;

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const plainLength = Math.min(chunkSizeBytes, Math.max(remainingPlainBytes, 0));
    const sealedLength = plainLength + AEAD_TAG_LENGTH;

    if (offset + sealedLength > encrypted.length) {
      return null;
    }

    const nonce = decodeBase64(partNonces[partIndex]);

    if (!nonce) {
      return null;
    }

    const sealed = encrypted.subarray(offset, offset + sealedLength);
    // The phones append the authentication tag to the ciphertext; Node wants it
    // handed over separately.
    const ciphertext = sealed.subarray(0, sealed.length - AEAD_TAG_LENGTH);
    const authTag = sealed.subarray(sealed.length - AEAD_TAG_LENGTH);
    const decipher = createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: AEAD_TAG_LENGTH });

    decipher.setAuthTag(authTag);
    parts.push(Buffer.concat([decipher.update(ciphertext), decipher.final()]));

    offset += sealedLength;
    remainingPlainBytes -= plainLength;
  }

  return Buffer.concat(parts);
}

function decryptSecretBoxChunks(
  encrypted: Buffer,
  media: ArchivedMediaDescriptor,
  key: Buffer
): Buffer | null {
  const partCount = media.partCount || 0;
  const chunkSizeBytes = media.chunkSizeBytes || 0;
  const partNonces = media.partNonces || [];

  if (!partCount || !chunkSizeBytes || partNonces.length !== partCount) {
    return null;
  }

  const parts: Buffer[] = [];
  let offset = 0;

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const plainLength = Math.min(
      chunkSizeBytes,
      Math.max((media.sizeBytes || 0) - partIndex * chunkSizeBytes, 0)
    );
    const sealedLength = plainLength + nacl.secretbox.overheadLength;

    if (offset + sealedLength > encrypted.length) {
      return null;
    }

    const nonce = decodeBase64(partNonces[partIndex]);

    if (!nonce) {
      return null;
    }

    const opened = nacl.secretbox.open(
      new Uint8Array(encrypted.subarray(offset, offset + sealedLength)),
      new Uint8Array(nonce),
      new Uint8Array(key)
    );

    if (!opened) {
      return null;
    }

    parts.push(Buffer.from(opened));
    offset += sealedLength;
  }

  return Buffer.concat(parts);
}

function decryptSinglePart(
  encrypted: Buffer,
  media: ArchivedMediaDescriptor,
  key: Buffer
): Buffer | null {
  const nonce = decodeBase64(media.nonce);

  if (!nonce) {
    return null;
  }

  const opened = nacl.secretbox.open(
    new Uint8Array(encrypted),
    new Uint8Array(nonce),
    new Uint8Array(key)
  );

  return opened ? Buffer.from(opened) : null;
}

function decodeBase64(value?: string | null): Buffer | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const decoded = Buffer.from(value, 'base64');

  return decoded.length ? decoded : null;
}

/**
 * Decrypts an attachment as it arrives, a chunk at a time.
 *
 * The whole-file version has to hold the encrypted copy and the decrypted copy
 * in memory at once, which put a hard ceiling on attachment size — a real video
 * was simply reported as "too large to export", which is not an answer a lawyer
 * can accept. Streaming holds one chunk instead, so file size stops deciding
 * whether evidence can be produced.
 *
 * Only the chunked formats can stream: each chunk is sealed independently, so a
 * chunk can be opened as soon as its bytes arrive. A single-part file is one
 * seal over everything and cannot be opened until it is complete, so null is
 * returned and the caller falls back to reading it whole.
 */
export function createArchivedMediaDecryptStream(
  media: ArchivedMediaDescriptor
): Transform | null {
  const key = decodeBase64(media.key);
  const partCount = media.partCount || 0;
  const chunkSizeBytes = media.chunkSizeBytes || 0;
  const partNonces = media.partNonces || [];
  const isNativeAead = media.encryptionMode === 'native-chacha20poly1305-chunked-v1';
  const isSecretBox = media.encryptionMode === 'chunked-secretbox-v1';

  if (!key || (!isNativeAead && !isSecretBox)) {
    return null;
  }

  if (!partCount || !chunkSizeBytes || partNonces.length !== partCount) {
    return null;
  }

  const overhead = isNativeAead ? AEAD_TAG_LENGTH : nacl.secretbox.overheadLength;
  let pending: Buffer = Buffer.alloc(0);
  let partIndex = 0;
  let remainingPlainBytes = media.sizeBytes || 0;

  return new Transform({
    flush(done) {
      // Bytes left over, or parts never reached, means the encrypted file did
      // not match what the message said it was. Failing here is right: the
      // alternative is a truncated file that looks complete.
      if (pending.length || partIndex !== partCount) {
        done(new Error('Encrypted attachment is incomplete.'));

        return;
      }

      done();
    },
    transform(piece: Buffer, _encoding, done) {
      pending = pending.length ? Buffer.concat([pending, piece]) : Buffer.from(piece);

      try {
        while (partIndex < partCount) {
          const plainLength = Math.min(chunkSizeBytes, Math.max(remainingPlainBytes, 0));
          const sealedLength = plainLength + overhead;

          if (pending.length < sealedLength) {
            break;
          }

          const sealed = pending.subarray(0, sealedLength);
          const nonce = decodeBase64(partNonces[partIndex]);

          if (!nonce) {
            throw new Error('Encrypted attachment is missing a chunk nonce.');
          }

          this.push(isNativeAead
            ? openNativeAeadChunk(sealed, key, nonce)
            : openSecretBoxChunk(sealed, key, nonce));

          pending = pending.subarray(sealedLength);
          remainingPlainBytes -= plainLength;
          partIndex += 1;
        }

        done();
      } catch (error) {
        done(error instanceof Error ? error : new Error('Attachment could not be decrypted.'));
      }
    }
  });
}

function openNativeAeadChunk(sealed: Buffer, key: Buffer, nonce: Buffer): Buffer {
  const ciphertext = sealed.subarray(0, sealed.length - AEAD_TAG_LENGTH);
  const authTag = sealed.subarray(sealed.length - AEAD_TAG_LENGTH);
  const decipher = createDecipheriv('chacha20-poly1305', key, nonce, {
    authTagLength: AEAD_TAG_LENGTH
  });

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function openSecretBoxChunk(sealed: Buffer, key: Buffer, nonce: Buffer): Buffer {
  const opened = nacl.secretbox.open(
    new Uint8Array(sealed),
    new Uint8Array(nonce),
    new Uint8Array(key)
  );

  if (!opened) {
    throw new Error('Attachment chunk could not be decrypted.');
  }

  return Buffer.from(opened);
}
