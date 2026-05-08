import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import type { Notification } from '../types';

interface NotificationsState {
  unreadCount: number;
  recent: Notification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | undefined>(undefined);

const POLL_INTERVAL_MS = 30_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setRecent([]);
      return;
    }
    const [list, count] = await Promise.all([
      notificationsApi.list(),
      notificationsApi.unreadCount(),
    ]);
    setRecent(list);
    setUnreadCount(count.count);
  }, [user]);

  useEffect(() => {
    refresh().catch(() => undefined);
    if (!user) return;
    const id = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh, user]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationsApi.markRead(id);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ unreadCount, recent, refresh, markRead, markAllRead }),
    [unreadCount, recent, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
