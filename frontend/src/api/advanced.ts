import type {
  ApprovalEntityType,
  ApprovalRequest,
  ApprovalStatus,
  BudgetEntry,
  BudgetKind,
  BudgetRollup,
  Portfolio,
  PortfolioRollup,
  Project,
  ProjectTemplate,
  RecurringFrequency,
  RecurringTaskRule,
  TaskDependencyBlocker,
  TaskDependencyGraph,
  TimeEntry,
  TimeRollup,
} from '../types';
import { http } from './client';

export const portfoliosApi = {
  list: () => http.get<Portfolio[]>('/portfolios'),
  get: (id: string) =>
    http.get<Portfolio & { projects: Project[] }>(`/portfolios/${id}`),
  rollup: (id: string) => http.get<PortfolioRollup>(`/portfolios/${id}/rollup`),
  create: (input: { name: string; description?: string | null }) =>
    http.post<Portfolio>('/portfolios', input),
  update: (id: string, input: Partial<{ name: string; description: string | null }>) =>
    http.patch<Portfolio>(`/portfolios/${id}`, input),
  remove: (id: string) => http.delete(`/portfolios/${id}`),
};

export const templatesApi = {
  list: () => http.get<ProjectTemplate[]>('/templates'),
  get: (id: string) => http.get<ProjectTemplate>(`/templates/${id}`),
  fromProject: (input: { projectId: string; name: string; description?: string | null }) =>
    http.post<ProjectTemplate>('/templates/from-project', input),
  instantiate: (id: string, overrides: { name?: string; department?: string | null } = {}) =>
    http.post<Project>(`/templates/${id}/instantiate`, overrides),
  remove: (id: string) => http.delete(`/templates/${id}`),
};

export const recurringApi = {
  list: (filters: { projectId?: string } = {}) => {
    const qs = filters.projectId ? `?projectId=${encodeURIComponent(filters.projectId)}` : '';
    return http.get<RecurringTaskRule[]>(`/recurring${qs}`);
  },
  create: (input: {
    name: string;
    projectId?: string | null;
    templateTitle: string;
    templateDesc?: string | null;
    templatePriority?: string;
    assignedToId?: string | null;
    frequency: RecurringFrequency;
    nextRunAt: string;
  }) => http.post<RecurringTaskRule>('/recurring', input),
  update: (id: string, input: Partial<RecurringTaskRule>) =>
    http.patch<RecurringTaskRule>(`/recurring/${id}`, input),
  remove: (id: string) => http.delete(`/recurring/${id}`),
  runDue: () =>
    http.post<{ ranRules: number; createdTaskIds: string[] }>('/recurring/run-due', {}),
};

export const dependenciesApi = {
  list: (taskId: string) =>
    http.get<TaskDependencyGraph>(`/tasks/${taskId}/dependencies`),
  add: (taskId: string, blockerTaskId: string) =>
    http.post<TaskDependencyBlocker>(`/tasks/${taskId}/dependencies`, { blockerTaskId }),
  remove: (taskId: string, blockerTaskId: string) =>
    http.delete(`/tasks/${taskId}/dependencies/${blockerTaskId}`),
};

export const budgetApi = {
  list: (projectId: string) => http.get<BudgetEntry[]>(`/projects/${projectId}/budget`),
  rollup: (projectId: string) =>
    http.get<BudgetRollup>(`/projects/${projectId}/budget/rollup`),
  add: (
    projectId: string,
    input: { kind: BudgetKind; amount: number; description?: string | null; occurredAt?: string },
  ) => http.post<BudgetEntry>(`/projects/${projectId}/budget`, input),
  remove: (projectId: string, entryId: string) =>
    http.delete(`/projects/${projectId}/budget/${entryId}`),
};

export const timeApi = {
  forTask: (taskId: string) => http.get<TimeEntry[]>(`/tasks/${taskId}/time`),
  taskRollup: (taskId: string) => http.get<TimeRollup>(`/tasks/${taskId}/time/rollup`),
  projectRollup: (projectId: string) =>
    http.get<TimeRollup>(`/projects/${projectId}/time/rollup`),
  add: (taskId: string, input: { minutes: number; notes?: string | null; occurredAt?: string }) =>
    http.post<TimeEntry>(`/tasks/${taskId}/time`, input),
  remove: (taskId: string, entryId: string) =>
    http.delete(`/tasks/${taskId}/time/${entryId}`),
  mine: () => http.get<TimeEntry[]>('/time/me'),
};

export const approvalsApi = {
  list: (filters: { status?: ApprovalStatus; entityType?: string; entityId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.entityId) params.set('entityId', filters.entityId);
    const qs = params.toString();
    return http.get<ApprovalRequest[]>(`/approvals${qs ? `?${qs}` : ''}`);
  },
  request: (input: {
    entityType: ApprovalEntityType;
    entityId: string;
    reason?: string | null;
    targetStatus?: string | null;
  }) => http.post<ApprovalRequest>('/approvals', input),
  approve: (id: string, note?: string) =>
    http.post<ApprovalRequest>(`/approvals/${id}/approve`, { note }),
  reject: (id: string, note?: string) =>
    http.post<ApprovalRequest>(`/approvals/${id}/reject`, { note }),
  cancel: (id: string) => http.post<ApprovalRequest>(`/approvals/${id}/cancel`, {}),
};

export interface DepartmentBoard {
  department: string;
  projects: Array<Project & { _count?: { tasks: number } }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    project: { id: string; name: string } | null;
    assignedTo: { id: string; displayName: string; email: string } | null;
  }>;
  counts: { projects: number; tasks: number; byStatus: Record<string, number> };
}

export const departmentApi = {
  board: (name: string) =>
    http.get<DepartmentBoard>(`/dashboard/department/${encodeURIComponent(name)}`),
};
