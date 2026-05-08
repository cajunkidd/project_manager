import { Link } from 'react-router-dom';
import { useNotifications } from '../notifications/NotificationsContext';
import { formatDate } from '../utils/format';

function entityLink(n: { entityType: string | null; entityId: string | null }): string | null {
  if (!n.entityId) return null;
  if (n.entityType === 'task') return `/tasks/${n.entityId}`;
  if (n.entityType === 'project') return `/projects/${n.entityId}`;
  return null;
}

export function NotificationsPage() {
  const { recent, unreadCount, markAllRead, markRead } = useNotifications();

  return (
    <div className="col">
      <div className="page-header">
        <h1>Notifications</h1>
        {unreadCount > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => markAllRead()}>
            Mark all read
          </button>
        ) : null}
      </div>
      <div className="card">
        {recent.length === 0 ? (
          <div className="muted">No notifications.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Type</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((n) => {
                const link = entityLink(n);
                return (
                  <tr key={n.id} style={{ background: n.isRead ? undefined : 'rgba(37,99,235,0.04)' }}>
                    <td>
                      <strong>{n.title}</strong>
                    </td>
                    <td>{n.message}</td>
                    <td className="muted">{n.type}</td>
                    <td className="muted">{formatDate(n.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!n.isRead ? (
                        <button type="button" className="link" onClick={() => markRead(n.id)}>
                          Mark read
                        </button>
                      ) : null}
                      {link ? (
                        <>
                          {' '}
                          <Link to={link}>Open →</Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
