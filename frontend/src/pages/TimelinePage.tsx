import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dependenciesApi } from '../api/dependencies';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { StatusBadge } from '../components/StatusBadge';
import type { Project, Task } from '../types';
import { formatDate, isOverdue } from '../utils/format';

const DAY_MS = 86_400_000;

interface TimelineWindow {
  start: number;
  end: number;
}

function pickRange(tasks: Task[]): TimelineWindow {
  const dates: number[] = [];
  for (const t of tasks) {
    if (t.startDate) dates.push(new Date(t.startDate).getTime());
    if (t.dueDate) dates.push(new Date(t.dueDate).getTime());
  }
  if (!dates.length) {
    const now = Date.now();
    return { start: now, end: now + 14 * DAY_MS };
  }
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const span = Math.max(max - min, 7 * DAY_MS);
  return {
    start: min - DAY_MS,
    end: min - DAY_MS + span + 2 * DAY_MS,
  };
}

function computeBar(task: Task, window: TimelineWindow): { left: number; width: number } | null {
  const start = task.startDate ? new Date(task.startDate).getTime() : null;
  const end = task.dueDate ? new Date(task.dueDate).getTime() : null;
  if (!start && !end) return null;
  const s = start ?? (end as number) - DAY_MS;
  const e = end ?? (start as number) + DAY_MS;
  const span = window.end - window.start;
  const left = ((s - window.start) / span) * 100;
  const width = Math.max(((e - s) / span) * 100, 0.5);
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0.5, Math.min(100 - left, width)),
  };
}

function axisTicks(window: TimelineWindow): { label: string; pct: number }[] {
  const span = window.end - window.start;
  const days = Math.ceil(span / DAY_MS);
  const stride = Math.max(1, Math.ceil(days / 6));
  const ticks: { label: string; pct: number }[] = [];
  for (let i = 0; i <= days; i += stride) {
    const t = window.start + i * DAY_MS;
    const pct = ((t - window.start) / span) * 100;
    ticks.push({ label: formatDate(new Date(t).toISOString()), pct });
  }
  return ticks;
}

export function TimelinePage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId') ?? '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depsByTask, setDepsByTask] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setDepsByTask(new Map());
      return;
    }
    tasksApi
      .list({ projectId })
      .then(async (loaded) => {
        setTasks(loaded);
        const counts = new Map<string, number>();
        await Promise.all(
          loaded.map(async (t) => {
            try {
              const deps = await dependenciesApi.listForTask(t.id);
              counts.set(t.id, deps.dependsOn.length);
            } catch {
              counts.set(t.id, 0);
            }
          }),
        );
        setDepsByTask(counts);
      })
      .catch((err) => setError(err.message));
  }, [projectId]);

  const window = useMemo(() => pickRange(tasks), [tasks]);
  const ticks = useMemo(() => axisTicks(window), [window]);
  const project = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="col">
      <div className="page-header">
        <h1>Timeline</h1>
        <select
          value={projectId}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('projectId', e.target.value);
            else next.delete('projectId');
            setParams(next);
          }}
          style={{ maxWidth: 320 }}
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {!project ? (
        <div className="card muted">Pick a project to see its timeline.</div>
      ) : (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{project.name}</h2>
            <Link to={`/projects/${project.id}`} className="btn btn-secondary">
              Open project
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="muted">No tasks in this project.</div>
          ) : (
            <>
              <div className="gantt-axis">
                <div />
                <div className="ticks">
                  {ticks.map((t) => (
                    <span key={t.label} style={{ marginLeft: `${t.pct}%`, position: 'absolute' }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="gantt">
                {tasks.map((task) => {
                  const bar = computeBar(task, window);
                  const overdue = isOverdue(task.dueDate, task.status);
                  const klass = task.status === 'done' ? 'done' : overdue ? 'overdue' : '';
                  return (
                    <div key={task.id} className="gantt-row">
                      <div className="gantt-label">
                        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                        <span style={{ marginLeft: 6 }}>
                          <StatusBadge status={task.status} />
                        </span>
                        {(depsByTask.get(task.id) ?? 0) > 0 ? (
                          <span
                            className="muted"
                            style={{ marginLeft: 6, fontSize: 11 }}
                            title="Depends on other tasks"
                          >
                            ↳ {depsByTask.get(task.id)}
                          </span>
                        ) : null}
                      </div>
                      <div className="gantt-track">
                        {bar ? (
                          <div
                            className={`gantt-bar ${klass}`}
                            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                            title={`${formatDate(task.startDate)} → ${formatDate(task.dueDate)}`}
                          />
                        ) : (
                          <span
                            className="muted"
                            style={{ position: 'absolute', left: 8, top: 0, fontSize: 11 }}
                          >
                            No dates
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
