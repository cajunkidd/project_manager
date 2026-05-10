import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dependenciesApi } from '../api/dependencies';
import { tasksApi } from '../api/tasks';
import type { Task, TaskDependencyView } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  taskId: string;
  projectId: string | null;
}

export function TaskDependencies({ taskId, projectId }: Props) {
  const [view, setView] = useState<TaskDependencyView | null>(null);
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [picked, setPicked] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    dependenciesApi
      .listForTask(taskId)
      .then(setView)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    tasksApi
      .list(projectId ? { projectId } : {})
      .then((tasks) => setCandidates(tasks.filter((t) => t.id !== taskId)))
      .catch(() => setCandidates([]));
  }, [taskId, projectId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      await dependenciesApi.add(taskId, picked);
      setPicked('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await dependenciesApi.remove(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Dependencies</h2>
      {error ? <div className="error">{error}</div> : null}

      <div className="grid cols-2">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Depends on
          </div>
          {view?.dependencies.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {view.dependencies.map((d) => (
                <li key={d.id}>
                  <Link to={`/tasks/${d.dependsOn?.id}`}>{d.dependsOn?.title}</Link>{' '}
                  {d.dependsOn ? <StatusBadge status={d.dependsOn.status} /> : null}{' '}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0 6px', fontSize: 11 }}
                    onClick={() => remove(d.id)}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">No upstream tasks.</div>
          )}
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Blocks
          </div>
          {view?.dependents.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {view.dependents.map((d) => (
                <li key={d.id}>
                  <Link to={`/tasks/${d.task?.id}`}>{d.task?.title}</Link>{' '}
                  {d.task ? <StatusBadge status={d.task.status} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">Nothing waiting on this.</div>
          )}
        </div>
      </div>

      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">Add a dependency…</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={!picked || busy}>
          Add
        </button>
      </form>
    </div>
  );
}
