import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { parseCorsOrigins } from './config/envGuards.js';
import { attachAuditCorrelationId } from './middleware/auditContext.js';
import { enforceDeviceBinding } from './middleware/deviceBinding.js';
import { adminRouter } from './routes/adminRoutes.js';
import { actionRouter } from './routes/actionRoutes.js';
import { announcementRouter } from './routes/announcementRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { interpreterRouter } from './routes/interpreterRoutes.js';
import { lswRouter } from './routes/lswRoutes.js';
import { profileRouter } from './routes/profileRoutes.js';
import { railsRouter } from './routes/railsRoutes.js';
import { rcaRouter } from './routes/rcaRoutes.js';
import { getHealthStatus } from './services/monitoringService.js';
import { contactRouter } from './routes/contactRoutes.js';
import { schedulerRouter } from './routes/schedulerRoutes.js';
import { staffRouter } from './routes/staffRoutes.js';
import { complianceRouter } from './routes/complianceRoutes.js';

export function createSynzappApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    exposedHeaders: ['Content-Disposition'],
    origin: parseCorsOrigins(env.corsOrigin)
  }));
  /**
   * Sized for what the evidence limit actually costs on the wire.
   *
   * Evidence is sent as a base64 data URL inside JSON, and base64 is four
   * thirds of the file. So the 4 MB that rcaService and railsService both
   * advertise arrives as 5.33 MB, and a 5 MB cap rejected it before either
   * check could run — the advertised limit was unreachable, and anything over
   * 3.75 MB failed with a body-parser 413 that does not mention a limit.
   */
  app.use(express.json({ limit: '8mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'synzapp-backend' });
  });

  app.get('/health/live', (_req, res) => {
    res.json({ ok: true, service: 'synzapp-backend' });
  });

  app.get('/health/ready', (_req, res) => {
    const status = getHealthStatus();

    res.status(status.ok ? 200 : 503).json(status);
  });

  /**
   * Before every router, so a revoked phone is refused whatever it asks for.
   *
   * Device binding was written into two route files and missing from eleven.
   * Lifting it here rather than adding it to each router also keeps it out of
   * RAILS, LSW, RCA and the interpreter, which are shipped and not edited.
   */
  app.use(enforceDeviceBinding);
  // After the guard, so the guard's index stays ahead of the routers, and
  // before any route can write an audit event.
  app.use(attachAuditCorrelationId);

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/interpreter', interpreterRouter);
  app.use('/api/lsw', lswRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/rails', railsRouter);
  app.use('/api/announcements', announcementRouter);
  app.use('/api/actions', actionRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/scheduler', schedulerRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/rca', rcaRouter);
  app.use(errorHandler);

  return app;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.name === 'ZodError') {
    res.status(400).json({ error: getZodErrorMessage(error) });
    return;
  }

  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'This upload is too large. Please choose a smaller file and try again.' });
    return;
  }

  if (error?.name === 'ValidationError') {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error?.name === 'ConflictError') {
    /**
     * A conflict may need answering, not just reporting.
     *
     * Matching on the wording of an error is how a revoked device ended up not
     * recognising itself, so a conflict the app has to act on carries a code and
     * whatever the person needs to see before deciding.
     */
    res.status(409).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {})
    });
    return;
  }

  if (error?.name === 'NotFoundError') {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error?.name === 'RateLimitError') {
    const retryAfterSeconds = Number((error as Error & { retryAfterSeconds?: number }).retryAfterSeconds);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(Math.ceil(retryAfterSeconds)));
      res.status(429).json({
        error: error.message,
        retryAfterSeconds: Math.ceil(retryAfterSeconds)
      });
      return;
    }

    res.status(429).json({ error: error.message });
    return;
  }

  if (error?.name === 'TranslationServiceError') {
    const statusCode = Number((error as Error & { statusCode?: number }).statusCode);
    res.status(Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 503).json({
      error: error.message
    });
    return;
  }

  if (error?.name === 'AiPolicyDeniedError') {
    res.status(403).json({ error: error.message });
    return;
  }

  if (error?.name === 'AuthorizationError') {
    // Same reason as the conflict above: a refusal the app must act on carries a
    // code, so it is never left matching on the wording.
    res.status(403).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {})
    });
    return;
  }

  if (error?.name === 'AuthenticationError') {
    res.status(401).json({ error: error.message });
    return;
  }

  if (error instanceof Error && /E\.164/.test(error.message)) {
    res.status(400).json({ error: 'Invalid phone number.' });
    return;
  }

  if (error?.code === 'auth/id-token-revoked') {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  if (error?.code === 'auth/argument-error' || error?.code === 'auth/id-token-expired') {
    res.status(401).json({ error: 'Your secure session could not be verified.' });
    return;
  }

  console.error('Unhandled backend error:', error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

function getZodErrorMessage(error: unknown): string {
  const issues = typeof error === 'object' && error !== null && 'issues' in error
    ? (error as { issues?: Array<{
      code?: string;
      maximum?: number;
      minimum?: number;
      path?: Array<string | number>;
    }> }).issues
    : undefined;
  const profilePhotoIssue = issues?.find((issue) =>
    issue.path?.some((pathSegment) => pathSegment === 'profilePhotoDataUrl')
  );

  if (profilePhotoIssue?.code === 'too_big') {
    return 'Profile photo is too large. Please choose a smaller photo and try again.';
  }

  if (profilePhotoIssue) {
    return 'Profile photo could not be processed. Please choose another photo.';
  }

  const firstIssue = issues?.[0];

  if (!firstIssue) {
    return 'Invalid request.';
  }

  const fieldLabel = getZodFieldLabel(firstIssue.path);
  const isTextLengthField = firstIssue.path?.some((pathSegment) =>
    pathSegment === 'title' || pathSegment === 'assetId'
  );

  if (firstIssue.code === 'too_big' && typeof firstIssue.maximum === 'number') {
    return isTextLengthField
      ? `${fieldLabel} must be ${firstIssue.maximum} characters or fewer.`
      : `${fieldLabel} must be ${firstIssue.maximum} or lower.`;
  }

  if (firstIssue.code === 'too_small' && typeof firstIssue.minimum === 'number') {
    return isTextLengthField
      ? `${fieldLabel} must be at least ${firstIssue.minimum} characters.`
      : `${fieldLabel} must be ${firstIssue.minimum} or higher.`;
  }

  return `${fieldLabel} has an invalid value.`;
}

function getZodFieldLabel(path: Array<string | number> | undefined): string {
  const pathKey = path?.map(String).join('.') || '';
  const fieldLabels: Record<string, string> = {
    assetId: 'Asset, line, or process',
    'riskFactors.detection': 'Detection',
    'riskFactors.occurrence': 'Occurrence',
    'riskFactors.severity': 'Severity',
    title: 'Incident title'
  };

  return fieldLabels[pathKey] || 'Request';
}
