import { fromByteArray, toByteArray } from 'base64-js';
import nacl from 'tweetnacl';

/**
 * Sealing a message key for one device, and opening it again.
 *
 * `nacl.box` is authenticated both ways: a box sealed with the recipient's
 * public key and the sealer's private key can only be opened with the *sealer's*
 * public key and the recipient's private key.
 *
 * That was got wrong for history grants. When somebody grants a newly joined
 * device access to older messages, they seal with **their own** private key — but
 * the opening side used the original **sender's** public key. Those agree only
 * when the granter happens to be the sender, which is never true of a backfill,
 * so group history never arrived. A failed grant also occupies the slot it was
 * written into, so the device never got a second chance at that message.
 *
 * The sealer's public key now travels with the payload, and is preferred when
 * opening. Payloads written before this carry none; those come from the send
 * path, where the sealer *is* the sender, so falling back to the sender's key is
 * right for them and keeps every existing message readable.
 *
 * Kept free of native imports so the round trip can be tested — tweetnacl is
 * plain JavaScript.
 */
export interface EncryptedKeyPayload {
  ciphertext: string;
  nonce: string;
  /** The public key of whoever sealed this. Absent on payloads from the send path. */
  sealedByKeyAgreementPublicKey?: string;
  version: 1;
}

export function sealMessageKeyForDevice(input: {
  messageKey: Uint8Array;
  nonce: Uint8Array;
  recipientKeyAgreementPublicKey: string;
  sealerKeyAgreementPrivateKey: Uint8Array;
  /** Omitted by the send path, where the sender's key is already on the envelope. */
  sealerKeyAgreementPublicKey?: Uint8Array;
}): string {
  const ciphertext = nacl.box(
    input.messageKey,
    input.nonce,
    toByteArray(input.recipientKeyAgreementPublicKey),
    input.sealerKeyAgreementPrivateKey
  );
  const payload: EncryptedKeyPayload = {
    ciphertext: fromByteArray(ciphertext),
    nonce: fromByteArray(input.nonce),
    ...(input.sealerKeyAgreementPublicKey
      ? { sealedByKeyAgreementPublicKey: fromByteArray(input.sealerKeyAgreementPublicKey) }
      : {}),
    version: 1
  };

  return JSON.stringify(payload);
}

export function openSealedMessageKey(input: {
  encryptedKeyForDevice: string;
  /** Used only when the payload does not say who sealed it. */
  fallbackSealerKeyAgreementPublicKey: string;
  localDeviceKeyAgreementPrivateKey: Uint8Array;
}): Uint8Array | null {
  try {
    const payload = JSON.parse(input.encryptedKeyForDevice) as Partial<EncryptedKeyPayload>;

    if (payload.version !== 1 || !payload.ciphertext || !payload.nonce) {
      return null;
    }

    const sealerPublicKey = payload.sealedByKeyAgreementPublicKey ||
      input.fallbackSealerKeyAgreementPublicKey;

    if (!sealerPublicKey) {
      return null;
    }

    return nacl.box.open(
      toByteArray(payload.ciphertext),
      toByteArray(payload.nonce),
      toByteArray(sealerPublicKey),
      input.localDeviceKeyAgreementPrivateKey
    );
  } catch {
    return null;
  }
}
