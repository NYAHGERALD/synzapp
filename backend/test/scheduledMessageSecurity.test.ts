import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, 'src', ...parts), 'utf8');
const service = read('services', 'scheduledMessageService.ts');
const schedulerRoutes = read('routes', 'schedulerRoutes.ts');
const adminRoutes = read('routes', 'adminRoutes.ts');
const envelopeService = read('services', 'encryptedMessageEnvelopeService.ts');

/**
 * The properties a scheduled message must have, asserted against the source.
 *
 * These are not behaviours a unit test can reach — they involve Firestore, a
 * scheduler and an admin session — but each one is a promise made to somebody:
 * that an admin cannot read a message they can cancel, that a person offboarded
 * at three o'clock has nothing go out at five, and that a job anybody could find
 * the URL of cannot send other people's messages. A regression in any of them
 * would be silent, which is exactly why they are pinned here.
 */

describe('an admin can see a scheduled message and never read it', () => {
  it('gives the admin a different type, not the same one with fields removed', () => {
    // Building the admin view from scratch is what stops a field added to
    // storage later from arriving in an admin's hands by default.
    assert.match(service, /export interface TenantScheduledMessageResponse \{[^}]*\}/);

    const adminType = service.slice(
      service.indexOf('export interface TenantScheduledMessageResponse'),
      service.indexOf('export interface ScheduleDirectMessageInput')
    );

    for (const forbidden of ['envelope', 'ciphertext', 'encryptedKeysByDevice', 'nonce', 'notificationPreview']) {
      assert.doesNotMatch(adminType, new RegExp(forbidden, 'i'), `The admin view must not carry ${forbidden}.`);
    }
  });

  it('builds the admin row field by field rather than spreading the record', () => {
    const mapper = service.slice(
      service.indexOf('function mapTenantScheduledMessage('),
      service.indexOf('function formatUserName(')
    );

    assert.doesNotMatch(mapper, /\.\.\.record/, 'Spreading the record would leak whatever is added to it later.');
    assert.doesNotMatch(mapper, /envelope/i);
  });

  it('refuses the admin listing entirely when the company turned visibility off', () => {
    assert.match(service, /if \(!policy\.adminVisibilityEnabled\) \{[\s\S]{0,200}throw authorizationError/);
  });

  it('returns only an id and a status when an admin cancels', () => {
    // The service hands back the sender's full record; the route must not.
    const handler = adminRoutes.slice(
      adminRoutes.indexOf("adminRouter.post('/scheduled-messages/:scheduledMessageId/cancel'"),
      adminRoutes.indexOf("adminRouter.get('/devices'")
    );

    assert.match(handler, /scheduledMessage: \{\s*scheduledMessageId: scheduledMessage\.scheduledMessageId,\s*status: scheduledMessage\.status\s*\}/);
    assert.doesNotMatch(handler, /res\.json\(\{ scheduledMessage \}\)/);
  });

  it('ties cancelling to seeing, so the setting is not half a setting', () => {
    const rules = read('services', 'scheduledMessageRules.ts');

    assert.match(rules, /callerIsOrgAdminWithSecurityPermission && input\.policy\.adminVisibilityEnabled/);
  });
});

describe('a message never goes out for somebody who has left', () => {
  it('releases through the same conversation checks an ordinary send uses', () => {
    // This is where the offboarding guarantee lives: the shared resolver
    // refuses a sender whose user record is no longer active.
    assert.match(envelopeService, /export async function releaseEncryptedDirectEnvelope/);
    assert.match(
      envelopeService,
      /export async function releaseEncryptedDirectEnvelope\([\s\S]{0,700}resolveEncryptedDirectContext\(/
    );
    assert.match(
      envelopeService,
      /export async function resolveEncryptedDirectContext\([\s\S]{0,2000}currentUser\.status !== 'ACTIVE'/
    );
  });

  it('reads the sender\'s role at release rather than trusting what was stored', () => {
    assert.match(service, /async function deliverClaimedScheduledMessage[\s\S]{0,1500}collection\('users'\)\s*\.doc\(senderUid\)/);
    assert.doesNotMatch(service, /senderRole/);
  });

  it('does not retry a refusal, which would only be refused again', () => {
    assert.match(service, /resolveReleaseFailureStatus\(\{/);
  });
});

describe('the release job cannot be triggered by whoever finds the URL', () => {
  it('checks a shared secret on every route', () => {
    const routeCount = (schedulerRoutes.match(/schedulerRouter\.(delete|get|patch|post)\(/g) || []).length;
    const guardCount = (schedulerRoutes.match(/authorizeSchedulerRequest\(/g) || []).length - 1;

    assert.ok(routeCount > 0, 'Expected scheduler routes to be present.');
    assert.equal(guardCount, routeCount, 'Every scheduler route must check the secret.');
  });

  it('compares it in constant time', () => {
    /**
     * A plain !== on a secret leaks it through how long the comparison takes.
     * The comparison moved into middleware/schedulerSecret.ts, which is also
     * what lets the secret be rotated — it was duplicated here and in
     * complianceRoutes, so a change to one never reached the other.
     */
    assert.match(schedulerRoutes, /checkSchedulerSecret/);
    assert.doesNotMatch(schedulerRoutes, /provided === expected|providedSecret === expectedSecret/);
  });

  it('fails closed when no secret is configured', () => {
    // An unprotected job that sends other people's messages is worse than a job
    // that does not run: the second is noticed and the first is not.
    assert.match(schedulerRoutes, /NOT_CONFIGURED[\s\S]{0,200}503/);
  });

  it('records every invocation, refused or not', () => {
    /**
     * Somebody guessing at this header is trying to make the service send other
     * people's messages, and that attempt used to leave nothing behind at all.
     */
    assert.match(schedulerRoutes, /SCHEDULER_JOB_INVOKED/);
    assert.match(schedulerRoutes, /status: 'DENIED'/);
  });

  it('stays off the routers that every app route is guarded on', () => {
    // It cannot carry App Check or a signed-in session, and weakening the
    // coverage test to admit it would unguard several hundred real routes.
    assert.doesNotMatch(schedulerRoutes, /profileRouter|adminRouter/);
  });
});

describe('a due message is sent once', () => {
  it('claims it in a transaction before doing any work', () => {
    assert.match(service, /async function releaseOneScheduledMessage\([\s\S]{0,900}runTransaction/);
    assert.match(service, /status: 'SENDING'/);
  });

  it('only ever claims one that is still waiting', () => {
    assert.match(service, /if \(!isPendingScheduledMessage\(record\.status\)\) \{\s*return;/);
  });

  it('leans on the send path\'s own duplicate protection as well', () => {
    // Keyed on the client message id, exactly as a retried send from a phone
    // is. Even a lost claim could not deliver the same message twice.
    assert.match(service, /clientMessageId: record\.clientMessageId/);
    assert.match(envelopeService, /findExistingDirectEnvelopeByClientMessageId/);
  });

  it('takes a finished message out of the queue rather than blanking its time', () => {
    // A field set to null still matches a "<= now" range in Firestore, because
    // null sorts before every number. Removing it is what actually works.
    const removals = (service.match(/pendingReleaseAtMs: fieldValue\.delete\(\)/g) || []).length;

    assert.ok(removals >= 3, `Expected sent, cancelled and given-up messages to leave the queue; found ${removals}.`);
    assert.doesNotMatch(service, /pendingReleaseAtMs: null/);
  });
});

describe('nothing is delivered that nobody can open', () => {
  it('drops recipient devices that have gone and sends to the rest', () => {
    assert.match(service, /selectDeliverableRecipientDevices\(/);
    assert.match(service, /recipientDeviceIds: deliverableDeviceIds/);
  });

  it('refuses to send when every device it was sealed to has gone', () => {
    assert.match(service, /if \(!deliverableDeviceIds\.length\) \{[\s\S]{0,300}throw validationError/);
  });

  it('keeps the record and the reason instead of deleting a failure', () => {
    // A message that vanished is indistinguishable from one never scheduled.
    assert.match(service, /status: failure\.nextStatus/);
    assert.doesNotMatch(service, /scheduledMessageRef\.delete\(\)/);
  });
});

describe('the release query has the index it needs', () => {
  const indexConfig = JSON.parse(
    readFileSync(resolve(backendRoot, '..', 'firestore.indexes.json'), 'utf8')
  ) as {
    fieldOverrides?: {
      collectionGroup: string;
      fieldPath: string;
      indexes: { order?: string; queryScope?: string }[];
    }[];
  };

  it('declares a collection-group index for the field the worker queries', () => {
    // Learned from production. Firestore's automatic single-field indexes have
    // collection scope only, so a collection-group query on a field needs the
    // field's index configuration set explicitly. Without this the release job
    // fails every minute with FAILED_PRECONDITION and no message ever goes.
    const override = indexConfig.fieldOverrides?.find((entry) =>
      entry.collectionGroup === 'scheduledMessages' &&
      entry.fieldPath === 'pendingReleaseAtMs');

    assert.ok(override, 'The queue field needs a declared index override.');
    assert.ok(
      override.indexes.some((index) =>
        index.queryScope === 'COLLECTION_GROUP' && index.order === 'ASCENDING'),
      'The worker orders ascending across every tenant, so it needs COLLECTION_GROUP_ASC.'
    );
  });

  it('queries the field it declared, and orders it the way the index allows', () => {
    // The declaration and the query have to name the same field. Renaming one
    // without the other is silent until the job runs.
    assert.match(service, /collectionGroup\('scheduledMessages'\)/);
    assert.match(service, /\.where\('pendingReleaseAtMs', '<=', nowMs\)/);
    assert.match(service, /\.orderBy\('pendingReleaseAtMs', 'asc'\)/);
  });
});
