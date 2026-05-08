import { describe, expect, it } from 'vitest';
import { describeRecurrence } from './RecurrencePicker';

describe('describeRecurrence', () => {
  it('returns the no-repeat label for null/empty', () => {
    expect(describeRecurrence(null)).toBe("Doesn't repeat");
    expect(describeRecurrence(undefined)).toBe("Doesn't repeat");
  });

  it('formats common interval presets', () => {
    expect(describeRecurrence(JSON.stringify({ type: 'interval', days: 1 }))).toBe('Every day');
    expect(describeRecurrence(JSON.stringify({ type: 'interval', days: 7 }))).toBe('Every week');
    expect(describeRecurrence(JSON.stringify({ type: 'interval', days: 14 }))).toBe('Every 2 weeks');
  });

  it('falls back to "Every N days" for non-preset intervals', () => {
    expect(describeRecurrence(JSON.stringify({ type: 'interval', days: 10 }))).toBe(
      'Every 10 days',
    );
  });

  it('formats weekly rules with sorted day names', () => {
    expect(
      describeRecurrence(JSON.stringify({ type: 'weekly', weekdays: [5, 1, 3] })),
    ).toBe('Weekly · Mon, Wed, Fri');
  });

  it('returns the raw value if parsing fails', () => {
    expect(describeRecurrence('not-json')).toBe('not-json');
  });
});
