import { http } from './client';

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string; email: string };
  task?: { id: string; title: string; projectId: string | null };
}

export interface CreateTimeEntryInput {
  minutes: number;
  description?: string | null;
  billable?: boolean;
  loggedAt?: string;
}

export type SummaryGroupBy = 'user' | 'project' | 'task' | 'day';

export interface SummaryRow {
  key: string;
  label: string;
  minutes: number;
  billableMinutes: number;
  entries: number;
}

export interface TimeSummary {
  groupBy: SummaryGroupBy;
  rows: SummaryRow[];
  totals: { entries: number; minutes: number; billableMinutes: number };
}

export interface TimeFilters {
  userId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  mine?: boolean;
}

function qs(filters: TimeFilters & { groupBy?: SummaryGroupBy }): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.mine) params.set('mine', 'true');
  if (filters.groupBy) params.set('groupBy', filters.groupBy);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const timeEntriesApi = {
  listForTask: (taskId: string) => http.get<TimeEntry[]>(`/tasks/${taskId}/time-entries`),
  create: (taskId: string, input: CreateTimeEntryInput) =>
    http.post<TimeEntry>(`/tasks/${taskId}/time-entries`, input),
  list: (filters: TimeFilters = {}) => http.get<TimeEntry[]>(`/time-entries${qs(filters)}`),
  summary: (groupBy: SummaryGroupBy, filters: TimeFilters = {}) =>
    http.get<TimeSummary>(`/time-entries/summary${qs({ ...filters, groupBy })}`),
  update: (id: string, input: Partial<CreateTimeEntryInput>) =>
    http.patch<TimeEntry>(`/time-entries/${id}`, input),
  remove: (id: string) => http.delete(`/time-entries/${id}`),
};

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
