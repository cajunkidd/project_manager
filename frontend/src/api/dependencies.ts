import { http } from './client';

interface TaskRef {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface DependencyEdge {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: string;
}

export interface DependencyEdgeWithTarget extends DependencyEdge {
  dependsOnTask: TaskRef;
}

export interface DependencyEdgeWithSource extends DependencyEdge {
  task: TaskRef;
}

export interface TaskDependencies {
  dependsOn: DependencyEdgeWithTarget[];
  blocks: DependencyEdgeWithSource[];
}

export const dependenciesApi = {
  listForTask: (taskId: string) =>
    http.get<TaskDependencies>(`/tasks/${taskId}/dependencies`),
  add: (taskId: string, dependsOnTaskId: string) =>
    http.post<DependencyEdge>(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }),
  remove: (id: string) => http.delete(`/dependencies/${id}`),
};
