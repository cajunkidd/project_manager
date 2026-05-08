import { http } from './client';

export interface WorkloadRow {
  user: { id: string; displayName: string; email: string; department: string | null };
  open: number;
  overdue: number;
  urgent: number;
  dueThisWeek: number;
  completedThisWeek: number;
}

export const workloadApi = {
  list: (filters: { department?: string; projectId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.department) params.set('department', filters.department);
    if (filters.projectId) params.set('projectId', filters.projectId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return http.get<WorkloadRow[]>(`/workload${suffix}`);
  },
};
