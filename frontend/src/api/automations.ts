import type { AutomationAction, AutomationCondition, AutomationRule, AutomationTrigger } from '../types';
import { http } from './client';

export interface CreateAutomationInput {
  name: string;
  triggerType: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  isActive?: boolean;
}

export const automationsApi = {
  list: () => http.get<AutomationRule[]>('/automations'),
  get: (id: string) => http.get<AutomationRule>(`/automations/${id}`),
  create: (input: CreateAutomationInput) => http.post<AutomationRule>('/automations', input),
  update: (id: string, input: Partial<CreateAutomationInput>) =>
    http.patch<AutomationRule>(`/automations/${id}`, input),
  remove: (id: string) => http.delete(`/automations/${id}`),
};
