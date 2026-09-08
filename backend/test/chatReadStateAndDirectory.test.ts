import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const profileRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'profileRoutes.ts'),
  'utf8'
);
const envelopeService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'encryptedMessageEnvelopeService.ts'),
  'utf8'
);
const userProfileService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'userProfileService.ts'),
  'utf8'
);

/**
 * R5 — an unread badge cleared itself seconds after a message arrived.
 *
 * A push woke the app, background hydration fetched the conversation to warm
 * the offline cache, and the fetch marked the chat read as a side effect. The
 * user never opened anything.
 *
 * Reading is something a person does. Fetching is not.
 */
describe('R5: fetching a conversation is not reading it', () => {
  it('lets a caller fetch direct messages without marking them read', () => {
    assert.match(
      profileRoutes,
      /markRead\s*!==\s*'false'/,
      'the direct encrypted-messages route must accept markRead=false'
    );
    assert.match(
      profileRoutes,
      /markAsRead:\s*shouldMarkRead/,
      'the opt-out must reach listEncryptedDirectEnvelopesForDevice'
    );
  });

  it('applies the same opt-out to group messages', () => {
    const groupRoute = profileRoutes.slice(
      profileRoutes.indexOf("'/chat/groups/:groupId/encrypted-messages'")
    );

    assert.match(
      groupRoute.slice(0, 2000),
      /markAsRead:\s*shouldMarkRead/,
      'group fetches must be able to opt out of marking read'
    );
  });

  it('keeps marking read the default, so opening a chat still clears it', () => {
    assert.match(
      envelopeService,
      /options\.markAsRead\s*!==\s*false/,
      'omitting the flag must still mark the conversation read'
    );
  });
});

/**
 * R13 — an employee opened "New chat" and saw nobody, not even their Org Admin.
 *
 * The list was built from the admin-only employee directory, which a non-admin
 * cannot call. The fix exposes the directory every member already has rights to.
 */
describe('R13: every member can start a conversation', () => {
  it('exposes directory contacts on the endpoint any member can call', () => {
    assert.match(
      profileRoutes,
      /includeDirectory\s*===\s*'true'/,
      'the chat contacts route must accept includeDirectory'
    );
    assert.match(
      profileRoutes,
      /includeDirectoryContacts:\s*includeDirectory/,
      'the flag must reach listCurrentUserChatContacts'
    );
  });

  it('shows an employee the Org Admin', () => {
    const visibilityFn = userProfileService.slice(
      userProfileService.indexOf('function getVisibleChatContactRoles')
    ).slice(0, 400);

    assert.match(visibilityFn, /ORG_ADMIN/, 'employees must be able to see their Org Admin');
    assert.match(visibilityFn, /EMPLOYEE/, 'employees must be able to see colleagues');
  });

  it('never returns anyone outside the tenant or the caller themselves', () => {
    const listFn = userProfileService.slice(
      userProfileService.indexOf('export async function listCurrentUserChatContacts')
    ).slice(0, 2000);

    assert.match(listFn, /context\.tenantId/, 'the query must be tenant-scoped');
    assert.match(listFn, /doc\.id\s*!==\s*decodedToken\.uid/, 'the caller must be excluded');
    assert.match(listFn, /status['"]?,\s*'==',\s*'ACTIVE'/, 'only active members are listed');
  });
});

/**
 * Library video thumbnails.
 *
 * A poster cannot be generated from the Library URL — it needs an Authorization
 * header the native media stack will not send — and downloading whole videos to
 * draw list tiles is not viable. The uploading client already holds the file, so
 * it supplies the poster and the server stores and serves it.
 */
const railsService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'railsService.ts'),
  'utf8'
);
const railsRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'railsRoutes.ts'),
  'utf8'
);

describe('library video thumbnails', () => {
  it('accepts a client-supplied poster on upload', () => {
    assert.match(
      railsRoutes,
      /thumbnailDataUrl:\s*z\.string\(\)/,
      'the evidence body must accept a thumbnail'
    );
  });

  it('bounds the poster well below the file limit', () => {
    const thumbnailRule = /thumbnailDataUrl:\s*z\.string\(\)\.max\((\d[\d_]*)\)/.exec(railsRoutes);

    assert.ok(thumbnailRule, 'the thumbnail must have a size limit');

    const limit = Number(thumbnailRule[1].replace(/_/g, ''));

    assert.ok(limit > 0 && limit <= 1_000_000, `thumbnail limit should stay small, got ${limit}`);
  });

  it('only stores an actual image', () => {
    assert.match(
      railsService,
      /data:\(image\\\/\(\?:jpeg\|jpg\|png\|webp\)\)/,
      'the poster must be validated as an image before it is stored'
    );
  });

  it('serves the poster behind the same authorization as the file', () => {
    assert.match(
      railsRoutes,
      /evidence-library\/:evidenceId\/thumbnail/,
      'a thumbnail route must exist'
    );
    assert.match(
      railsService,
      /isRailsEvidenceLibraryRecordVisible\(context, record\)/,
      'thumbnail reads must apply the same visibility check as the evidence itself'
    );
  });

  it('reports a thumbnail url only when one was stored', () => {
    assert.match(
      railsService,
      /thumbnailUrl: record\.thumbnailStoragePath\s*\n?\s*\?/,
      'thumbnailUrl must be null when no poster exists'
    );
  });
});
