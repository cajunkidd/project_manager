import type { FormSubmission, IntakeForm } from '../types';
import { http } from './client';

export interface FormFieldInput {
  id?: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'user';
  isRequired?: boolean;
  options?: string[] | null;
  sortOrder?: number;
}

export interface CreateFormInput {
  name: string;
  description?: string | null;
  defaultProjectId?: string | null;
  defaultAssigneeId?: string | null;
  defaultPriority?: 'low' | 'normal' | 'high' | 'urgent';
  isActive?: boolean;
  fields: FormFieldInput[];
}

export const formsApi = {
  list: (opts: { onlyActive?: boolean } = {}) =>
    http.get<IntakeForm[]>(`/forms${opts.onlyActive ? '?active=true' : ''}`),
  get: (id: string) => http.get<IntakeForm>(`/forms/${id}`),
  create: (input: CreateFormInput) => http.post<IntakeForm>('/forms', input),
  update: (id: string, input: Partial<CreateFormInput>) => http.patch<IntakeForm>(`/forms/${id}`, input),
  remove: (id: string) => http.delete(`/forms/${id}`),
  submit: (id: string, responseData: Record<string, unknown>) =>
    http.post<{ submission: FormSubmission; task: { id: string; title: string } }>(
      `/forms/${id}/submit`,
      { responseData },
    ),
  submissions: (opts: { mine?: boolean; formId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.mine) qs.set('mine', 'true');
    if (opts.formId) qs.set('formId', opts.formId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return http.get<FormSubmission[]>(`/forms/submissions${suffix}`);
  },
};
