import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/client';
import { departmentApi, type DepartmentBoard } from '../api/advanced';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import type { Project } from '../types';
import { TASK_STATUS_ORDER, taskStatusLabel } from '../utils/format';

export function DepartmentBoardPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [picked, setPicked] = useState('');
  const [board, setBoard] = useState<DepartmentBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    http
      .get<Project[]>('/projects')
      .then((projects) => {
        const set = new Set<string>();
        for (const p of projects) if (p.department) set.add(p.department);
        const list = Array.from(set).sort();
        setDepartments(list);
        if (!picked && list.length) setPicked(list[0]);
      })
      .catch((err) => setError(err.message));
  }, [picked]);

  const reload = useCallback(() => {
    if (!picked) return;
    departmentApi
      .board(picked)
      .then(setBoard)
      .catch((err) => setError(err.message));
  }, [picked]);

  useEffect(() => reload(), [reload]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Department board</h1>
        <select value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">Choose…</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {board ? (
        <>
          <div className="grid cols-3">
            <div className="stat">
              <div className="label">Projects</div>
              <div className="value">{board.counts.projects}</div>
            </div>
            <div className="stat">
              <div className="label">Tasks</div>
              <div className="value">{board.counts.tasks}</div>
            </div>
            <div className="stat">
              <div className="label">In progress</div>
              <div className="value">{board.counts.byStatus.in_progress ?? 0}</div>
            </div>
          </div>

          <div className="kanban">
            {TASK_STATUS_ORDER.map((status) => {
              const tasks = board.tasks.filter((t) => t.status === status);
              return (
                <div className="kanban-column" key={status}>
                  <h3>
                    <span>{taskStatusLabel(status)}</span>
                    <span>{tasks.length}</span>
                  </h3>
                  {tasks.map((t) => (
                    <div className="kanban-card" key={t.id}>
                      <Link to={`/tasks/${t.id}`} style={{ fontWeight: 500 }}>
                        {t.title}
                      </Link>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {t.project ? <span className="badge">{t.project.name}</span> : null}
                        <PriorityBadge priority={t.priority as 'low' | 'normal' | 'high' | 'urgent'} />
                      </div>
                      {t.assignedTo ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {t.assignedTo.displayName}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Projects in {board.department}</h2>
            {board.projects.length === 0 ? (
              <div className="muted">No projects.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {board.projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/projects/${p.id}`}>{p.name}</Link>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="muted">{p._count?.tasks ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : !picked ? (
        <div className="muted">Pick a department to view its board.</div>
      ) : null}
    </div>
  );
}
