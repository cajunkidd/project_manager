import type { Notification } from '../types';
import { http } from './client';

export const notificationsApi = {
  list: (opts: { unreadOnly?: boolean } = {}) =>
    http.get<Notification[]>(`/notifications${opts.unreadOnly ? '?unreadOnly=true' : ''}`),
  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => http.patch<Notification>(`/notifications/${id}/read`, {}),
  markAllRead: () => http.patch<{ updated: number }>('/notifications/read-all', {}),
};
