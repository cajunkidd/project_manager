import { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/useAuth';
import { notificationsApi } from '@/lib/api';
import type { Notification } from '@/types';
import { formatDate } from '@/lib/utils';

export default function TopNav() {
  const { logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsApi.unreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    const interval = setInterval(() => {
      notificationsApi.unreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const openNotifications = async () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) {
      const data = await notificationsApi.list().catch(() => []);
      setNotifications(data);
    }
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={openNotifications} className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {showNotifications && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-white shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</li>
                ) : (
                  notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`border-b px-4 py-3 text-sm last:border-0 ${n.isRead ? '' : 'bg-blue-50'}`}
                    >
                      <p className="font-medium">{n.title}</p>
                      <p className="text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
