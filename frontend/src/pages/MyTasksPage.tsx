import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '../api/tasks';
import { useAuth } from '../auth/AuthContext';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { Priority, Task, TaskStatus, User } from '../types';
import { formatDate, isOverdue } from '../utils/format';
import { http } from '../api/client';

export function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    if (!user) return;
    tasksApi
      .list({ assignedToId: user.id, search: search || undefined, status: statusFilter || undefined })
      .then((next) => {
        setTasks(next);
        setSelected((prev) => {
          const valid = new Set(next.map((t) => t.id));
          const filtered = new Set<string>();
          for (const id of prev) if (valid.has(id)) filtered.add(id);
          return filtered;
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, statusFilter]);

  useEffect(() => {
    http.get<User[]>('/users').then(setUsers).catch(() => undefined);
  }, []);

  async function quickStatus(id: string, status: TaskStatus) {
    const updated = await tasksApi.updateStatus(id, status);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  }

  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(tasks.map((t) => t.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkUpdate(patch: Partial<Task>) {
    if (!selectedIds.length) return;
    setBusy(true);
    setError(null);
    try {
      await tasksApi.bulkUpdate(selectedIds, patch);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} task(s)? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await tasksApi.bulkRemove(selectedIds);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setBusy(false);
    }
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
        {error ? <div className="error">{error}</div> : null}

        {selectedIds.length > 0 ? (
          <div className="bulk-bar">
            <strong>{selectedIds.length} selected</strong>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                bulkUpdate({ status: e.target.value as TaskStatus });
                e.target.value = '';
              }}
              disabled={busy}
            >
              <option value="">Set status…</option>
              <option value="backlog">Backlog</option>
              <option value="to_do">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                bulkUpdate({ priority: e.target.value as Priority });
                e.target.value = '';
              }}
              disabled={busy}
            >
              <option value="">Set priority…</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '__none__') {
                  bulkUpdate({ assignedToId: null });
                } else if (e.target.value) {
                  bulkUpdate({ assignedToId: e.target.value });
                }
                e.target.value = '';
              }}
              disabled={busy}
            >
              <option value="">Reassign…</option>
              <option value="__none__">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-danger"
              onClick={bulkDelete}
              disabled={busy}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelected(new Set())}
              disabled={busy}
            >
              Clear
            </button>
          </div>
        ) : null}

        {tasks.length === 0 ? (
          <div className="muted">No tasks match.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    style={{ width: 'auto' }}
                  />
                </th>
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
                <tr key={t.id} className={selected.has(t.id) ? 'row-selected' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      aria-label={`Select ${t.title}`}
                      style={{ width: 'auto' }}
                    />
                  </td>
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
