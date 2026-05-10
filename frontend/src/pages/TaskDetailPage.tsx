import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, http } from '../api/client';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { Comment, Recurrence, Task, TaskStatus } from '../types';
import { formatDate } from '../utils/format';

const OPEN_STATUSES = new Set<TaskStatus>([
  'backlog',
  'to_do',
  'in_progress',
  'waiting',
  'review',
]);

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [pickerValue, setPickerValue] = useState('');
  const [depError, setDepError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([
      tasksApi.get(id),
      http.get<Comment[]>(`/tasks/${id}/comments`),
      tasksApi.list(),
    ])
      .then(([t, c, tasks]) => {
        setTask(t);
        setComments(c);
        setAllTasks(tasks);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function changeStatus(status: TaskStatus) {
    if (!id) return;
    setStatusError(null);
    try {
      const updated = await tasksApi.updateStatus(id, status);
      setTask((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to update status';
      setStatusError(message);
    }
  }

  const blockingTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (!task) return ids;
    if (task.id) ids.add(task.id);
    for (const d of task.dependencies ?? []) ids.add(d.dependsOnTaskId);
    return ids;
  }, [task]);

  const openBlockers = useMemo(
    () =>
      (task?.dependencies ?? []).filter((d) => OPEN_STATUSES.has(d.dependsOnTask.status)),
    [task],
  );

  async function addDependency(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !pickerValue) return;
    setDepError(null);
    try {
      await tasksApi.addDependency(id, pickerValue);
      setPickerValue('');
      const fresh = await tasksApi.get(id);
      setTask(fresh);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to add dependency';
      setDepError(message);
    }
  }

  async function removeDependency(depId: string) {
    if (!id) return;
    setDepError(null);
    await tasksApi.removeDependency(depId);
    const fresh = await tasksApi.get(id);
    setTask(fresh);
  }

  async function changeRecurrence(value: Recurrence | '') {
    if (!id) return;
    const updated = await tasksApi.update(id, {
      recurrence: value === '' ? null : value,
    } as Partial<Task>);
    setTask((prev) => (prev ? { ...prev, ...updated } : updated));
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !body.trim()) return;
    const created = await http.post<Comment>(`/tasks/${id}/comments`, { body });
    setComments((prev) => [...prev, created]);
    setBody('');
  }

  if (error) return <div className="error">{error}</div>;
  if (!task) return <div className="muted">Loading…</div>;

  return (
    <div className="col">
      <div className="page-header">
        <div>
          {task.project ? (
            <Link to={`/projects/${task.project.id}`} className="muted" style={{ fontSize: 13 }}>
              ← {task.project.name}
            </Link>
          ) : (
            <Link to="/my-tasks" className="muted" style={{ fontSize: 13 }}>
              ← My Tasks
            </Link>
          )}
          <h1 style={{ margin: '4px 0 0' }}>{task.title}</h1>
        </div>
        <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
          <select
            value={task.status}
            onChange={(e) => changeStatus(e.target.value as TaskStatus)}
            style={{ maxWidth: 180 }}
          >
            <option value="backlog">Backlog</option>
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {statusError ? (
            <div className="error" style={{ fontSize: 12 }}>
              {statusError}
            </div>
          ) : null}
        </div>
      </div>

      {openBlockers.length > 0 ? (
        <div
          className="subtle-card"
          role="status"
          style={{ borderLeft: '3px solid #c0392b' }}
        >
          <strong>Blocked by {openBlockers.length} open dependency
            {openBlockers.length === 1 ? '' : 'ies'}</strong>{' '}
          — this task cannot be marked done until all blockers are complete.
        </div>
      ) : null}

      <div className="grid cols-4">
        <div className="subtle-card">
          <div className="muted">Status</div>
          <StatusBadge status={task.status} />
        </div>
        <div className="subtle-card">
          <div className="muted">Priority</div>
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="subtle-card">
          <div className="muted">Due date</div>
          <div>{formatDate(task.dueDate)}</div>
        </div>
        <div className="subtle-card">
          <div className="muted">Assignee</div>
          <div>{task.assignedTo?.displayName ?? '—'}</div>
        </div>
      </div>

      {task.description ? (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Description</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{task.description}</div>
        </div>
      ) : null}

      {task.subtasks && task.subtasks.length > 0 ? (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Subtasks</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <Link to={`/tasks/${s.id}`}>{s.title}</Link>{' '}
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Recurrence</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            aria-label="Recurrence"
            value={task.recurrence ?? ''}
            onChange={(e) => changeRecurrence(e.target.value as Recurrence | '')}
            style={{ maxWidth: 200 }}
          >
            <option value="">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
          {task.recurrence ? (
            <span className="muted" style={{ fontSize: 13 }}>
              A new task will be created automatically when this one is marked done.
            </span>
          ) : null}
        </div>
        {task.recurrenceParentId && task.recurrenceParentId !== task.id ? (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Part of a recurring series. Original task:{' '}
            <Link to={`/tasks/${task.recurrenceParentId}`}>view source</Link>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Depends on</h2>
        {(task.dependencies ?? []).length === 0 ? (
          <div className="muted">No dependencies.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {task.dependencies!.map((d) => (
              <li
                key={d.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
              >
                <Link to={`/tasks/${d.dependsOnTask.id}`}>{d.dependsOnTask.title}</Link>
                <StatusBadge status={d.dependsOnTask.status} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => removeDependency(d.id)}
                  aria-label={`Remove dependency on ${d.dependsOnTask.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={addDependency}
          style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-start' }}
        >
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            aria-label="Choose blocking task"
            style={{ flex: 1, maxWidth: 360 }}
          >
            <option value="">Add a blocker…</option>
            {allTasks
              .filter((t) => !blockingTaskIds.has(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.project ? ` — ${t.project.name}` : ''}
                </option>
              ))}
          </select>
          <button className="btn" type="submit" disabled={!pickerValue}>
            Add
          </button>
        </form>
        {depError ? (
          <div className="error" style={{ marginTop: 8 }}>
            {depError}
          </div>
        ) : null}
        {(task.dependents ?? []).length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>Blocks</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {task.dependents!.map((d) => (
                <li key={d.id}>
                  <Link to={`/tasks/${d.task.id}`}>{d.task.title}</Link>{' '}
                  <StatusBadge status={d.task.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Comments</h2>
        {comments.length === 0 ? (
          <div className="muted">No comments yet.</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {comments.map((c) => (
              <div key={c.id} className="subtle-card">
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {c.user.displayName}{' '}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    · {formatDate(c.createdAt)}
                  </span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.body}</div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addComment} className="col" style={{ marginTop: 12 }}>
          <textarea
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={!body.trim()}>
              Post comment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
