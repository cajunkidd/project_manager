import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600')}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-600')}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
