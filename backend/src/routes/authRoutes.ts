import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../config/firebaseAdmin.js';
import { env } from '../config/env.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { verifyAppCheck } from '../middleware/appCheck.js';
import {
  assertOtpPreflight,
  buildAuthSession,
  verifyFirebaseSession
} from '../services/authSessionService.js';
import { writeAuditEvent } from '../services/auditService.js';
import {
  getCurrentUserProfile,
  getCurrentUserProfilePhoto,
  getTenantUserProfilePhoto
} from '../services/userProfileService.js';
import { maskPhoneNumber } from '../utils/phone.js';

const authRouter = Router();
const ACCESS_DENIED_MESSAGE = 'Access denied. Please contact your organization administrator.';

const sessionBodySchema = z.object({
  event: z.enum(['login', 'restore']).default('login')
});

const otpPreflightBodySchema = z.object({
  phoneNumber: z.string().min(8).max(16)
});

authRouter.post(
  '/otp/preflight',
  verifyAppCheck,
  createRateLimiter({
    durable: true,
    keyPrefix: 'otp-preflight-ip',
    max: env.otpRateLimitMax,
    message: 'Too many code requests. Please wait before trying again.',
    windowMs: env.otpRateLimitWindowMs
  }),
  async (req, res, next) => {
    try {
      const body = otpPreflightBodySchema.parse(req.body);
      const result = await assertOtpPreflight(body.phoneNumber);

      await writeAuditEvent({
        action: 'AUTH_OTP_PREFLIGHT',
        phoneMasked: result.phoneMasked,
        req,
        status: 'SUCCESS'
      });

      res.json({
        ok: true,
        phoneMasked: result.phoneMasked,
        retryAfterSeconds: result.retryAfterSeconds
      });
    } catch (error) {
      await writeAuditEvent({
        action: 'AUTH_OTP_PREFLIGHT',
        phoneMasked: typeof req.body?.phoneNumber === 'string' ? maskPhoneNumber(req.body.phoneNumber) : undefined,
        reason: error instanceof Error ? error.message : 'OTP preflight failed',
        req,
        status: 'DENIED'
      }).catch(() => undefined);

      next(error);
    }
  }
);

authRouter.post(
  '/session',
  verifyAppCheck,
  createRateLimiter({
    durable: true,
    keyPrefix: 'auth-session-ip',
    max: env.authRateLimitMax,
    message: 'Too many sign-in attempts. Please wait before trying again.',
    windowMs: env.authRateLimitWindowMs
  }),
  async (req, res, next) => {
    try {
      const authorizationHeader = req.header('Authorization') || '';
      const idToken = authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice('Bearer '.length)
        : '';

      if (!idToken) {
        res.status(401).json({ error: 'Missing Firebase ID token.' });
        return;
      }

      const body = sessionBodySchema.parse(req.body);
      const decodedToken = await verifyFirebaseSession(idToken);
      const session = await buildAuthSession(decodedToken, { consumeRateLimit: true });

      await writeAuditEvent({
        action: body.event === 'restore' ? 'AUTH_SESSION_RESTORE' : 'AUTH_LOGIN',
        metadata: {
          access: session.access,
          claimsRefreshed: session.claimsRefreshed,
          nextStep: session.nextStep
        },
        phoneMasked: session.user.phoneMasked,
        req,
        status: session.access === 'BLOCKED' ? 'DENIED' : 'SUCCESS',
        tenantId: session.user.tenantId,
        uid: session.user.uid
      });

      if (session.access === 'BLOCKED') {
        res.status(403).json({ error: ACCESS_DENIED_MESSAGE });
        return;
      }

      res.json(session);
    } catch (error) {
      await writeAuditEvent({
        action: 'AUTH_LOGIN',
        reason: error instanceof Error ? error.message : 'Auth session failed',
        req,
        status: 'FAILED'
      }).catch(() => undefined);

      next(error);
    }
  }
);

authRouter.get('/web-profile', verifyAppCheck, async (req, res, next) => {
  try {
    const authorizationHeader = req.header('Authorization') || '';
    const idToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length)
      : '';

    if (!idToken) {
      res.status(401).json({ error: 'Missing Firebase ID token.' });
      return;
    }

    const decodedToken = await verifyFirebaseSession(idToken);
    const profile = await getCurrentUserProfile(decodedToken);

    await writeAuditEvent({
      action: 'AUTH_WEB_PROFILE',
      phoneMasked: profile.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: profile.tenantId,
      uid: profile.uid
    }).catch(() => undefined);

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/web-profile/photo', verifyAppCheck, async (req, res, next) => {
  try {
    const authorizationHeader = req.header('Authorization') || '';
    const idToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length)
      : '';

    if (!idToken) {
      res.status(401).json({ error: 'Missing Firebase ID token.' });
      return;
    }

    const decodedToken = await verifyFirebaseSession(idToken);
    const requestedUid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
    const profilePhoto = requestedUid
      ? await getTenantUserProfilePhoto(decodedToken, requestedUid)
      : await getCurrentUserProfilePhoto(decodedToken);
    const etag = `"${profilePhoto.cacheKey}"`;

    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Type', profilePhoto.contentType);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    profilePhoto.file
      .createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', verifyAppCheck, async (req, res, next) => {
  try {
    const authorizationHeader = req.header('Authorization') || '';
    const idToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length)
      : '';

    if (!idToken) {
      const error = new Error('Missing Firebase ID token.');
      error.name = 'AuthenticationError';
      throw error;
    }

    const decodedToken = await verifyFirebaseSession(idToken);
    const session = await buildAuthSession(decodedToken);

    /**
     * Sign-out now ends the session on the server, not only in the app.
     *
     * It used to verify the token, write an audit line and return ok, leaving
     * the credential live until it expired on its own. "Are sessions terminated
     * on logout" is on every enterprise questionnaire, and it matters on a plant
     * floor or in a warehouse where a tablet is shared between shifts: the
     * worker who signed out was still signed in.
     *
     * This works immediately rather than at the next refresh, because
     * `verifyFirebaseSession` passes `checkRevoked: true` — every later request
     * is rejected the moment it arrives.
     *
     * Firebase revokes per account, not per device, so this signs the person out
     * everywhere rather than only here. That is the right trade for an explicit
     * sign-out: somebody who meant to leave a session should not have to wonder
     * which of their sessions actually ended. Signing in again is one code.
     */
    await adminAuth.revokeRefreshTokens(decodedToken.uid);

    await writeAuditEvent({
      action: 'AUTH_LOGOUT',
      metadata: {
        access: session.access,
        nextStep: session.nextStep,
        sessionsRevoked: true
      },
      phoneMasked: session.user.phoneMasked,
      req,
      status: 'SUCCESS',
      tenantId: session.user.tenantId || (decodedToken.tenantId as string | undefined),
      uid: decodedToken.uid
    });

    res.json({ ok: true });
  } catch (error) {
    await writeAuditEvent({
      action: 'AUTH_LOGOUT',
      reason: error instanceof Error ? error.message : 'Logout failed',
      req,
      status: 'FAILED'
    }).catch(() => undefined);

    next(error);
  }
});

export { authRouter };
