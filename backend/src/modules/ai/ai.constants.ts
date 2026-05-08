export const TASK_OPEN_STATUSES = [
  'backlog',
  'to_do',
  'in_progress',
  'waiting',
  'review',
] as const;

export const TASK_BLOCKED_STATUSES = ['waiting'] as const;

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus =
  | 'backlog'
  | 'to_do'
  | 'in_progress'
  | 'waiting'
  | 'review'
  | 'done'
  | 'cancelled';
