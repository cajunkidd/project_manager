import type {
  ProjectDependencyEdge,
  TaskDependencyEdge,
  TaskDependencyView,
} from '../types';
import { http } from './client';

export const dependenciesApi = {
  listForTask: (taskId: string) =>
    http.get<TaskDependencyView>(`/tasks/${taskId}/dependencies`),
  add: (taskId: string, dependsOnTaskId: string) =>
    http.post<TaskDependencyEdge>(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }),
  remove: (id: string) => http.delete(`/dependencies/${id}`),
  listForProject: (projectId: string) =>
    http.get<ProjectDependencyEdge[]>(`/projects/${projectId}/dependencies`),
};
