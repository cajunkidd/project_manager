import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, type UserDashboard } from '../api/dashboard';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useLiveUpdates } from '../realtime/RealtimeContext';
import type { Task } from '../types';
import { formatDate, isOverdue } from '../utils/format';

export function DashboardPage() {
  const [data, setData] = useState<UserDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    dashboardApi.me().then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useLiveUpdates(reload, {
    types: ['task.created', 'task.updated', 'task.status_changed', 'task.assigned'],
  });

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div className="col">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="grid cols-3">
        <div className="stat">
          <div className="label">Open tasks</div>
          <div className="value">{data.counts.open}</div>
        </div>
        <div className="stat">
          <div className="label">Overdue</div>
          <div className="value" style={{ color: data.counts.overdue > 0 ? '#b91c1c' : undefined }}>
            {data.counts.overdue}
          </div>
        </div>
        <div className="stat">
          <div className="label">Due this week</div>
          <div className="value">{data.counts.dueThisWeek}</div>
        </div>
      </div>

      <TaskList title="Overdue" tasks={data.overdue} emptyMessage="Nothing overdue. Nice." />
      <TaskList
        title="Due this week"
        tasks={data.dueThisWeek}
        emptyMessage="Nothing due this week."
      />
      <TaskList
        title="Recently updated"
        tasks={data.recentlyUpdated}
        emptyMessage="No recent updates."
      />
    </div>
  );
}

function TaskList({
  title,
  tasks,
  emptyMessage,
}: {
  title: string;
  tasks: Task[];
  emptyMessage: string;
}) {
  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>{title}</h2>
      {tasks.length === 0 ? (
        <div className="muted">{emptyMessage}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
