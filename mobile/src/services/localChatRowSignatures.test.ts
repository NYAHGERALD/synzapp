import { describe, expect, it } from 'vitest';
import { buildLocalChatRowSignature, planLocalChatRowWrites } from './localChatRowSignatures';

interface Row {
  id: string;
  text: string;
}

const getRowId = (row: Row) => row.id;

describe('buildLocalChatRowSignature', () => {
  it('is stable for the same value', () => {
    const value = { id: 'm1', text: 'Hello' };

    expect(buildLocalChatRowSignature(value)).toBe(buildLocalChatRowSignature({ ...value }));
  });

  it('changes when any field changes', () => {
    const before = buildLocalChatRowSignature({ deliveryStatus: 'sent', id: 'm1' });
    const after = buildLocalChatRowSignature({ deliveryStatus: 'read', id: 'm1' });

    // A read receipt has to be detected, or the bubble never updates on screen.
    expect(before).not.toBe(after);
  });

  it('handles values that do not serialise', () => {
    expect(() => buildLocalChatRowSignature(undefined)).not.toThrow();
    expect(buildLocalChatRowSignature(undefined)).toBe(buildLocalChatRowSignature(undefined));
  });

  it('stays short regardless of input size', () => {
    const big = { id: 'm1', text: 'x'.repeat(200_000) };

    expect(buildLocalChatRowSignature(big).length).toBeLessThan(24);
  });
});

describe('planLocalChatRowWrites', () => {
  it('writes everything when nothing is stored', () => {
    const rows: Row[] = [
      { id: 'm1', text: 'a' },
      { id: 'm2', text: 'b' }
    ];
    const plan = planLocalChatRowWrites(rows, getRowId, new Map());

    expect(plan.changed).toHaveLength(2);
    expect(plan.unchangedCount).toBe(0);
  });

  it('skips rows that have not changed', () => {
    const rows: Row[] = [
      { id: 'm1', text: 'a' },
      { id: 'm2', text: 'b' }
    ];
    const first = planLocalChatRowWrites(rows, getRowId, new Map());
    const second = planLocalChatRowWrites(rows, getRowId, first.signatures);

    // This is the whole point: receiving one message must not rewrite the thread.
    expect(second.changed).toHaveLength(0);
    expect(second.unchangedCount).toBe(2);
  });

  it('writes only the new message when one arrives', () => {
    const rows: Row[] = [{ id: 'm1', text: 'a' }];
    const first = planLocalChatRowWrites(rows, getRowId, new Map());
    const second = planLocalChatRowWrites(
      [...rows, { id: 'm2', text: 'b' }],
      getRowId,
      first.signatures
    );

    expect(second.changed).toEqual([{ id: 'm2', text: 'b' }]);
    expect(second.unchangedCount).toBe(1);
  });

  it('rewrites a row whose content changed', () => {
    const first = planLocalChatRowWrites([{ id: 'm1', text: 'a' }], getRowId, new Map());
    const second = planLocalChatRowWrites([{ id: 'm1', text: 'edited' }], getRowId, first.signatures);

    expect(second.changed).toHaveLength(1);
  });

  it('reports signatures for every row, including skipped ones', () => {
    const rows: Row[] = [
      { id: 'm1', text: 'a' },
      { id: 'm2', text: 'b' }
    ];
    const first = planLocalChatRowWrites(rows, getRowId, new Map());
    const second = planLocalChatRowWrites(rows, getRowId, first.signatures);

    // The returned map replaces the stored one, so dropping skipped rows would
    // make them look new on the very next save.
    expect(second.signatures.size).toBe(2);
  });

  it('ignores rows with no id', () => {
    const plan = planLocalChatRowWrites([{ id: '', text: 'a' }], getRowId, new Map());

    expect(plan.changed).toHaveLength(0);
    expect(plan.signatures.size).toBe(0);
  });

  it('forgets rows that are no longer present', () => {
    const first = planLocalChatRowWrites(
      [{ id: 'm1', text: 'a' }, { id: 'm2', text: 'b' }],
      getRowId,
      new Map()
    );
    const second = planLocalChatRowWrites([{ id: 'm1', text: 'a' }], getRowId, first.signatures);

    expect(second.signatures.has('m2')).toBe(false);
  });
});
