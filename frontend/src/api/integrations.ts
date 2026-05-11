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

export type ExternalSystemKind =
  | 'teams'
  | 'outlook'
  | 'erp'
  | 'asset'
  | 'intranet'
  | 'monday'
  | 'other';

export interface ExternalSystem {
  id: string;
  name: string;
  kind: ExternalSystemKind;
  config: Record<string, unknown>;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalLink {
  id: string;
  systemId: string | null;
  entityType: 'task' | 'project';
  entityId: string;
  externalId: string | null;
  url: string | null;
  label: string | null;
  createdAt: string;
  system?: { id: string; name: string; kind: string } | null;
}

export const externalSystemsApi = {
  list: () => http.get<ExternalSystem[]>('/integrations/systems'),
  create: (input: {
    name: string;
    kind: ExternalSystemKind;
    config: Record<string, unknown>;
    events?: string[];
    isActive?: boolean;
  }) => http.post<ExternalSystem>('/integrations/systems', input),
  update: (
    id: string,
    input: Partial<{
      name: string;
      kind: ExternalSystemKind;
      config: Record<string, unknown>;
      events: string[];
      isActive: boolean;
    }>,
  ) => http.patch<ExternalSystem>(`/integrations/systems/${id}`, input),
  remove: (id: string) => http.delete(`/integrations/systems/${id}`),
};

export const externalLinksApi = {
  list: (entityType: 'task' | 'project', entityId: string) =>
    http.get<ExternalLink[]>(`/integrations/links/${entityType}/${entityId}`),
  create: (input: {
    systemId?: string | null;
    entityType: 'task' | 'project';
    entityId: string;
    externalId?: string | null;
    url?: string | null;
    label?: string | null;
  }) => http.post<ExternalLink>('/integrations/links', input),
  remove: (id: string) => http.delete(`/integrations/links/${id}`),
};

export interface MondayImportSummary {
  projectsCreated: number;
  tasksCreated: number;
  usersCreated: number;
  usersMatched: number;
  unmappedAssignees: string[];
  projectIds: string[];
  taskIds: string[];
}

export const mondayApi = {
  import: (payload: unknown) =>
    http.post<MondayImportSummary>('/integrations/monday/import', payload),
  jobs: () =>
    http.get<
      Array<{
        id: string;
        source: string;
        status: string;
        summary: string | null;
        createdAt: string;
        completedAt: string | null;
      }>
    >('/integrations/monday/jobs'),
};

export const outlookApi = {
  myCalendarUrl: () =>
    http.get<{ url: string; token: string }>('/integrations/outlook/me/calendar-url'),
};

export interface GmailStatus {
  connected: boolean;
  email?: string;
  labelName?: string;
  lastPolledAt?: string | null;
  lastError?: string | null;
  isActive?: boolean;
}

export const gmailApi = {
  status: () => http.get<GmailStatus>('/integrations/gmail/status'),
  startOAuth: () => http.get<{ authorizeUrl: string }>('/integrations/gmail/oauth/start'),
  setLabel: (labelName: string) =>
    http.patch<{ labelName: string }>('/integrations/gmail/label', { labelName }),
  disconnect: () => http.delete('/integrations/gmail/connection'),
  pollNow: () =>
    http.post<{ processed: number; taskIds: string[]; error?: string }>(
      '/integrations/gmail/poll',
      {},
    ),
};
