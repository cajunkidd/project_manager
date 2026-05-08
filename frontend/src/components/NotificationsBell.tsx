import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../notifications/NotificationsContext';
import { formatDate } from '../utils/format';

export function NotificationsBell() {
  const { unreadCount, recent, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className="bell-btn"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? <span className="bell-badge">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="bell-menu">
          <div className="bell-menu-header">
            <strong>Notifications</strong>
            {unreadCount > 0 ? (
              <button type="button" className="bell-mark-all" onClick={() => markAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <div className="bell-empty muted">You're all caught up.</div>
          ) : (
            <ul className="bell-list">
              {recent.slice(0, 8).map((n) => (
                <li key={n.id} className={`bell-item${n.isRead ? '' : ' unread'}`}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!n.isRead) await markRead(n.id);
                      setOpen(false);
                      if (n.entityType === 'task' && n.entityId) navigate(`/tasks/${n.entityId}`);
                      else if (n.entityType === 'project' && n.entityId)
                        navigate(`/projects/${n.entityId}`);
                    }}
                  >
                    <div className="bell-title">{n.title}</div>
                    <div className="bell-message">{n.message}</div>
                    <div className="bell-date muted">{formatDate(n.createdAt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="bell-footer">
            <button
              type="button"
              className="link"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              See all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
