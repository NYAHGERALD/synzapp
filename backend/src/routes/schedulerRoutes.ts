import { Router, type Request } from 'express';
import {
  checkSchedulerSecret,
  readSchedulerSecrets
} from '../middleware/schedulerSecret.js';
import { writeAuditEvent } from '../services/auditService.js';
import { runDueActionReminders } from '../services/actionReminderService.js';
import { runDueScheduledMessages } from '../services/scheduledMessageService.js';

/**
 * Jobs a clock calls, not a person.
 *
 * These routes have no signed-in user and no App Check token, because Cloud
 * Scheduler has neither. They cannot therefore live beside the app's own routes:
 * `apiRouteGuardCoverage.test.ts` asserts that every route on the profile and
 * admin routers requires both, and weakening that assertion to make room for a
 * background job would remove the protection from the several hundred routes it
 * was written for.
 *
 * So scheduled work has its own router with its own guard — a shared secret,
 * compared in constant time — and its own test asserting that every route here
 * checks it.
 */

export const schedulerRouter = Router();

/**
 * Sends every message that has come due.
 *
 * Meant to be called once a minute. A run that finds nothing does nothing and
 * costs one query, so a frequent cadence is cheap; a run that finds more than it
 * can take leaves the rest for the next minute.
 */
schedulerRouter.post('/chat/scheduled-messages/run', async (req, res, next) => {
  try {
    if (!await authorizeSchedulerRequest(req, res, 'SCHEDULED_MESSAGES_RUN')) {
      return;
    }

    const summary = await runDueScheduledMessages(req);

    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

/**
 * Whether this request really came from the scheduler.
 *
 * Answers on the response itself so that every route here is one line, and so
 * that the two refusals — not configured, and wrong secret — cannot drift apart
 * between routes.
 */
/**
 * Reminds people about work they still owe, and escalates what is overdue.
 *
 * Meant to be called every fifteen minutes. A digest is only sent in its own
 * hour, so most runs send none; escalations are checked on every pass, because
 * an action overdue since yesterday should not wait for breakfast.
 */
schedulerRouter.post('/actions/reminders/run', async (req, res, next) => {
  try {
    if (!await authorizeSchedulerRequest(req, res, 'ACTION_REMINDERS_RUN')) {
      return;
    }

    const summary = await runDueActionReminders(req);

    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

async function authorizeSchedulerRequest(
  req: Request,
  res: { json: (body: unknown) => unknown; status: (code: number) => { json: (body: unknown) => unknown } },
  job: string
): Promise<boolean> {
  const decision = checkSchedulerSecret(
    req.header('X-Synzapp-Scheduler-Secret') || '',
    readSchedulerSecrets(
      process.env.SYNZAPP_SCHEDULER_SECRET ||
      process.env.SYNZAPP_RETENTION_SCHEDULER_SECRET
    )
  );

  if (!decision.allowed) {
    /**
     * Written down even when refused. Somebody guessing at this header is
     * trying to make the service send other people's messages, and that attempt
     * used to leave nothing behind at all.
     *
     * A missing secret still fails closed: an unprotected job that sends other
     * people's messages is worse than a job that does not run, because the
     * second is noticed and the first is not.
     */
    await writeAuditEvent({
      action: 'SCHEDULER_JOB_INVOKED',
      metadata: { job, outcome: decision.reason },
      reason: decision.reason || undefined,
      req,
      status: 'DENIED'
    }).catch(() => undefined);

    if (decision.reason === 'NOT_CONFIGURED') {
      res.status(503).json({ error: 'The scheduler is not configured.' });
    } else {
      res.status(401).json({ error: 'Not authorised.' });
    }

    return false;
  }

  await writeAuditEvent({
    action: 'SCHEDULER_JOB_INVOKED',
    // Which value matched, so a rotation in progress is visible on every call
    // rather than assumed to be finished.
    metadata: { job, secretUsed: decision.matched },
    req,
    status: 'SUCCESS'
  }).catch(() => undefined);

  return true;
}

/**
 * Compares the secret without leaking its length or content through how long
 * the comparison takes.
 */
// The comparison lives in middleware/schedulerSecret.ts now, where it also
// supports a rotation in progress and reports which value matched.
