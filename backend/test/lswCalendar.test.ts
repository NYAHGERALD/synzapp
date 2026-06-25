import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateCalendarWeekContext } from '../src/services/lswService.ts';

describe('LSW company calendar week numbering', () => {
  it('uses the tenant calendar start date as week 1', () => {
    const context = calculateCalendarWeekContext(
      {
        startDate: '2025-10-27',
        startDay: 27,
        startMonth: 10,
        startYear: 2025,
        weekOneStartsOn: 'CALENDAR_YEAR_START'
      },
      { week: 1, year: 2025 },
      new Date(Date.UTC(2026, 5, 24))
    );

    assert.equal(context.weekBeginning, '2025-10-27');
    assert.equal(context.weekEnding, '2025-11-02');
    assert.equal(context.currentWeek, 35);
    assert.equal(context.currentYear, 2025);
    assert.equal(context.totalWeeksInYear, 53);
  });
});
