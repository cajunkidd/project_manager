import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  reportsApi,
  type AvgCompletion,
  type CompletionByWeekRow,
  type OpenByUserRow,
  type ProjectsByStatusRow,
  type ReportFilters,
} from '../api/reports';
import { BarChart, type BarChartDatum } from '../components/BarChart';
import { TrendChart } from '../components/TrendChart';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { Task } from '../types';
import { formatDate, projectStatusLabel } from '../utils/format';

function shortWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [openByUser, setOpenByUser] = useState<OpenByUserRow[]>([]);
  const [projectsByStatus, setProjectsByStatus] = useState<ProjectsByStatusRow[]>([]);
  const [completionByWeek, setCompletionByWeek] = useState<CompletionByWeekRow[]>([]);
  const [avg, setAvg] = useState<AvgCompletion | null>(null);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [blocked, setBlocked] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      reportsApi.openByUser(filters),
      reportsApi.projectsByStatus(filters),
      reportsApi.completionByWeek(filters),
      reportsApi.avgCompletion(filters),
      reportsApi.overdue(filters),
      reportsApi.blocked(filters),
    ])
      .then(([byUser, byStatus, weekly, avgRes, overdueRes, blockedRes]) => {
        setOpenByUser(byUser);
        setProjectsByStatus(byStatus);
        setCompletionByWeek(weekly);
        setAvg(avgRes);
        setOverdue(overdueRes);
        setBlocked(blockedRes);
      })
      .catch((err) => setError(err.message));
  }, [filters]);

  const userBars: BarChartDatum[] = openByUser
    .filter((row) => row.count > 0)
    .map((row) => ({
      label: row.user.displayName,
      value: row.count,
      hint: row.user.department ? `${row.count} open · ${row.user.department}` : undefined,
    }));

  const statusBars: BarChartDatum[] = projectsByStatus.map((row) => ({
    label: projectStatusLabel(row.status),
    value: row.count,
  }));

  const trend = completionByWeek.map((row) => ({
    label: shortWeek(row.weekStart),
    value: row.count,
  }));

  return (
    <div className="col">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <label>Department</label>
            <input
              value={filters.department ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, department: e.target.value || undefined }))
              }
              placeholder="e.g. IT"
            />
          </div>
          <div>
            <label>Priority</label>
            <select
              value={filters.priority ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, priority: e.target.value || undefined }))
              }
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label>From</label>
            <input
              type="date"
              value={filters.from ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, from: e.target.value || undefined }))
              }
            />
          </div>
          <div>
            <label>To</label>
            <input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, to: e.target.value || undefined }))
              }
            />
          </div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid cols-3">
        <div className="stat">
          <div className="label">Avg completion (days)</div>
          <div className="value">{avg ? avg.avgDays : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Overdue tasks</div>
          <div className="value" style={{ color: overdue.length > 0 ? '#b91c1c' : undefined }}>
            {overdue.length}
          </div>
        </div>
        <div className="stat">
          <div className="label">Blocked / waiting</div>
          <div className="value">{blocked.length}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Open tasks by user</h2>
        <BarChart data={userBars} emptyMessage="No open tasks." />
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Projects by status</h2>
        <BarChart data={statusBars} emptyMessage="No projects." />
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Tasks completed by week</h2>
        <TrendChart data={trend} emptyMessage="No completions yet." />
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Overdue tasks</h2>
        {overdue.length === 0 ? (
          <div className="muted">No overdue tasks.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  </td>
                  <td className="muted">{t.project?.name ?? '—'}</td>
                  <td className="muted">{t.assignedTo?.displayName ?? '—'}</td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td>
                    <span className="badge overdue">{formatDate(t.dueDate)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Blocked / waiting</h2>
        {blocked.length === 0 ? (
          <div className="muted">No blocked tasks.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  </td>
                  <td className="muted">{t.project?.name ?? '—'}</td>
                  <td className="muted">{t.assignedTo?.displayName ?? '—'}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="muted">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
