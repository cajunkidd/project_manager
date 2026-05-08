import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  isProjectStatus,
  isTaskStatus,
} from '../src/validators/status';

describe('project status validator', () => {
  it.each(PROJECT_STATUSES)('accepts %s as a valid project status', (status) => {
    expect(isProjectStatus(status)).toBe(true);
  });

  it.each([
    'in_progress',
    'done',
    'NOT_STARTED',
    '',
    null,
    undefined,
    42,
    {},
  ])('rejects invalid project status: %p', (value) => {
    expect(isProjectStatus(value)).toBe(false);
  });
});

describe('task status validator', () => {
  it.each(TASK_STATUSES)('accepts %s as a valid task status', (status) => {
    expect(isTaskStatus(status)).toBe(true);
  });

  it.each(['active', 'on_hold', 'TO_DO', '', null, undefined, 0])(
    'rejects invalid task status: %p',
    (value) => {
      expect(isTaskStatus(value)).toBe(false);
    },
  );
});
