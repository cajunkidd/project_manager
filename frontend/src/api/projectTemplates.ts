import type { Project, ProjectTemplate } from '../types';
import { http } from './client';

export interface InstantiateInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
  department?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  startDate: string; // ISO date
}

export const projectTemplatesApi = {
  list: () => http.get<ProjectTemplate[]>('/project-templates'),
  get: (id: string) => http.get<ProjectTemplate>(`/project-templates/${id}`),
  snapshot: (projectId: string, name: string) =>
    http.post<ProjectTemplate>('/project-templates/snapshot', { projectId, name }),
  instantiate: (id: string, input: InstantiateInput) =>
    http.post<Project>(`/project-templates/${id}/instantiate`, input),
  remove: (id: string) => http.delete(`/project-templates/${id}`),
};
