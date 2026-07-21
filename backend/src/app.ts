import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { adminRouter } from './routes/adminRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { lswRouter } from './routes/lswRoutes.js';
import { profileRouter } from './routes/profileRoutes.js';
import { railsRouter } from './routes/railsRoutes.js';
import { rcaRouter } from './routes/rcaRoutes.js';
import { getHealthStatus } from './services/monitoringService.js';

export function createSynzappApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin }));
  app.use(express.json({ limit: '5mb' }));

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

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/lsw', lswRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/rails', railsRouter);
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
    res.status(409).json({ error: error.message });
    return;
  }

  if (error?.name === 'NotFoundError') {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error?.name === 'RateLimitError') {
    res.status(429).json({ error: error.message });
    return;
  }

  if (error?.name === 'AuthorizationError') {
    res.status(403).json({ error: error.message });
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
