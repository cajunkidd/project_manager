import type { Task, TaskStatus } from '../types';
import { http } from './client';

export interface TaskListFilters {
  status?: string;
  assignedToId?: string;
  priority?: string;
  projectId?: string;
  search?: string;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&')}`;
}

export const tasksApi = {
  list: (filters: TaskListFilters = {}) =>
    http.get<Task[]>(`/tasks${qs(filters as Record<string, string | undefined>)}`),
  get: (id: string) => http.get<Task>(`/tasks/${id}`),
  create: (input: Partial<Task>) => http.post<Task>('/tasks', input),
  update: (id: string, input: Partial<Task>) => http.patch<Task>(`/tasks/${id}`, input),
  updateStatus: (id: string, status: TaskStatus) =>
    http.patch<Task>(`/tasks/${id}/status`, { status }),
  reorder: (items: { id: string; status: TaskStatus; sortOrder: number }[]) =>
    http.patch<{ updated: number }>('/tasks/reorder', { items }),
  bulkUpdate: (ids: string[], patch: Partial<Task>) =>
    http.patch<{ updated: number; ids: string[]; failed: { id: string; reason: string }[] }>(
      '/tasks/bulk',
      { ids, patch },
    ),
  bulkRemove: (ids: string[]) =>
    http.post<{ removed: number; ids: string[]; failed: { id: string; reason: string }[] }>(
      '/tasks/bulk-delete',
      { ids },
    ),
  remove: (id: string) => http.delete(`/tasks/${id}`),
};
