import { describe, expect, it } from 'vitest';
import {
  MORNING_HOUR,
  buildLaterToday,
  buildMorningOn,
  buildNextMondayMorning,
  buildScheduleQuickOptions,
  formatScheduledTime
} from './scheduleMessageTimes';

/**
 * The times offered when scheduling.
 *
 * Everything is asserted in local terms — the hour, the day of the week — never
 * as an absolute number of milliseconds, because these are local wall-clock
 * promises and the test must hold wherever it runs.
 */

// A Monday, so the "today is Monday" case is the default rather than an
// afterthought, and 10:07 so rounding has something to do.
const monday = (hour: number, minute = 0) => new Date(2026, 8, 7, hour, minute, 0, 0);

describe('a few hours from now', () => {
  it('is three hours ahead, on a tidy quarter hour', () => {
    const at = buildLaterToday(monday(10, 7));

    expect(at?.getHours()).toBe(13);
    expect(at?.getMinutes()).toBe(15);
  });

  it('leaves an already tidy time alone', () => {
    const at = buildLaterToday(monday(10, 30));

    expect(at?.getHours()).toBe(13);
    expect(at?.getMinutes()).toBe(30);
  });

  it('has no seconds on it', () => {
    const at = buildLaterToday(new Date(2026, 8, 7, 10, 7, 43, 512));

    expect(at?.getSeconds()).toBe(0);
    expect(at?.getMilliseconds()).toBe(0);
  });

  it('is not offered in the evening', () => {
    // Three hours after nine at night is the middle of the night, which is not
    // when anybody wants a message from work to arrive.
    expect(buildLaterToday(monday(21, 0))).toBeNull();
    expect(buildLaterToday(monday(23, 30))).toBeNull();
  });

  it('is not offered when it would spill into tomorrow', () => {
    expect(buildLaterToday(monday(22, 0))).toBeNull();
  });

  it('is offered in the early evening', () => {
    expect(buildLaterToday(monday(17, 0))?.getHours()).toBe(20);
  });
});

describe('tomorrow morning', () => {
  it('is nine on the next day', () => {
    const at = buildMorningOn(monday(22, 40), 1);

    expect(at.getHours()).toBe(MORNING_HOUR);
    expect(at.getMinutes()).toBe(0);
    expect(at.getDate()).toBe(8);
  });

  it('crosses the end of a month', () => {
    const at = buildMorningOn(new Date(2026, 8, 30, 14, 0), 1);

    expect(at.getMonth()).toBe(9);
    expect(at.getDate()).toBe(1);
    expect(at.getHours()).toBe(MORNING_HOUR);
  });

  it('crosses the end of a year', () => {
    const at = buildMorningOn(new Date(2026, 11, 31, 14, 0), 1);

    expect(at.getFullYear()).toBe(2027);
    expect(at.getMonth()).toBe(0);
    expect(at.getDate()).toBe(1);
  });
});

describe('Monday morning', () => {
  it('is next Monday when today is Monday', () => {
    // The case a naive calculation gets wrong: it would offer a moment that
    // has already passed.
    const at = buildNextMondayMorning(monday(10, 0));

    expect(at.getDay()).toBe(1);
    expect(at.getDate()).toBe(14);
    expect(at.getTime()).toBeGreaterThan(monday(10, 0).getTime());
  });

  it('is tomorrow when today is Sunday', () => {
    const sunday = new Date(2026, 8, 6, 15, 0);
    const at = buildNextMondayMorning(sunday);

    expect(at.getDay()).toBe(1);
    expect(at.getDate()).toBe(7);
  });

  it('is always a Monday, whatever day it is asked on', () => {
    for (let day = 0; day < 7; day += 1) {
      const from = new Date(2026, 8, 6 + day, 12, 0);
      const at = buildNextMondayMorning(from);

      expect(at.getDay()).toBe(1);
      expect(at.getHours()).toBe(MORNING_HOUR);
      expect(at.getTime()).toBeGreaterThan(from.getTime());
    }
  });
});

describe('the one-tap choices', () => {
  it('offers all three in the morning', () => {
    const options = buildScheduleQuickOptions(monday(10, 0));

    expect(options.map((option) => option.id)).toEqual([
      'later-today',
      'tomorrow-morning',
      'monday-morning'
    ]);
  });

  it('drops "later today" once it is too late for it', () => {
    const options = buildScheduleQuickOptions(monday(22, 0));

    expect(options.map((option) => option.id)).toEqual(['tomorrow-morning', 'monday-morning']);
  });

  it('never offers the same moment twice', () => {
    // On a Sunday, tomorrow morning and Monday morning are the same thing.
    const sunday = new Date(2026, 8, 6, 10, 0);
    const options = buildScheduleQuickOptions(sunday);
    const times = options.map((option) => option.at.getTime());

    expect(times.length).toBe(new Set(times).size);
    expect(options.map((option) => option.id)).not.toContain('monday-morning');
  });

  it('is never empty, whatever hour it is', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const options = buildScheduleQuickOptions(monday(hour, 30));

      expect(options.length).toBeGreaterThan(0);
    }
  });

  it('only ever offers times that are still ahead', () => {
    for (let day = 0; day < 7; day += 1) {
      for (const hour of [0, 8, 14, 20, 23]) {
        const now = new Date(2026, 8, 6 + day, hour, 30);

        for (const option of buildScheduleQuickOptions(now)) {
          expect(option.at.getTime()).toBeGreaterThan(now.getTime());
        }
      }
    }
  });

  it('says what each one means without needing the date read', () => {
    for (const option of buildScheduleQuickOptions(monday(10, 0))) {
      expect(option.label).toMatch(/^(Later today|Tomorrow|Monday), /);
    }
  });
});

describe('writing a scheduled time out', () => {
  it('names today rather than dating it', () => {
    expect(formatScheduledTime(monday(17, 0), monday(10, 0))).toMatch(/^Today at /);
  });

  it('names tomorrow rather than dating it', () => {
    expect(formatScheduledTime(new Date(2026, 8, 8, 9, 0), monday(10, 0))).toMatch(/^Tomorrow at /);
  });

  it('dates anything further out', () => {
    const text = formatScheduledTime(new Date(2026, 8, 14, 9, 0), monday(10, 0));

    expect(text).not.toMatch(/^(Today|Tomorrow)/);
    expect(text).toMatch(/ at /);
  });

  it('says the year when it is a different one', () => {
    expect(formatScheduledTime(new Date(2027, 0, 4, 9, 0), monday(10, 0))).toMatch(/2027/);
  });
});
