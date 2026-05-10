import type { TaskDependencies, TaskDependencyRef } from '../types';
import { http } from './client';

export const dependenciesApi = {
  list: (taskId: string) => http.get<TaskDependencies>(`/tasks/${taskId}/dependencies`),
  create: (taskId: string, dependsOnTaskId: string) =>
    http.post<TaskDependencyRef>(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }),
  remove: (taskId: string, dependsOnTaskId: string) =>
    http.delete(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`),
};
