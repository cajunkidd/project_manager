import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '../api/tasks';
import { useAuth } from '../auth/AuthContext';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { Task, TaskStatus } from '../types';
import { formatDate, isOverdue } from '../utils/format';
import { usePolling } from '../utils/usePolling';

export function MyTasksPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, error, refresh } = usePolling<Task[]>(
    () =>
      user
        ? tasksApi.list({
            assignedToId: user.id,
            search: search || undefined,
            status: statusFilter || undefined,
          })
        : Promise.resolve([]),
    [user?.id, search, statusFilter],
    { enabled: Boolean(user) },
  );
  const tasks = data ?? [];

  async function quickStatus(id: string, status: TaskStatus) {
    await tasksApi.updateStatus(id, status);
    await refresh();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>My Tasks</h1>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All statuses</option>
            <option value="backlog">Backlog</option>
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
        {error ? <div className="error">{error.message}</div> : null}
        {tasks.length === 0 ? (
          <div className="muted">No tasks match.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Quick action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  </td>
                  <td className="muted">{t.project?.name ?? '—'}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td>
                    {isOverdue(t.dueDate, t.status) ? (
                      <span className="badge overdue">{formatDate(t.dueDate)}</span>
                    ) : (
                      formatDate(t.dueDate)
                    )}
                  </td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => quickStatus(t.id, e.target.value as TaskStatus)}
                      style={{ maxWidth: 160 }}
                    >
                      <option value="backlog">Backlog</option>
                      <option value="to_do">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting">Waiting</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
