import type { Project } from '../types';
import { http } from './client';

export interface TemplateTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueOffsetDays: number;
  sortOrder: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  defaultPriority: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tasks: TemplateTask[];
  createdBy?: { id: string; displayName: string; email: string } | null;
}

export interface TemplateTaskInput {
  title: string;
  description?: string | null;
  priority?: string;
  dueOffsetDays?: number;
  sortOrder?: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  defaultPriority?: string;
  department?: string | null;
  tasks?: TemplateTaskInput[];
}

export interface InstantiateInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
  startDate?: string | null;
}

export const projectTemplatesApi = {
  list: () => http.get<ProjectTemplate[]>('/project-templates'),
  get: (id: string) => http.get<ProjectTemplate>(`/project-templates/${id}`),
  create: (input: CreateTemplateInput) =>
    http.post<ProjectTemplate>('/project-templates', input),
  update: (id: string, input: Partial<CreateTemplateInput> & { isActive?: boolean }) =>
    http.patch<ProjectTemplate>(`/project-templates/${id}`, input),
  remove: (id: string) => http.delete(`/project-templates/${id}`),
  instantiate: (id: string, input: InstantiateInput) =>
    http.post<{ project: Project; taskCount: number }>(
      `/project-templates/${id}/instantiate`,
      input,
    ),
};
