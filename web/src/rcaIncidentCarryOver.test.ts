import { describe, expect, it } from 'vitest';

import { combineIncidentDateAndTime, isUnwrittenField } from './rcaIncidentCarryOver';

describe('carrying the incident date across', () => {
  it('joins the date and time the way a datetime field expects', () => {
    expect(combineIncidentDateAndTime('2026-09-13', '14:05')).toBe('2026-09-13T14:05');
  });

  it('uses midnight when the incident recorded a day but no time', () => {
    expect(combineIncidentDateAndTime('2026-09-13', '')).toBe('2026-09-13T00:00');
    expect(combineIncidentDateAndTime('2026-09-13', undefined)).toBe('2026-09-13T00:00');
  });

  it('drops seconds, which a datetime field does not show', () => {
    expect(combineIncidentDateAndTime('2026-09-13', '14:05:32')).toBe('2026-09-13T14:05');
  });

  it('carries nothing when there is no usable date', () => {
    // A time with no date cannot be placed on the calendar, and assuming today
    // would record the incident on the wrong day.
    expect(combineIncidentDateAndTime('', '14:05')).toBeNull();
    expect(combineIncidentDateAndTime(undefined, '14:05')).toBeNull();
    expect(combineIncidentDateAndTime('13/09/2026', '14:05')).toBeNull();
    expect(combineIncidentDateAndTime('2026-09', '14:05')).toBeNull();
  });

  it('ignores a time it cannot read, rather than producing a broken value', () => {
    expect(combineIncidentDateAndTime('2026-09-13', 'half past two')).toBe('2026-09-13T00:00');
  });
});

describe('deciding whether somebody has written in a field', () => {
  it('treats empty as unwritten', () => {
    expect(isUnwrittenField('', [])).toBe(true);
    expect(isUnwrittenField(undefined, [])).toBe(true);
    expect(isUnwrittenField('   ', [])).toBe(true);
  });

  it('treats a default the product put there as unwritten', () => {
    expect(isUnwrittenField('Incident details', ['Incident details'])).toBe(true);
  });

  it('leaves somebody’s own words alone', () => {
    expect(isUnwrittenField('Operator reported smoke', ['Incident details'])).toBe(false);
  });
});
