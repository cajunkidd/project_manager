import { http } from './client';

export type ApiTokenScope =
  | 'tasks:read'
  | 'tasks:write'
  | 'projects:read'
  | 'projects:write'
  | 'forms:submit';

export interface ApiTokenRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; displayName: string; email: string } | null;
}

export const apiTokensApi = {
  list: () => http.get<ApiTokenRecord[]>('/api-tokens'),
  create: (input: { name: string; scopes: ApiTokenScope[] }) =>
    http.post<{ token: string; record: ApiTokenRecord }>('/api-tokens', input),
  revoke: (id: string) => http.delete(`/api-tokens/${id}`),
};

export type WebhookEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'project.created'
  | 'project.updated'
  | 'comment.created'
  | 'form.submitted';

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deliveryCount?: number;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: 'pending' | 'success' | 'failed';
  statusCode: number | null;
  responseBody: string | null;
  attempts: number;
  createdAt: string;
}

export const webhooksApi = {
  list: () => http.get<WebhookSubscription[]>('/webhooks'),
  get: (id: string) =>
    http.get<WebhookSubscription & { secret: string }>(`/webhooks/${id}`),
  create: (input: { name: string; url: string; events: WebhookEvent[]; isActive?: boolean }) =>
    http.post<WebhookSubscription & { secret: string }>('/webhooks', input),
  update: (id: string, input: { name?: string; url?: string; events?: WebhookEvent[]; isActive?: boolean }) =>
    http.patch<WebhookSubscription>(`/webhooks/${id}`, input),
  remove: (id: string) => http.delete(`/webhooks/${id}`),
  deliveries: (id: string) => http.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
};
