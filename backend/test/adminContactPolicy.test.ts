import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ADMIN_CONTACT_POLICY,
  normalizeAdminContactPolicy,
  selectProfileAdminContact,
  validateAdminContactPolicyInput
} from '../src/services/adminContactPolicy.js';

const reader = { readerDepartmentId: 'dept_bakery', readerUid: 'uid_reader' };

describe('admin contact policy', () => {
  it('shows the number unless a tenant has said otherwise', () => {
    assert.equal(DEFAULT_ADMIN_CONTACT_POLICY.showAdminPhoneNumber, true);
    assert.equal(normalizeAdminContactPolicy(null).showAdminPhoneNumber, true);
    assert.equal(normalizeAdminContactPolicy({}).showAdminPhoneNumber, true);
    assert.equal(normalizeAdminContactPolicy({ showAdminPhoneNumber: false }).showAdminPhoneNumber, false);
  });

  it('refuses anything that is not a plain yes or no', () => {
    assert.equal(validateAdminContactPolicyInput({ showAdminPhoneNumber: true }).ok, true);
    assert.equal(validateAdminContactPolicyInput({ showAdminPhoneNumber: 'yes' }).ok, false);
    assert.equal(validateAdminContactPolicyInput({}).ok, false);
  });
});

describe('choosing the admin to show', () => {
  it('prefers the reader own department admin', () => {
    const selected = selectProfileAdminContact({
      ...reader,
      candidates: [
        { departmentId: 'dept_bakery', displayName: 'Bola Ade', role: 'DEPT_ADMIN', uid: 'uid_bola' },
        { departmentId: null, displayName: 'Owner One', role: 'ORG_ADMIN', uid: 'uid_owner' }
      ]
    });

    assert.equal(selected?.contactId, 'uid_bola');
    assert.equal(selected?.scope, 'DEPARTMENT');
    assert.equal(selected?.otherAdminCount, 0);
  });

  it('ignores a department admin who belongs to another department', () => {
    const selected = selectProfileAdminContact({
      ...reader,
      candidates: [
        { departmentId: 'dept_packing', displayName: 'Other Dept', role: 'DEPT_ADMIN', uid: 'uid_other' },
        { departmentId: null, displayName: 'Owner One', role: 'ORG_ADMIN', uid: 'uid_owner' }
      ]
    });

    assert.equal(selected?.contactId, 'uid_owner');
    assert.equal(selected?.scope, 'ORGANIZATION');
  });

  it('falls back to the organization admin when the reader is the department admin', () => {
    const selected = selectProfileAdminContact({
      ...reader,
      candidates: [
        { departmentId: 'dept_bakery', displayName: 'Me Myself', role: 'DEPT_ADMIN', uid: 'uid_reader' },
        { departmentId: null, displayName: 'Owner One', role: 'ORG_ADMIN', uid: 'uid_owner' }
      ]
    });

    assert.equal(selected?.contactId, 'uid_owner');
    assert.equal(selected?.scope, 'ORGANIZATION');
  });

  it('counts the other department admins without naming them', () => {
    const selected = selectProfileAdminContact({
      ...reader,
      candidates: [
        { departmentId: 'dept_bakery', displayName: 'Zoe Last', role: 'DEPT_ADMIN', uid: 'uid_zoe' },
        { departmentId: 'dept_bakery', displayName: 'Ada First', role: 'DEPT_ADMIN', uid: 'uid_ada' }
      ]
    });

    assert.equal(selected?.displayName, 'Ada First');
    assert.equal(selected?.otherAdminCount, 1);
  });

  it('skips anybody who is not active, and anybody with no name', () => {
    const selected = selectProfileAdminContact({
      ...reader,
      candidates: [
        { departmentId: 'dept_bakery', displayName: 'Gone Away', role: 'DEPT_ADMIN', status: 'REMOVED', uid: 'uid_gone' },
        { departmentId: 'dept_bakery', displayName: '   ', role: 'DEPT_ADMIN', uid: 'uid_blank' },
        { departmentId: null, displayName: 'Owner One', role: 'ORG_ADMIN', uid: 'uid_owner' }
      ]
    });

    assert.equal(selected?.contactId, 'uid_owner');
  });

  it('draws no card when there is nobody to name', () => {
    assert.equal(selectProfileAdminContact({ ...reader, candidates: [] }), null);
    assert.equal(selectProfileAdminContact({
      ...reader,
      candidates: [{ departmentId: 'dept_bakery', displayName: 'Only Me', role: 'DEPT_ADMIN', uid: 'uid_reader' }]
    }), null);
  });

  it('handles a reader with no department at all', () => {
    const selected = selectProfileAdminContact({
      candidates: [
        { departmentId: 'dept_bakery', displayName: 'Bola Ade', role: 'DEPT_ADMIN', uid: 'uid_bola' },
        { departmentId: null, displayName: 'Owner One', role: 'ORG_ADMIN', uid: 'uid_owner' }
      ],
      readerDepartmentId: null,
      readerUid: 'uid_reader'
    });

    assert.equal(selected?.contactId, 'uid_owner');
    assert.equal(selected?.scope, 'ORGANIZATION');
  });
});
