import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { attachmentsApi, type AttachmentRecord } from '../api/attachments';
import { http } from '../api/client';
import { dependenciesApi, type TaskDependencies } from '../api/dependencies';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import { RecurrencePicker, describeRecurrence } from '../components/RecurrencePicker';
import { StatusBadge } from '../components/StatusBadge';
import type { Comment, Task, TaskStatus } from '../types';
import { formatDate } from '../utils/format';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependencies>({
    dependsOn: [],
    blocks: [],
  });
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([
      tasksApi.get(id),
      http.get<Comment[]>(`/tasks/${id}/comments`),
      attachmentsApi.listForTask(id).catch(() => [] as AttachmentRecord[]),
      dependenciesApi
        .listForTask(id)
        .catch(() => ({ dependsOn: [], blocks: [] }) as TaskDependencies),
    ])
      .then(([t, c, atts, deps]) => {
        setTask(t);
        setComments(c);
        setAttachments(atts);
        setDependencies(deps);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!id || !file) return;
    setUploading(true);
    try {
      await attachmentsApi.uploadToTask(id, file);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!window.confirm('Delete this attachment?')) return;
    await attachmentsApi.remove(attachmentId);
    reload();
  }

  async function addDependency(dependsOnTaskId: string) {
    if (!id) return;
    try {
      await dependenciesApi.add(id, dependsOnTaskId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dependency');
    }
  }

  async function removeDependency(depId: string) {
    await dependenciesApi.remove(depId);
    reload();
  }

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

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              Repeats
            </div>
            <div style={{ fontSize: 14, marginTop: 2 }}>
              {describeRecurrence(task.recurrence)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              When this task is marked done, the next occurrence is created automatically.
            </div>
          </div>
          <RecurrencePicker
            value={task.recurrence ?? null}
            onChange={async (next) => {
              if (!id) return;
              const updated = await tasksApi.update(id, { recurrence: next });
              setTask((prev) => (prev ? { ...prev, ...updated } : prev));
            }}
          />
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
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Attachments</h2>
        {attachments.length === 0 ? (
          <div className="muted">No attachments yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded by</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((att) => (
                <tr key={att.id}>
                  <td>
                    <a href={attachmentsApi.downloadUrl(att.id)} target="_blank" rel="noreferrer">
                      {att.fileName}
                    </a>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {att.mimeType}
                    </div>
                  </td>
                  <td className="muted">{formatBytes(att.fileSize)}</td>
                  <td className="muted">{att.uploadedBy?.displayName ?? '—'}</td>
                  <td className="muted">{formatDate(att.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => removeAttachment(att.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              onChange={onFileChosen}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Dependencies</h2>
        <div className="ai-grid">
          <div>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              This task depends on
            </div>
            {dependencies.dependsOn.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                None.
              </div>
            ) : (
              <ul className="ai-bullets">
                {dependencies.dependsOn.map((edge) => (
                  <li key={edge.id}>
                    <Link to={`/tasks/${edge.dependsOnTask.id}`}>{edge.dependsOnTask.title}</Link>{' '}
                    <StatusBadge status={edge.dependsOnTask.status} />{' '}
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => removeDependency(edge.id)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
              Blocks
            </div>
            {dependencies.blocks.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                None.
              </div>
            ) : (
              <ul className="ai-bullets">
                {dependencies.blocks.map((edge) => (
                  <li key={edge.id}>
                    <Link to={`/tasks/${edge.task.id}`}>{edge.task.title}</Link>{' '}
                    <StatusBadge status={edge.task.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DependencyPicker projectId={task.projectId} currentTaskId={task.id} onAdd={addDependency} />
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

function DependencyPicker({
  projectId,
  currentTaskId,
  onAdd,
}: {
  projectId: string | null;
  currentTaskId: string;
  onAdd: (taskId: string) => Promise<void>;
}) {
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    tasksApi
      .list(projectId ? { projectId } : {})
      .then((tasks) => setCandidates(tasks.filter((t) => t.id !== currentTaskId)))
      .catch(() => setCandidates([]));
  }, [projectId, currentTaskId]);

  return (
    <div className="row" style={{ marginTop: 12, gap: 8 }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ maxWidth: 360 }}
      >
        <option value="">Add a dependency on…</option>
        {candidates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        disabled={!selected}
        onClick={async () => {
          await onAdd(selected);
          setSelected('');
        }}
      >
        Add
      </button>
    </div>
  );
}
