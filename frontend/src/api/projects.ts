import type { Project, Task } from '../types';
import { http } from './client';

export interface ProjectListFilters {
  status?: string;
  ownerId?: string;
  department?: string;
  priority?: string;
  search?: string;
  isTemplate?: 'true' | 'false';
}

export interface CloneProjectInput {
  name?: string;
  ownerId?: string | null;
  department?: string | null;
  isTemplate?: boolean;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join('&')}`;
}

export const projectsApi = {
  list: (filters: ProjectListFilters = {}) =>
    http.get<Project[]>(`/projects${qs(filters as Record<string, string | undefined>)}`),
  get: (id: string) => http.get<Project>(`/projects/${id}`),
  tasks: (id: string) => http.get<Task[]>(`/projects/${id}/tasks`),
  create: (input: Partial<Project>) => http.post<Project>('/projects', input),
  update: (id: string, input: Partial<Project>) => http.patch<Project>(`/projects/${id}`, input),
  remove: (id: string) => http.delete(`/projects/${id}`),
  clone: (id: string, input: CloneProjectInput = {}) =>
    http.post<Project>(`/projects/${id}/clone`, input),
};
