import { http } from './client';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  taskId: string;
  requestedById: string;
  approverId: string;
  status: ApprovalStatus;
  requestComment: string | null;
  decisionComment: string | null;
  requestedAt: string;
  decidedAt: string | null;
  task?: { id: string; title: string; projectId: string | null };
  requestedBy?: { id: string; displayName: string; email: string };
  approver?: { id: string; displayName: string; email: string };
}

export interface RequestApprovalInput {
  approverId: string;
  requestComment?: string | null;
}

export interface DecisionInput {
  status: 'approved' | 'rejected';
  decisionComment?: string | null;
}

export const approvalsApi = {
  listForTask: (taskId: string) => http.get<Approval[]>(`/tasks/${taskId}/approvals`),
  request: (taskId: string, input: RequestApprovalInput) =>
    http.post<Approval>(`/tasks/${taskId}/approvals`, input),
  list: (opts: { mine?: boolean; status?: ApprovalStatus } = {}) => {
    const params = new URLSearchParams();
    if (opts.mine) params.set('mine', 'true');
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    return http.get<Approval[]>(`/approvals${qs ? `?${qs}` : ''}`);
  },
  decide: (id: string, input: DecisionInput) => http.patch<Approval>(`/approvals/${id}`, input),
  cancel: (id: string) => http.delete(`/approvals/${id}`),
};
