import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dependenciesApi } from '../api/dependencies';
import { tasksApi } from '../api/tasks';
import type { Task, TaskDependencies } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  taskId: string;
  projectId: string | null;
}

export function DependenciesCard({ taskId, projectId }: Props) {
  const [data, setData] = useState<TaskDependencies | null>(null);
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    dependenciesApi
      .list(taskId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    tasksApi
      .list(projectId ? { projectId } : {})
      .then((all) => setCandidates(all.filter((t) => t.id !== taskId)))
      .catch(() => setCandidates([]));
  }, [taskId, projectId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await dependenciesApi.create(taskId, selected);
      setSelected('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    }
  }

  async function onRemove(dependsOnTaskId: string) {
    await dependenciesApi.remove(taskId, dependsOnTaskId);
    reload();
  }

  if (!data) return null;

  const existingIds = new Set(data.dependencies.map((d) => d.task.id));
  const candidateOptions = candidates.filter((c) => !existingIds.has(c.id));

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
        Dependencies{' '}
        {data.isBlocked ? (
          <span className="badge overdue" style={{ marginLeft: 8 }}>
            Blocked
          </span>
        ) : null}
      </h2>
      {error ? <div className="error">{error}</div> : null}

      <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.04, marginTop: 4 }}>
        Blocked by
      </div>
      {data.dependencies.length === 0 ? (
        <div className="muted">No upstream dependencies.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {data.dependencies.map((d) => (
            <li
              key={d.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <Link to={`/tasks/${d.task.id}`}>{d.task.title}</Link>
              <StatusBadge status={d.task.status} />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 12 }}
                onClick={() => onRemove(d.task.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.04, marginTop: 12 }}>
        Blocks
      </div>
      {data.dependents.length === 0 ? (
        <div className="muted">No downstream tasks.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {data.dependents.map((d) => (
            <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <Link to={`/tasks/${d.task.id}`}>{d.task.title}</Link>
              <StatusBadge status={d.task.status} />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="row" style={{ marginTop: 12 }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1 }}>
          <option value="">Add a dependency…</option>
          {candidateOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={!selected}>
          Add
        </button>
      </form>
    </div>
  );
}
