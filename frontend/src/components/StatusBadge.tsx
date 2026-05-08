import type { ReactElement } from 'react';

const LABELS: Record<string, string> = {
  not_started: 'Not Started',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  backlog: 'Backlog',
  to_do: 'To Do',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  review: 'Review',
  done: 'Done',
};

export interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  const label = LABELS[status] ?? status;
  return (
    <span data-testid="status-badge" data-status={status}>
      {label}
    </span>
  );
}
