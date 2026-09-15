import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCsvCell } from '../src/services/csvCell.ts';

describe('a cell a spreadsheet will not execute', () => {
  it('defuses the four characters that start a formula', () => {
    /**
     * A display name or a RAILS title is free text somebody else typed, and
     * both end up in files handed to auditors and regulators.
     */
    ['=cmd|\'/c calc\'!A1', '+1+1', '-1+1', '@SUM(A1)'].forEach((value) => {
      assert.equal(toCsvCell(value), `"'${value}"`);
    });
  });

  it('defuses a leading tab or carriage return', () => {
    // Some spreadsheets strip these before deciding whether the cell is a
    // formula, so the character after them is what counts.
    assert.equal(toCsvCell('\t=1+1'), '"\'\t=1+1"');
    assert.equal(toCsvCell('\r=1+1'), '"\'\r=1+1"');
  });

  it('leaves ordinary text alone apart from quoting it', () => {
    assert.equal(toCsvCell('Cara Operator'), '"Cara Operator"');
    assert.equal(toCsvCell('Belt replaced, line restarted'), '"Belt replaced, line restarted"');
  });

  it('does not treat a formula character in the middle as dangerous', () => {
    // 2+2 as a name is odd but harmless; only the first character decides.
    assert.equal(toCsvCell('room 2+2'), '"room 2+2"');
  });

  it('keeps the structural escaping the backend already had', () => {
    // A cell holding a quote, comma or newline shifts every column after it if
    // it is not quoted.
    assert.equal(toCsvCell('she said "no"'), '"she said ""no"""');
    assert.equal(toCsvCell('line one\r\nline two'), '"line one\r\nline two"');
  });

  it('quotes always, not only when it has to', () => {
    /**
     * A cell quoted only sometimes is one where the apostrophe changes whether
     * the quoting rule fires, and the two decisions interacting is the sort of
     * thing nobody notices until an export is wrong.
     */
    assert.equal(toCsvCell('plain'), '"plain"');
  });

  it('handles nothing at all', () => {
    assert.equal(toCsvCell(''), '""');
    assert.equal(toCsvCell(null), '""');
    assert.equal(toCsvCell(undefined), '""');
  });
});
