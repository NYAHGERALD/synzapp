import type { NextFunction, Request, Response } from 'express';
import {
  verifyActiveRegisteredDevice,
  type RegisteredDeviceIdentity
} from '../services/deviceIdentityService.js';
import { getDecodedTokenFromHeader } from './requestAuth.js';
import { readPresentedDeviceId } from './deviceBindingRules.js';

/**
 * Checks a device id wherever one is presented.
 *
 * The rules are in `deviceBindingRules.ts` with the reasoning; this is the thin
 * part that talks to Firebase. Two routers used to check a device and eleven did
 * not, so a phone an administrator had revoked went on working almost
 * everywhere. Now the claim is checked on all of them.
 *
 * Nothing is added for a browser: with no device header this returns
 * immediately, before any token work, so the web app pays nothing at all.
 */
/**
 * What this middleware already verified, kept for the route that would
 * otherwise verify it a second time.
 *
 * `verifyActiveRegisteredDevice` is not a read. It stamps `lastSeenAt` on two
 * documents every time it runs, so once this guard was mounted globally the
 * routes that also check a device were paying four writes where they used to pay
 * two — on the busiest authenticated path in the product. That was a regression
 * introduced with the global guard, not a pre-existing cost.
 *
 * A symbol property, so nothing can collide with it and it cannot be enumerated
 * into a log.
 */
const VERIFIED_DEVICE = Symbol('synzappVerifiedDevice');

type RequestWithDevice = Request & {
  [VERIFIED_DEVICE]?: { deviceId: string; identity: RegisteredDeviceIdentity };
};

/**
 * The identity this request already proved, when it is for the device being
 * asked about. Null otherwise, so the caller verifies for itself.
 */
export function getVerifiedDevice(
  req: Request,
  deviceId: string
): RegisteredDeviceIdentity | null {
  const verified = (req as RequestWithDevice)[VERIFIED_DEVICE];

  return verified && verified.deviceId === deviceId ? verified.identity : null;
}

export async function enforceDeviceBinding(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const presentedDeviceId = readPresentedDeviceId({
    authorizationHeader: req.header('Authorization'),
    deviceIdHeader: req.header('X-Synzapp-Device-Id'),
    method: req.method,
    path: req.path
  });

  if (presentedDeviceId === null) {
    next();
    return;
  }

  try {
    if (!presentedDeviceId) {
      throw authorizationError('This device is not authorized.');
    }

    const decodedToken = await getDecodedTokenFromHeader(req.header('Authorization') || '');
    const identity = await verifyActiveRegisteredDevice(decodedToken, presentedDeviceId);

    (req as RequestWithDevice)[VERIFIED_DEVICE] = {
      deviceId: presentedDeviceId,
      identity
    };
    next();
  } catch (error) {
    next(error);
  }
}

function authorizationError(message: string): Error {
  const error = new Error(message);

  error.name = 'AuthorizationError';

  return error;
}
