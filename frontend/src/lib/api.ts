import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateMe: (data: { emailNotifications?: boolean; emailDigest?: boolean; displayName?: string; department?: string }) =>
    api.patch('/auth/me', data).then((r) => r.data),
};

export const emailApi = {
  status: () => api.get('/email/status').then((r) => r.data),
  sendMyDigest: () => api.post('/email/digest/me').then((r) => r.data),
  sendDigestAll: () => api.post('/email/digest/all').then((r) => r.data),
};

export const usersApi = {
  list: (params?: Record<string, string>) => api.get('/users', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data).then((r) => r.data),
  deactivate: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};

export const projectsApi = {
  list: (params?: Record<string, string>) => api.get('/projects', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/projects', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  activity: (id: string) => api.get(`/projects/${id}/activity`).then((r) => r.data),
};

export const tasksApi = {
  list: (params?: Record<string, string>) => api.get('/tasks', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/tasks/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/tasks', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/tasks/${id}`, data).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tasks/${id}/status`, { status }).then((r) => r.data),
  reorder: (tasks: { id: string; sortOrder: number }[]) =>
    api.patch('/tasks/reorder', { tasks }).then((r) => r.data),
  remove: (id: string) => api.delete(`/tasks/${id}`).then((r) => r.data),
};

export const commentsApi = {
  listForTask: (taskId: string) => api.get(`/tasks/${taskId}/comments`).then((r) => r.data),
  addToTask: (taskId: string, body: string) =>
    api.post(`/tasks/${taskId}/comments`, { body }).then((r) => r.data),
  addToProject: (projectId: string, body: string) =>
    api.post(`/projects/${projectId}/comments`, { body }).then((r) => r.data),
  update: (id: string, body: string) => api.patch(`/comments/${id}`, { body }).then((r) => r.data),
  remove: (id: string) => api.delete(`/comments/${id}`).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

export const dashboardApi = {
  me: () => api.get('/dashboard/me').then((r) => r.data),
  manager: () => api.get('/dashboard/manager').then((r) => r.data),
};

export const reportsApi = {
  tasksByUser: (params?: Record<string, string>) =>
    api.get('/reports/tasks-by-user', { params }).then((r) => r.data),
  overdue: (params?: Record<string, string>) =>
    api.get('/reports/overdue', { params }).then((r) => r.data),
  projectsByStatus: (params?: Record<string, string>) =>
    api.get('/reports/projects-by-status', { params }).then((r) => r.data),
  completionTrend: (weeks?: number) =>
    api.get('/reports/completion-trend', { params: weeks ? { weeks: String(weeks) } : {} }).then((r) => r.data),
  blocked: (params?: Record<string, string>) =>
    api.get('/reports/blocked', { params }).then((r) => r.data),
  avgCompletion: (params?: Record<string, string>) =>
    api.get('/reports/avg-completion', { params }).then((r) => r.data),
  workload: (params?: Record<string, string>) =>
    api.get('/reports/workload', { params }).then((r) => r.data),
};

export const formsApi = {
  list: (active?: boolean) =>
    api.get('/forms', { params: active ? { active: 'true' } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/forms/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/forms', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/forms/${id}`, data).then((r) => r.data),
  submit: (id: string, data: any) => api.post(`/forms/${id}/submit`, data).then((r) => r.data),
  submissions: (params?: Record<string, string>) =>
    api.get('/forms/submissions', { params }).then((r) => r.data),
};

export const aiApi = {
  status: () => api.get('/ai/status').then((r) => r.data),
  parseTask: (text: string) => api.post('/ai/parse-task', { text }).then((r) => r.data),
  enhance: (title: string, description: string) =>
    api.post('/ai/enhance', { title, description }).then((r) => r.data.text),
  projectSummary: (id: string) =>
    api.post(`/ai/project-summary/${id}`).then((r) => r.data.summary),
  suggestPriority: (title: string, description: string) =>
    api.post('/ai/suggest-priority', { title, description }).then((r) => r.data),
  projectRisk: (id: string) => api.get(`/ai/project-risk/${id}`).then((r) => r.data),
  listRisks: () => api.get('/ai/risks').then((r) => r.data),
};

export const timeEntriesApi = {
  getForTask: (taskId: string) => api.get(`/tasks/${taskId}/time`).then((r) => r.data),
  create: (taskId: string, data: { minutes: number; notes?: string; loggedAt?: string }) =>
    api.post(`/tasks/${taskId}/time`, data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/time-entries/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/time-entries/${id}`).then((r) => r.data),
  myEntries: (params?: { from?: string; to?: string }) =>
    api.get('/time-entries/my', { params }).then((r) => r.data),
  report: (params?: { userId?: string; from?: string; to?: string }) =>
    api.get('/time-entries/report', { params }).then((r) => r.data),
};

export const dependenciesApi = {
  get: (taskId: string) => api.get(`/tasks/${taskId}/dependencies`).then((r) => r.data),
  add: (taskId: string, dependsOnTaskId: string) =>
    api.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId }).then((r) => r.data),
  remove: (taskId: string, depId: string) =>
    api.delete(`/tasks/${taskId}/dependencies/${depId}`).then((r) => r.data),
};

export const webhooksApi = {
  list: () => api.get('/webhooks').then((r) => r.data),
  create: (data: { name: string; url: string; events: string[] }) =>
    api.post('/webhooks', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/webhooks/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/webhooks/${id}`).then((r) => r.data),
  deliveries: (id: string) => api.get(`/webhooks/${id}/deliveries`).then((r) => r.data),
  redeliver: (deliveryId: string) =>
    api.post(`/webhooks/deliveries/${deliveryId}/redeliver`).then((r) => r.data),
};

export const attachmentsApi = {
  listForTask: (taskId: string) =>
    api.get(`/tasks/${taskId}/attachments`).then((r) => r.data),
  listForProject: (projectId: string) =>
    api.get(`/projects/${projectId}/attachments`).then((r) => r.data),
  uploadToTask: (taskId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tasks/${taskId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  uploadToProject: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/projects/${projectId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  delete: (id: string) => api.delete(`/attachments/${id}`).then((r) => r.data),
};

export const automationsApi = {
  list: () => api.get('/automations').then((r) => r.data),
  get: (id: string) => api.get(`/automations/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/automations', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/automations/${id}`, data).then((r) => r.data),
  toggle: (id: string) => api.patch(`/automations/${id}/toggle`).then((r) => r.data),
  remove: (id: string) => api.delete(`/automations/${id}`).then((r) => r.data),
  runOverdueCheck: () => api.post('/automations/run-overdue-check').then((r) => r.data),
};
