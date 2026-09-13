import { fromByteArray } from 'base64-js';
import nacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';

import { openSealedMessageKey, sealMessageKeyForDevice } from './messageKeySealing';

/**
 * A real round trip, with real keys. The test that did not exist, and whose
 * absence let a broken grant ship: the one that was there only checked that the
 * JSON had the right shape.
 */

function keyPair() {
  return nacl.box.keyPair();
}

const MESSAGE_KEY = new Uint8Array(nacl.secretbox.keyLength).fill(7);
const NONCE = new Uint8Array(nacl.box.nonceLength).fill(3);

describe('sealing a message key for one device', () => {
  it('opens what the sender sealed, with no sealer on the payload', () => {
    // The send path: the sealer is the sender, whose key is already on the
    // envelope, so nothing extra travels.
    const sender = keyPair();
    const recipient = keyPair();

    const sealed = sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(recipient.publicKey),
      sealerKeyAgreementPrivateKey: sender.secretKey
    });

    expect(JSON.parse(sealed).sealedByKeyAgreementPublicKey).toBeUndefined();
    expect(openSealedMessageKey({
      encryptedKeyForDevice: sealed,
      fallbackSealerKeyAgreementPublicKey: fromByteArray(sender.publicKey),
      localDeviceKeyAgreementPrivateKey: recipient.secretKey
    })).toEqual(MESSAGE_KEY);
  });

  it('opens a history grant, where the granter is not the sender', () => {
    // The case that never worked. The granter seals with their own private key,
    // so opening against the sender's public key cannot succeed.
    const sender = keyPair();
    const granter = keyPair();
    const joiner = keyPair();

    const grant = sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      sealerKeyAgreementPrivateKey: granter.secretKey,
      sealerKeyAgreementPublicKey: granter.publicKey
    });

    expect(openSealedMessageKey({
      encryptedKeyForDevice: grant,
      // Deliberately the sender, which is what the old code always passed.
      fallbackSealerKeyAgreementPublicKey: fromByteArray(sender.publicKey),
      localDeviceKeyAgreementPrivateKey: joiner.secretKey
    })).toEqual(MESSAGE_KEY);
  });

  it('proves the old behaviour really was broken', () => {
    // Without the sealer on the payload there is nothing to fall back to but the
    // sender, and that box cannot be opened. This is the shipped bug, pinned.
    const sender = keyPair();
    const granter = keyPair();
    const joiner = keyPair();

    const grantWithoutSealer = sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      sealerKeyAgreementPrivateKey: granter.secretKey
    });

    expect(openSealedMessageKey({
      encryptedKeyForDevice: grantWithoutSealer,
      fallbackSealerKeyAgreementPublicKey: fromByteArray(sender.publicKey),
      localDeviceKeyAgreementPrivateKey: joiner.secretKey
    })).toBeNull();
  });

  it('refuses a device the key was not sealed for', () => {
    const granter = keyPair();
    const joiner = keyPair();
    const outsider = keyPair();

    const grant = sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      sealerKeyAgreementPrivateKey: granter.secretKey,
      sealerKeyAgreementPublicKey: granter.publicKey
    });

    expect(openSealedMessageKey({
      encryptedKeyForDevice: grant,
      fallbackSealerKeyAgreementPublicKey: fromByteArray(granter.publicKey),
      localDeviceKeyAgreementPrivateKey: outsider.secretKey
    })).toBeNull();
  });

  it('refuses a payload whose ciphertext was tampered with', () => {
    const granter = keyPair();
    const joiner = keyPair();

    const grant = JSON.parse(sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      sealerKeyAgreementPrivateKey: granter.secretKey,
      sealerKeyAgreementPublicKey: granter.publicKey
    }));
    const tamperedCiphertext = `A${grant.ciphertext.slice(1)}`;

    expect(openSealedMessageKey({
      encryptedKeyForDevice: JSON.stringify({ ...grant, ciphertext: tamperedCiphertext }),
      fallbackSealerKeyAgreementPublicKey: fromByteArray(granter.publicKey),
      localDeviceKeyAgreementPrivateKey: joiner.secretKey
    })).toBeNull();
  });

  it('refuses a payload claiming somebody else sealed it', () => {
    // The sealer key is not trusted input: it is one half of an authenticated
    // box, so naming the wrong sealer simply fails to open.
    const granter = keyPair();
    const impostor = keyPair();
    const joiner = keyPair();

    const grant = JSON.parse(sealMessageKeyForDevice({
      messageKey: MESSAGE_KEY,
      nonce: NONCE,
      recipientKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      sealerKeyAgreementPrivateKey: granter.secretKey,
      sealerKeyAgreementPublicKey: granter.publicKey
    }));

    expect(openSealedMessageKey({
      encryptedKeyForDevice: JSON.stringify({
        ...grant,
        sealedByKeyAgreementPublicKey: fromByteArray(impostor.publicKey)
      }),
      fallbackSealerKeyAgreementPublicKey: fromByteArray(granter.publicKey),
      localDeviceKeyAgreementPrivateKey: joiner.secretKey
    })).toBeNull();
  });

  it('returns null rather than throwing on rubbish', () => {
    const joiner = keyPair();

    expect(openSealedMessageKey({
      encryptedKeyForDevice: 'not json',
      fallbackSealerKeyAgreementPublicKey: fromByteArray(joiner.publicKey),
      localDeviceKeyAgreementPrivateKey: joiner.secretKey
    })).toBeNull();
  });
});
