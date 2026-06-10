import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const adminRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'adminRoutes.ts'), 'utf8');
const authRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'authRoutes.ts'), 'utf8');
const profileRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'profileRoutes.ts'), 'utf8');

describe('audit coverage foundation', () => {
  it('audits every current admin mutation route on success and failure', () => {
    const mutationBlocks = getRouteBlocks(adminRoutes, 'adminRouter', ['post', 'patch', 'delete']);

    assert.ok(mutationBlocks.length > 0, 'Expected admin mutation routes to be present.');

    mutationBlocks.forEach((block) => {
      assert.match(block.header, /verifyAppCheck/, `${block.header} must require App Check middleware.`);
      assert.match(block.body, /requireActiveRegisteredDevice/, `${block.header} must require an active device.`);
      assert.match(block.body, /writeAuditEvent/, `${block.header} must write an audit event.`);
      assert.match(block.body, /status:\s*'SUCCESS'/, `${block.header} must audit success.`);
      assert.match(block.body, /status:\s*'FAILED'/, `${block.header} must audit failure.`);
    });
  });

  it('audits authentication login, failed login, restore, and OTP preflight outcomes', () => {
    assert.match(authRoutes, /action:\s*'AUTH_OTP_PREFLIGHT'/);
    assert.match(authRoutes, /status:\s*'DENIED'/);
    assert.match(authRoutes, /action:\s*body\.event === 'restore' \? 'AUTH_SESSION_RESTORE' : 'AUTH_LOGIN'/);
    assert.match(authRoutes, /status:\s*session\.access === 'BLOCKED' \? 'DENIED' : 'SUCCESS'/);
    assert.match(authRoutes, /action:\s*'AUTH_LOGIN'/);
    assert.match(authRoutes, /action:\s*'AUTH_LOGOUT'/);
    assert.match(authRoutes, /status:\s*'FAILED'/);
  });

  it('audits user registration and profile-owned security mutations', () => {
    [
      'DEVICE_IDENTITY_REGISTERED',
      'USER_DEVICE_REVOKED',
      'ENCRYPTED_DIRECT_CHAT_ENVELOPE_SENT',
      'ENCRYPTED_CHAT_BACKUP_UPLOADED',
      'USER_PROFILE_PHOTO_UPDATED',
      'EMPLOYEE_PROFILE_CREATED',
      'TENANT_CREATED',
      'ORG_ADMIN_PROFILE_CREATED'
    ].forEach((action) => {
      assert.match(profileRoutes, new RegExp(`action:\\s*'${action}'`), `${action} audit action is missing.`);
    });
  });
});

function getRouteBlocks(
  source: string,
  routerName: string,
  methods: Array<'delete' | 'patch' | 'post'>
): Array<{ body: string; header: string }> {
  const routePattern = new RegExp(`${routerName}\\.(${methods.join('|')})\\(`, 'g');
  const blocks: Array<{ body: string; header: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(source))) {
    const start = match.index;
    const nextRoutePattern = new RegExp(`${routerName}\\.(get|post|patch|delete)\\(`, 'g');

    nextRoutePattern.lastIndex = start + 1;
    const nextRouteMatch = nextRoutePattern.exec(source);
    const end = nextRouteMatch?.index ?? source.length;
    const block = source.slice(start, end);
    const header = block.split('\n')[0] || `${routerName}.${match[1]}`;

    blocks.push({
      body: block,
      header
    });
  }

  return blocks;
}
