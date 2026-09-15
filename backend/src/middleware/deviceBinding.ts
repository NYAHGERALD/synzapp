import type { NextFunction, Request, Response } from 'express';
import { verifyActiveRegisteredDevice } from '../services/deviceIdentityService.js';
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

    await verifyActiveRegisteredDevice(decodedToken, presentedDeviceId);
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
