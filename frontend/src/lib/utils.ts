import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(dueDate: string | Date | null | undefined, status: string): boolean {
  if (!dueDate || ['done', 'cancelled'].includes(status)) return false;
  return new Date(dueDate) < new Date();
}

export const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-slate-100 text-slate-700',
  to_do: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  waiting: 'bg-orange-100 text-orange-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  not_started: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog', to_do: 'To Do', in_progress: 'In Progress',
  waiting: 'Waiting', review: 'Review', done: 'Done', cancelled: 'Cancelled',
  not_started: 'Not Started', active: 'Active', on_hold: 'On Hold',
  completed: 'Completed',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
};

export const TASK_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review', 'done', 'cancelled'];
export const PROJECT_STATUSES = ['not_started', 'active', 'on_hold', 'completed', 'cancelled'];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
