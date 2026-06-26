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
      }
    );

    assert.equal(details.mon.status, 'completed_on_time');
    assert.equal(details.mon.firstCompletedOnTime, true);
    assert.equal(details.tue.status, 'not_completed');
    assert.equal(details.wed.status, 'not_completed');
  });

  it('stores late completion as blue when the task was never completed on time', () => {
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

    assert.equal(details.tue.status, 'completed_late');
    assert.equal(details.tue.firstCompletedOnTime, false);
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
      }
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
    });
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
    });

    assert.equal(unchecked.wed.status, 'not_completed');
    assert.equal(unchecked.wed.firstCompletedOnTime, true);
    assert.equal(recheckedAfterDue.wed.status, 'completed_on_time');
    assert.equal(recheckedAfterDue.wed.firstCompletedOnTime, true);
  });
});
