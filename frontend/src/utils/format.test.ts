import { describe, expect, it } from 'vitest';
import {
  formatDate,
  isOverdue,
  priorityLabel,
  projectStatusLabel,
  taskStatusLabel,
} from './format';

describe('label helpers', () => {
  it('maps known project statuses', () => {
    expect(projectStatusLabel('not_started')).toBe('Not Started');
    expect(projectStatusLabel('on_hold')).toBe('On Hold');
  });

  it('maps known task statuses', () => {
    expect(taskStatusLabel('in_progress')).toBe('In Progress');
    expect(taskStatusLabel('to_do')).toBe('To Do');
  });

  it('maps known priorities', () => {
    expect(priorityLabel('urgent')).toBe('Urgent');
  });

  it('falls back to raw value for unknown labels', () => {
    expect(taskStatusLabel('archived')).toBe('archived');
    expect(priorityLabel('critical')).toBe('critical');
  });
});

describe('isOverdue', () => {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  it('returns false when there is no due date', () => {
    expect(isOverdue(null, 'to_do')).toBe(false);
  });

  it('returns true when due date has passed and task is open', () => {
    expect(isOverdue(yesterday, 'to_do')).toBe(true);
  });

  it('returns false for done tasks even if past due', () => {
    expect(isOverdue(yesterday, 'done')).toBe(false);
  });

  it('returns false for cancelled tasks', () => {
    expect(isOverdue(yesterday, 'cancelled')).toBe(false);
  });

  it('returns false when due date is in the future', () => {
    expect(isOverdue(tomorrow, 'to_do')).toBe(false);
  });
});

describe('formatDate', () => {
  it('returns a dash for null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns a dash for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('returns a localized date for valid ISO input', () => {
    expect(formatDate('2026-05-08T00:00:00Z')).not.toBe('—');
  });
});
