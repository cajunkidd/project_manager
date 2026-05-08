import { useEffect, useState } from 'react';
import { projectsApi } from '../api/projects';
import { workloadApi, type WorkloadRow } from '../api/workload';
import type { Project } from '../types';

const OVERLOAD_THRESHOLD = 8;

export function WorkloadPage() {
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [department, setDepartment] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    workloadApi
      .list({
        department: department || undefined,
        projectId: projectId || undefined,
      })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [department, projectId]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Workload</h1>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department filter…"
            style={{ maxWidth: 240 }}
          />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {rows.length === 0 ? (
          <div className="muted">No active users.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Department</th>
                <th>Open</th>
                <th>Overdue</th>
                <th>Urgent</th>
                <th>Due this week</th>
                <th>Done this week</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const overloaded = row.open >= OVERLOAD_THRESHOLD || row.overdue >= 3;
                return (
                  <tr key={row.user.id} className={overloaded ? 'workload-warn' : undefined}>
                    <td>
                      <strong>{row.user.displayName}</strong>
                    </td>
                    <td className="muted">{row.user.department ?? '—'}</td>
                    <td>{row.open}</td>
                    <td style={{ color: row.overdue > 0 ? '#b91c1c' : undefined }}>
                      {row.overdue}
                    </td>
                    <td>{row.urgent}</td>
                    <td>{row.dueThisWeek}</td>
                    <td>{row.completedThisWeek}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
