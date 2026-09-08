import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import nacl from 'tweetnacl';
import {
  createArchivedMediaDecryptStream,
  decryptArchivedMedia
} from '../src/services/archivedMediaDecryptor.ts';

/**
 * These tests encrypt exactly as the phones do, then decrypt with the server.
 *
 * That direction is deliberate. A test that used the server for both halves
 * would pass whatever the server did, including a scheme no phone has ever
 * produced — and the failure would surface as a corrupt file in a lawyer's
 * export rather than a red test here.
 */

const KEY = randomBytes(32);

/** As the phones do it: ChaCha20-Poly1305 per chunk, tag appended. */
function sealNativeChunk(plain: Buffer, nonce: Buffer): Buffer {
  const cipher = createCipheriv('chacha20-poly1305', KEY, nonce, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);

  return Buffer.concat([ciphertext, cipher.getAuthTag()]);
}

function sealSecretBoxChunk(plain: Buffer, nonce: Buffer): Buffer {
  return Buffer.from(nacl.secretbox(new Uint8Array(plain), new Uint8Array(nonce), new Uint8Array(KEY)));
}

describe('decryptArchivedMedia - native ChaCha20-Poly1305', () => {
  it('rebuilds a file split across several chunks', () => {
    const chunkSizeBytes = 1024;
    const original = randomBytes(chunkSizeBytes * 2 + 300);
    const nonces = [randomBytes(12), randomBytes(12), randomBytes(12)];
    const sealed = Buffer.concat([
      sealNativeChunk(original.subarray(0, chunkSizeBytes), nonces[0]),
      sealNativeChunk(original.subarray(chunkSizeBytes, chunkSizeBytes * 2), nonces[1]),
      sealNativeChunk(original.subarray(chunkSizeBytes * 2), nonces[2])
    ]);

    const decrypted = decryptArchivedMedia({
      encrypted: sealed,
      media: {
        chunkSizeBytes,
        encryptionMode: 'native-chacha20poly1305-chunked-v1',
        key: KEY.toString('base64'),
        partCount: 3,
        partNonces: nonces.map((nonce) => nonce.toString('base64')),
        sizeBytes: original.length
      }
    });

    assert.ok(decrypted);
    assert.equal(Buffer.compare(decrypted, original), 0);
  });

  it('handles a file that fits in one chunk exactly', () => {
    const original = randomBytes(512);
    const nonce = randomBytes(12);

    const decrypted = decryptArchivedMedia({
      encrypted: sealNativeChunk(original, nonce),
      media: {
        chunkSizeBytes: 512,
        encryptionMode: 'native-chacha20poly1305-chunked-v1',
        key: KEY.toString('base64'),
        partCount: 1,
        partNonces: [nonce.toString('base64')],
        sizeBytes: original.length
      }
    });

    assert.ok(decrypted);
    assert.equal(Buffer.compare(decrypted, original), 0);
  });

  it('returns null rather than a corrupt file when the bytes were tampered with', () => {
    const original = randomBytes(256);
    const nonce = randomBytes(12);
    const sealed = sealNativeChunk(original, nonce);

    sealed[10] ^= 0xff;

    assert.equal(decryptArchivedMedia({
      encrypted: sealed,
      media: {
        chunkSizeBytes: 256,
        encryptionMode: 'native-chacha20poly1305-chunked-v1',
        key: KEY.toString('base64'),
        partCount: 1,
        partNonces: [nonce.toString('base64')],
        sizeBytes: original.length
      }
    }), null);
  });

  it('returns null when the download was cut short', () => {
    const original = randomBytes(2048);
    const nonce = randomBytes(12);
    const sealed = sealNativeChunk(original, nonce).subarray(0, 900);

    assert.equal(decryptArchivedMedia({
      encrypted: sealed,
      media: {
        chunkSizeBytes: 2048,
        encryptionMode: 'native-chacha20poly1305-chunked-v1',
        key: KEY.toString('base64'),
        partCount: 1,
        partNonces: [nonce.toString('base64')],
        sizeBytes: original.length
      }
    }), null);
  });
});

describe('decryptArchivedMedia - older messages', () => {
  it('rebuilds a chunked secretbox file', () => {
    const chunkSizeBytes = 600;
    const original = randomBytes(chunkSizeBytes + 120);
    const nonces = [randomBytes(24), randomBytes(24)];
    const sealed = Buffer.concat([
      sealSecretBoxChunk(original.subarray(0, chunkSizeBytes), nonces[0]),
      sealSecretBoxChunk(original.subarray(chunkSizeBytes), nonces[1])
    ]);

    const decrypted = decryptArchivedMedia({
      encrypted: sealed,
      media: {
        chunkSizeBytes,
        encryptionMode: 'chunked-secretbox-v1',
        key: KEY.toString('base64'),
        partCount: 2,
        partNonces: nonces.map((nonce) => nonce.toString('base64')),
        sizeBytes: original.length
      }
    });

    assert.ok(decrypted);
    assert.equal(Buffer.compare(decrypted, original), 0);
  });

  it('rebuilds a single-part file', () => {
    const original = randomBytes(400);
    const nonce = randomBytes(24);

    const decrypted = decryptArchivedMedia({
      encrypted: sealSecretBoxChunk(original, nonce),
      media: {
        key: KEY.toString('base64'),
        nonce: nonce.toString('base64'),
        sizeBytes: original.length
      }
    });

    assert.ok(decrypted);
    assert.equal(Buffer.compare(decrypted, original), 0);
  });
});

describe('decryptArchivedMedia - refuses to guess', () => {
  it('returns null with no key', () => {
    assert.equal(decryptArchivedMedia({
      encrypted: randomBytes(64),
      media: { nonce: randomBytes(24).toString('base64') }
    }), null);
  });

  it('returns null when the chunk details do not add up', () => {
    // partNonces shorter than partCount means the sender's description of the
    // file is inconsistent. Decrypting the chunks that do have nonces would
    // produce a truncated file that looks whole.
    assert.equal(decryptArchivedMedia({
      encrypted: randomBytes(64),
      media: {
        chunkSizeBytes: 32,
        encryptionMode: 'native-chacha20poly1305-chunked-v1',
        key: KEY.toString('base64'),
        partCount: 3,
        partNonces: [randomBytes(12).toString('base64')],
        sizeBytes: 96
      }
    }), null);
  });
});

describe('streaming decryption, so file size stops deciding what can be produced', () => {
  async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const parts: Buffer[] = [];

    for await (const piece of stream) {
      parts.push(Buffer.from(piece as Buffer));
    }

    return Buffer.concat(parts);
  }

  it('rebuilds a chunked file arriving in pieces that ignore chunk boundaries', async () => {
    // Storage hands over whatever sized pieces it likes, never aligned to the
    // encryption chunks, so the stream has to hold partial chunks back.
    const chunkSizeBytes = 1024;
    const original = randomBytes(chunkSizeBytes * 3 + 77);
    const nonces = [randomBytes(12), randomBytes(12), randomBytes(12), randomBytes(12)];
    const sealed = Buffer.concat([
      sealNativeChunk(original.subarray(0, chunkSizeBytes), nonces[0]),
      sealNativeChunk(original.subarray(chunkSizeBytes, chunkSizeBytes * 2), nonces[1]),
      sealNativeChunk(original.subarray(chunkSizeBytes * 2, chunkSizeBytes * 3), nonces[2]),
      sealNativeChunk(original.subarray(chunkSizeBytes * 3), nonces[3])
    ]);

    const stream = createArchivedMediaDecryptStream({
      chunkSizeBytes,
      encryptionMode: 'native-chacha20poly1305-chunked-v1',
      key: KEY.toString('base64'),
      partCount: 4,
      partNonces: nonces.map((nonce) => nonce.toString('base64')),
      sizeBytes: original.length
    });

    assert.ok(stream);

    for (let offset = 0; offset < sealed.length; offset += 333) {
      stream.write(sealed.subarray(offset, Math.min(offset + 333, sealed.length)));
    }

    stream.end();

    assert.equal(Buffer.compare(await collect(stream), original), 0);
  });

  it('streams an older chunked secretbox file too', async () => {
    const chunkSizeBytes = 500;
    const original = randomBytes(chunkSizeBytes + 60);
    const nonces = [randomBytes(24), randomBytes(24)];
    const sealed = Buffer.concat([
      sealSecretBoxChunk(original.subarray(0, chunkSizeBytes), nonces[0]),
      sealSecretBoxChunk(original.subarray(chunkSizeBytes), nonces[1])
    ]);

    const stream = createArchivedMediaDecryptStream({
      chunkSizeBytes,
      encryptionMode: 'chunked-secretbox-v1',
      key: KEY.toString('base64'),
      partCount: 2,
      partNonces: nonces.map((nonce) => nonce.toString('base64')),
      sizeBytes: original.length
    });

    assert.ok(stream);
    stream.end(sealed);

    assert.equal(Buffer.compare(await collect(stream), original), 0);
  });

  it('fails rather than emitting a truncated file', async () => {
    const chunkSizeBytes = 512;
    const original = randomBytes(chunkSizeBytes * 2);
    const nonces = [randomBytes(12), randomBytes(12)];
    const sealed = sealNativeChunk(original.subarray(0, chunkSizeBytes), nonces[0]);

    const stream = createArchivedMediaDecryptStream({
      chunkSizeBytes,
      encryptionMode: 'native-chacha20poly1305-chunked-v1',
      key: KEY.toString('base64'),
      partCount: 2,
      partNonces: nonces.map((nonce) => nonce.toString('base64')),
      sizeBytes: original.length
    });

    assert.ok(stream);
    stream.end(sealed);

    await assert.rejects(collect(stream), /incomplete/i);
  });

  it('refuses to stream a single-part file, which cannot be opened in pieces', () => {
    assert.equal(createArchivedMediaDecryptStream({
      key: KEY.toString('base64'),
      nonce: randomBytes(24).toString('base64'),
      sizeBytes: 100
    }), null);
  });
});
