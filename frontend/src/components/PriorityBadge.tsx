import type { ReactElement } from 'react';
import { priorityLabel } from '../utils/format';

export function PriorityBadge({ priority }: { priority: string }): ReactElement {
  return (
    <span className={`badge priority-${priority}`} data-testid="priority-badge">
      {priorityLabel(priority)}
    </span>
  );
}
