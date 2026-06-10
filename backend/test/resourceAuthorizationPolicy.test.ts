import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessOwnResource,
  canReadDirectChat,
  canReadDirectEnvelope
} from '../src/services/authorizationPolicy.ts';

describe('mocked token and resource authorization policy', () => {
  const activeEmployee = {
    access: 'ACTIVE',
    permissions: [],
    requesterUid: 'user_a',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    tenantId: 'tenant_a'
  };

  it('allows users to access only their own tenant-owned resources', () => {
    assert.equal(
      canAccessOwnResource({
        ...activeEmployee,
        ownerUid: 'user_a',
        resourceTenantId: 'tenant_a'
      }),
      true
    );
    assert.equal(
      canAccessOwnResource({
        ...activeEmployee,
        ownerUid: 'user_b',
        resourceTenantId: 'tenant_a'
      }),
      false
    );
    assert.equal(
      canAccessOwnResource({
        ...activeEmployee,
        ownerUid: 'user_a',
        resourceTenantId: 'tenant_b'
      }),
      false
    );
  });

  it('allows direct-chat reads only for same-tenant participants', () => {
    assert.equal(
      canReadDirectChat({
        ...activeEmployee,
        participantIds: ['user_a', 'user_b'],
        resourceTenantId: 'tenant_a'
      }),
      true
    );
    assert.equal(
      canReadDirectChat({
        ...activeEmployee,
        participantIds: ['user_b', 'user_c'],
        resourceTenantId: 'tenant_a'
      }),
      false
    );
    assert.equal(
      canReadDirectChat({
        ...activeEmployee,
        participantIds: ['user_a', 'user_b'],
        resourceTenantId: 'tenant_b'
      }),
      false
    );
  });

  it('allows encrypted envelope reads only for sender or recipient participants', () => {
    assert.equal(
      canReadDirectEnvelope({
        ...activeEmployee,
        participantIds: ['user_a', 'user_b'],
        recipientUid: 'user_b',
        resourceTenantId: 'tenant_a',
        senderUid: 'user_a'
      }),
      true
    );
    assert.equal(
      canReadDirectEnvelope({
        ...activeEmployee,
        participantIds: ['user_a', 'user_b'],
        recipientUid: 'user_b',
        resourceTenantId: 'tenant_a',
        senderUid: 'user_c'
      }),
      false
    );
    assert.equal(
      canReadDirectEnvelope({
        ...activeEmployee,
        participantIds: ['user_a', 'user_b'],
        recipientUid: 'user_c',
        resourceTenantId: 'tenant_a',
        senderUid: 'user_b'
      }),
      false
    );
  });
});
