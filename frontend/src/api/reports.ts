import type { Task } from '../types';
import { http } from './client';

export interface ReportFilters {
  from?: string;
  to?: string;
  department?: string;
  projectId?: string;
  userId?: string;
  priority?: string;
}

export interface UserSummary {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
}

export interface OpenByUserRow {
  user: UserSummary;
  count: number;
}

export interface ProjectsByStatusRow {
  status: string;
  count: number;
}

export interface CompletionByWeekRow {
  weekStart: string;
  count: number;
}

export interface AvgCompletion {
  sampleSize: number;
  avgHours: number;
  avgDays: number;
}

function qs(filters: ReportFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const reportsApi = {
  openByUser: (filters: ReportFilters = {}) =>
    http.get<OpenByUserRow[]>(`/reports/tasks-by-user${qs(filters)}`),
  overdue: (filters: ReportFilters = {}) => http.get<Task[]>(`/reports/overdue${qs(filters)}`),
  projectsByStatus: (filters: ReportFilters = {}) =>
    http.get<ProjectsByStatusRow[]>(`/reports/projects-by-status${qs(filters)}`),
  completionByWeek: (filters: ReportFilters = {}) =>
    http.get<CompletionByWeekRow[]>(`/reports/completion-by-week${qs(filters)}`),
  avgCompletion: (filters: ReportFilters = {}) =>
    http.get<AvgCompletion>(`/reports/avg-completion${qs(filters)}`),
  blocked: (filters: ReportFilters = {}) => http.get<Task[]>(`/reports/blocked${qs(filters)}`),
};
