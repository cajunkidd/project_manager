import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/client';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useLiveUpdates } from '../realtime/RealtimeContext';
import type { Comment, Task, TaskStatus } from '../types';
import { formatDate } from '../utils/format';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([
      tasksApi.get(id),
      http.get<Comment[]>(`/tasks/${id}/comments`),
    ])
      .then(([t, c]) => {
        setTask(t);
        setComments(c);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useLiveUpdates(
    () => reload(),
    {
      types: ['task.updated', 'task.status_changed', 'comment.created'],
      filter: (ev) => {
        const data = ev.data as { taskId?: string };
        return data.taskId === id;
      },
    },
  );

  async function changeStatus(status: TaskStatus) {
    if (!id) return;
    const updated = await tasksApi.updateStatus(id, status);
    setTask(updated);
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
      </div>

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
