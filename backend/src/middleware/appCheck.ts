import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { adminAppCheck } from '../config/firebaseAdmin.js';

export interface AppCheckVerificationInput {
  requireAppCheck: boolean;
  token?: string;
  verifyToken: (token: string) => Promise<unknown>;
}

export type AppCheckVerificationResult =
  | { ok: true }
  | { error: string; ok: false };

export async function verifyAppCheckToken(input: AppCheckVerificationInput): Promise<AppCheckVerificationResult> {
  if (!input.token) {
    return input.requireAppCheck
      ? { error: 'App verification is required.', ok: false }
      : { ok: true };
  }

  try {
    await input.verifyToken(input.token);
    return { ok: true };
  } catch {
    return { error: 'App verification failed.', ok: false };
  }
}

export async function verifyAppCheck(req: Request, res: Response, next: NextFunction) {
  const result = await verifyAppCheckToken({
    requireAppCheck: env.requireAppCheck,
    token: req.header('X-Firebase-AppCheck') || undefined,
    verifyToken: (token) => adminAppCheck.verifyToken(token)
  });

  if (result.ok) {
    next();
    return;
  }

  res.status(401).json({ error: result.error });
}
