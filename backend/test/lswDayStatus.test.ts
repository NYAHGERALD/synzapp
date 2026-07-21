import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLswDayStatusInputForTest,
  getEmptyLswDayStatusDetailsForTest
} from '../src/services/lswService.ts';

describe('LSW daily task day status rules', () => {
  it('keeps untouched cells red and records only the requested day', () => {
    const details = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { mon: true },
        dayStatusUpdates: {
          mon: {
            completedAtIso: '2026-06-22T12:00:00.000Z',
            dueAtIso: '2026-06-22T13:00:00.000Z',
            status: 'completed_on_time',
            timeZone: 'America/Chicago'
          }
        }
      },
      '2026-W26'
    );

    assert.equal(details.mon.status, 'completed_on_time');
    assert.equal(details.mon.completionTiming, 'within_window');
    assert.equal(details.mon.completionWindowHours, 24);
    assert.equal(details.mon.completedWeekKey, '2026-W26');
    assert.equal(details.mon.completedWeekLabel, 'Week 26, 2026');
    assert.match(details.mon.completedAtDayLabel || '', /Monday/);
    assert.match(details.mon.completedAtTimeLabel || '', /7:00/);
    assert.equal(details.mon.completionOffsetMinutes, -60);
    assert.equal(details.mon.firstCompletedOnTime, true);
    assert.equal(details.tue.status, 'not_completed');
    assert.equal(details.wed.status, 'not_completed');
  });

  it('keeps completion green when it is within 24 hours after the scheduled time', () => {
    const details = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { tue: true },
        dayStatusUpdates: {
          tue: {
            completedAtIso: '2026-06-24T12:00:00.000Z',
            dueAtIso: '2026-06-23T13:00:00.000Z',
            status: 'completed_late',
            timeZone: 'America/Chicago'
          }
        }
      }
    );

    assert.equal(details.tue.status, 'completed_on_time');
    assert.equal(details.tue.completionTiming, 'within_window');
    assert.equal(details.tue.firstCompletedOnTime, true);
  });

  it('stores late completion as yellow when it is more than 24 hours after the scheduled time', () => {
    const details = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { tue: true },
        dayStatusUpdates: {
          tue: {
            completedAtIso: '2026-06-24T14:00:00.000Z',
            dueAtIso: '2026-06-23T13:00:00.000Z',
            status: 'completed_on_time',
            timeZone: 'America/Chicago'
          }
        }
      },
      '2026-W26'
    );

    assert.equal(details.tue.status, 'completed_late');
    assert.equal(details.tue.completionTiming, 'late');
    assert.equal(details.tue.firstCompletedOnTime, false);
    assert.equal(details.tue.completionOffsetMinutes, 1500);
  });

  it('stores future completion as blue when it is more than 24 hours before the scheduled time', () => {
    const details = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { fri: true },
        dayStatusUpdates: {
          fri: {
            completedAtIso: '2026-06-25T12:00:00.000Z',
            dueAtIso: '2026-06-26T13:00:00.000Z',
            status: 'completed_on_time',
            timeZone: 'America/Chicago'
          }
        }
      },
      '2026-W26'
    );

    assert.equal(details.fri.status, 'completed_early');
    assert.equal(details.fri.completionTiming, 'early');
    assert.equal(details.fri.firstCompletedOnTime, false);
    assert.equal(details.fri.completionOffsetMinutes, -1500);
  });

  it('uses the scheduled date year in the visible week label for company calendar years', () => {
    const details = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { fri: true },
        dayStatusUpdates: {
          fri: {
            completedAtIso: '2026-06-26T22:32:00.000Z',
            dueAtIso: '2026-06-26T22:32:00.000Z',
            status: 'completed_on_time',
            timeZone: 'America/Chicago'
          }
        }
      },
      '2025-W35'
    );

    assert.equal(details.fri.completedWeekKey, '2025-W35');
    assert.equal(details.fri.completedWeekLabel, 'Week 35, 2026');
  });

  it('preserves on-time history when a past cell is unchecked and checked again later', () => {
    const completedOnTime = applyLswDayStatusInputForTest(
      getEmptyLswDayStatusDetailsForTest(),
      {
        days: { wed: true },
        dayStatusUpdates: {
          wed: {
            completedAtIso: '2026-06-24T12:00:00.000Z',
            dueAtIso: '2026-06-24T13:00:00.000Z',
            status: 'completed_on_time',
            timeZone: 'America/Chicago'
          }
        }
      },
      '2026-W26'
    );
    const unchecked = applyLswDayStatusInputForTest(completedOnTime, {
      days: { wed: false },
      dayStatusUpdates: {
        wed: {
          dueAtIso: '2026-06-24T13:00:00.000Z',
          status: 'not_completed',
          timeZone: 'America/Chicago'
        }
      }
    }, '2026-W26');
    const recheckedAfterDue = applyLswDayStatusInputForTest(unchecked, {
      days: { wed: true },
      dayStatusUpdates: {
        wed: {
          completedAtIso: '2026-06-25T12:00:00.000Z',
          dueAtIso: '2026-06-24T13:00:00.000Z',
          status: 'completed_late',
          timeZone: 'America/Chicago'
        }
      }
    }, '2026-W26');

    assert.equal(unchecked.wed.status, 'not_completed');
    assert.equal(unchecked.wed.firstCompletedOnTime, true);
    assert.equal(recheckedAfterDue.wed.status, 'completed_on_time');
    assert.equal(recheckedAfterDue.wed.firstCompletedOnTime, true);
    assert.equal(recheckedAfterDue.wed.completedAtIso, '2026-06-24T12:00:00.000Z');
  });
});
