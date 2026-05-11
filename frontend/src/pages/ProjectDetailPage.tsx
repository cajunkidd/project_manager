import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { aiApi, type ProjectSummary, type RiskScore } from '../api/ai';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { Project, Task, TaskStatus } from '../types';
import { formatDate, isOverdue } from '../utils/format';
import { usePolling } from '../utils/usePolling';

interface ProjectDetailData {
  project: Project;
  tasks: Task[];
  summary: ProjectSummary | null;
  risk: RiskScore | null;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showNewTask, setShowNewTask] = useState(false);

  const { data, error, refresh } = usePolling<ProjectDetailData | null>(
    async () => {
      if (!id) return null;
      const [project, tasks, summary, risk] = await Promise.all([
        projectsApi.get(id),
        projectsApi.tasks(id),
        aiApi.summarizeProject(id).catch(() => null),
        aiApi.scoreProjectRisk(id).catch(() => null),
      ]);
      return { project, tasks, summary, risk };
    },
    [id],
    { enabled: Boolean(id) },
  );

  const project = data?.project ?? null;
  const tasks = data?.tasks ?? [];
  const summary = data?.summary ?? null;
  const risk = data?.risk ?? null;
  const reload = refresh;

  async function quickStatus(taskId: string, status: TaskStatus) {
    await tasksApi.updateStatus(taskId, status);
    await refresh();
  }

  if (error) return <div className="error">{error.message}</div>;
  if (!project) return <div className="muted">Loading…</div>;

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <Link to="/projects" className="muted" style={{ fontSize: 13 }}>
            ← All projects
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>{project.name}</h1>
          {risk ? (
            <div style={{ marginTop: 6 }}>
              <RiskBadge risk={risk} />
            </div>
          ) : null}
        </div>
        <div className="row">
          <Link to={`/board?projectId=${project.id}`} className="btn btn-secondary">
            Open board
          </Link>
          <Link
            to={`/timeline?projectId=${project.id}`}
            className="btn btn-secondary"
          >
            Timeline
          </Link>
          <button className="btn" onClick={() => setShowNewTask((v) => !v)}>
            {showNewTask ? 'Cancel' : 'Add task'}
          </button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="subtle-card">
          <div className="muted">Status</div>
          <StatusBadge status={project.status} />
        </div>
        <div className="subtle-card">
          <div className="muted">Priority</div>
          <PriorityBadge priority={project.priority} />
        </div>
        <div className="subtle-card">
          <div className="muted">Due date</div>
          <div>{formatDate(project.dueDate)}</div>
        </div>
        <div className="subtle-card">
          <div className="muted">Owner</div>
          <div>{project.owner?.displayName ?? '—'}</div>
        </div>
      </div>

      {project.description ? (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Description</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{project.description}</div>
        </div>
      ) : null}

      {summary ? (
        <div className="card ai-card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>AI summary</h2>
          <div className="ai-headline">{summary.headline}</div>
          <div className="ai-grid" style={{ marginTop: 12 }}>
            <SummarySection title="Recommended next steps" items={summary.recommendations} />
            <SummarySection
              title="Overdue"
              items={summary.overdue}
              empty="None overdue."
            />
            <SummarySection
              title="Blockers"
              items={summary.blockers}
              empty="No blockers."
            />
            <SummarySection
              title="Recently completed"
              items={summary.completed}
              empty="No tasks completed yet."
            />
          </div>
        </div>
      ) : null}

      {risk && risk.factors.length > 0 ? (
        <div className="card ai-card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Risk factors</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {risk.explanation}
          </div>
          <ul className="factor-list">
            {risk.factors.map((f) => (
              <li key={f.label}>
                <span className="factor-impact">+{f.impact}</span> · {f.label} — {f.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showNewTask ? (
        <NewTaskForm
          projectId={project.id}
          onCreated={() => {
            setShowNewTask(false);
            reload();
          }}
        />
      ) : null}

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <div className="muted">No tasks yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`}>{t.title}</Link>
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
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="muted">{t.assignedTo?.displayName ?? '—'}</td>
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
    </div>
  );
}

function NewTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await tasksApi.create({ projectId, title });
      setTitle('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card row">
      <input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <button className="btn" type="submit">
        Create
      </button>
      {error ? <div className="error">{error}</div> : null}
    </form>
  );
}

function SummarySection({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty?: string;
}) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.04 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {empty ?? '—'}
        </div>
      ) : (
        <ul className="ai-bullets">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
