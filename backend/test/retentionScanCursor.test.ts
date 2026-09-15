import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  didCompleteFullScan,
  nextScanCursor,
  readScanCursor
} from '../src/services/retentionScanCursor.ts';

describe('resuming a retention scan where it stopped', () => {
  it('continues after the last document when the page was full', () => {
    /**
     * Without this the scan read the same first five hundred conversations
     * every night, so any tenant larger than that had a permanent tail that was
     * never examined, never queued and never deleted — while the run reported
     * five hundred examined and looked healthy.
     */
    assert.equal(
      nextScanCursor({ lastDocumentName: 'chat_500', pageSize: 500, returned: 500 }),
      'chat_500'
    );
  });

  it('starts again from the beginning when the end was reached', () => {
    // What makes the scan a loop rather than a line that stops.
    assert.equal(
      nextScanCursor({ lastDocumentName: 'chat_812', pageSize: 500, returned: 312 }),
      null
    );
  });

  it('starts again when there was nothing at all', () => {
    assert.equal(nextScanCursor({ lastDocumentName: null, pageSize: 500, returned: 0 }), null);
  });

  it('does not resume from a name it does not have', () => {
    assert.equal(
      nextScanCursor({ lastDocumentName: '', pageSize: 500, returned: 500 }),
      null
    );
  });
});

describe('reading a stored cursor', () => {
  it('reads each collection separately', () => {
    const stored = { directChats: 'chat_500', groups: 'group_120' };

    assert.equal(readScanCursor(stored, 'directChats'), 'chat_500');
    assert.equal(readScanCursor(stored, 'groups'), 'group_120');
  });

  it('treats anything unusable as no cursor', () => {
    // A damaged cursor must restart the scan, never skip part of it.
    [null, undefined, 'a string', 42, { directChats: 7 }, { directChats: '   ' }]
      .forEach((stored) => {
        assert.equal(readScanCursor(stored, 'directChats'), null);
      });
  });
});

describe('saying whether a tenant was covered completely', () => {
  it('is complete only when both collections reached the end', () => {
    /**
     * The only honest way to say a policy has been applied to all of a tenant,
     * and the question an auditor asks.
     */
    assert.equal(didCompleteFullScan({ directChats: null, groups: null }), true);
    assert.equal(didCompleteFullScan({ directChats: 'chat_500', groups: null }), false);
    assert.equal(didCompleteFullScan({ directChats: null, groups: 'group_120' }), false);
  });
});
