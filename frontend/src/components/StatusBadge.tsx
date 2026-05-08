import type { ReactElement } from 'react';
import { projectStatusLabel, taskStatusLabel } from '../utils/format';

const TASK_STATUSES = new Set([
  'backlog',
  'to_do',
  'in_progress',
  'waiting',
  'review',
  'done',
  'cancelled',
]);

export interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  const label = TASK_STATUSES.has(status)
    ? taskStatusLabel(status)
    : projectStatusLabel(status);
  return (
    <span data-testid="status-badge" data-status={status} className={`badge status-${status}`}>
      {label}
    </span>
  );
}
