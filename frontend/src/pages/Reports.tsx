import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { reportsApi, usersApi, projectsApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { User, Project } from '@/types';

type Report = 'overview' | 'tasks-by-user' | 'overdue' | 'projects' | 'trend' | 'blocked' | 'workload';

const REPORT_TABS: { key: Report; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks-by-user', label: 'Tasks by User' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'projects', label: 'Projects by Status' },
  { key: 'trend', label: 'Completion Trend' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'workload', label: 'Workload' },
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState<Report>('overview');
  const [data, setData] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi.list().then(setUsers).catch(() => {});
    projectsApi.list().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const params: Record<string, string> = {};
    if (userFilter) params.userId = userFilter;
    if (projectFilter) params.projectId = projectFilter;

    const loaders: Record<Report, () => Promise<any>> = {
      overview: async () => {
        const [tasksByUser, overdue, projectsByStatus, trend, avgCompletion] = await Promise.all([
          reportsApi.tasksByUser(params),
          reportsApi.overdue(params),
          reportsApi.projectsByStatus(),
          reportsApi.completionTrend(8),
          reportsApi.avgCompletion(params),
        ]);
        return { tasksByUser, overdue, projectsByStatus, trend, avgCompletion };
      },
      'tasks-by-user': () => reportsApi.tasksByUser(params),
      overdue: () => reportsApi.overdue(params),
      projects: () => reportsApi.projectsByStatus(),
      trend: () => reportsApi.completionTrend(12),
      blocked: () => reportsApi.blocked(params),
      workload: () => reportsApi.workload(params),
    };

    loaders[activeReport]().then(setData).catch(console.error).finally(() => setLoading(false));
  }, [activeReport, userFilter, projectFilter]);

  const renderOverview = () => {
    if (!data) return null;
    const topUsers = [...(data.tasksByUser ?? [])].sort((a: any, b: any) => b.open - a.open).slice(0, 8);
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Open Tasks by User</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topUsers}>
                <XAxis dataKey="displayName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="open" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Completion Trend (8 weeks)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Projects by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.projectsByStatus?.summary ?? []}>
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Avg Completion Time</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <p className="text-5xl font-bold text-blue-600">{data.avgCompletion?.avgDays ?? 0}</p>
                <p className="text-muted-foreground mt-1">days average</p>
                <p className="text-sm text-muted-foreground mt-2">{data.avgCompletion?.total ?? 0} tasks completed</p>
              </div>
            </div>
            {(data.avgCompletion?.byPriority ?? []).filter((p: any) => p.count > 0).length > 0 && (
              <div className="mt-4 space-y-2">
                {data.avgCompletion.byPriority.filter((p: any) => p.count > 0).map((p: any) => (
                  <div key={p.priority} className="flex items-center justify-between text-sm">
                    <PriorityBadge priority={p.priority} />
                    <span className="text-muted-foreground">{p.avgDays} days ({p.count} tasks)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTasksByUser = () => (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">User</th>
            <th className="text-left px-4 py-3 font-medium">Department</th>
            <th className="text-right px-4 py-3 font-medium">Open</th>
            <th className="text-right px-4 py-3 font-medium">Overdue</th>
            <th className="text-right px-4 py-3 font-medium">Urgent</th>
            <th className="text-right px-4 py-3 font-medium">High</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(data ?? []).map((row: any) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{row.displayName}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.department ?? '—'}</td>
              <td className="px-4 py-3 text-right">{row.open}</td>
              <td className="px-4 py-3 text-right">
                {row.overdue > 0 ? <span className="text-red-600 font-medium">{row.overdue}</span> : 0}
              </td>
              <td className="px-4 py-3 text-right">
                {row.urgent > 0 ? <span className="text-orange-600 font-medium">{row.urgent}</span> : 0}
              </td>
              <td className="px-4 py-3 text-right">{row.high}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverdueTasks = () => (
    <div className="rounded-lg border bg-white divide-y">
      {(data ?? []).length === 0 ? (
        <p className="p-6 text-center text-muted-foreground">No overdue tasks.</p>
      ) : (data ?? []).map((task: any) => (
        <div key={task.id} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <Link to={`/tasks/${task.id}`} className="font-medium hover:underline text-sm">{task.title}</Link>
            {task.project && <p className="text-xs text-muted-foreground">{task.project.name}</p>}
          </div>
          <span className="text-xs text-muted-foreground">{task.assignee?.displayName ?? 'Unassigned'}</span>
          <PriorityBadge priority={task.priority} />
          <span className="text-xs text-red-600 font-medium">{formatDate(task.dueDate)}</span>
        </div>
      ))}
    </div>
  );

  const renderProjects = () => {
    const summary = data?.summary ?? [];
    const allProjects = data?.projects ?? [];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((g: any) => (
            <Card key={g.status}>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{g.count}</p>
                <StatusBadge status={g.status} />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-lg border bg-white divide-y">
          {allProjects.map((p: any) => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <Link to={`/projects/${p.id}`} className="font-medium hover:underline text-sm">{p.name}</Link>
              </div>
              <StatusBadge status={p.status} />
              <PriorityBadge priority={p.priority} />
              <span className="text-xs text-muted-foreground">{p.owner?.displayName ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{p._count?.tasks ?? 0} tasks</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrend = () => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Tasks Completed per Week (12 weeks)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const renderBlocked = () => (
    <div className="rounded-lg border bg-white divide-y">
      {(data ?? []).length === 0 ? (
        <p className="p-6 text-center text-muted-foreground">No blocked/waiting tasks.</p>
      ) : (data ?? []).map((task: any) => (
        <div key={task.id} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <Link to={`/tasks/${task.id}`} className="font-medium hover:underline text-sm">{task.title}</Link>
            {task.project && <p className="text-xs text-muted-foreground">{task.project.name}</p>}
          </div>
          <span className="text-xs text-muted-foreground">{task.assignee?.displayName ?? 'Unassigned'}</span>
          <PriorityBadge priority={task.priority} />
          {task.dueDate && <span className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</span>}
        </div>
      ))}
    </div>
  );

  const renderWorkload = () => (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">User</th>
            <th className="text-left px-4 py-3 font-medium">Department</th>
            <th className="text-right px-4 py-3 font-medium">Open</th>
            <th className="text-right px-4 py-3 font-medium">Overdue</th>
            <th className="text-right px-4 py-3 font-medium">Urgent</th>
            <th className="text-right px-4 py-3 font-medium">Due This Week</th>
            <th className="text-right px-4 py-3 font-medium">Done This Week</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(data ?? []).map((row: any) => {
            const overloaded = row.openTasks > 10 || row.overdueTasks > 3;
            return (
              <tr key={row.id} className={`hover:bg-muted/30 ${overloaded ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 font-medium">
                  {row.displayName}
                  {overloaded && <span className="ml-2 text-xs text-red-600 font-normal">⚠ High load</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.department ?? '—'}</td>
                <td className="px-4 py-3 text-right">{row.openTasks}</td>
                <td className="px-4 py-3 text-right">
                  {row.overdueTasks > 0 ? <span className="text-red-600 font-medium">{row.overdueTasks}</span> : 0}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.urgentTasks > 0 ? <span className="text-orange-600 font-medium">{row.urgentTasks}</span> : 0}
                </td>
                <td className="px-4 py-3 text-right">{row.dueThisWeek}</td>
                <td className="px-4 py-3 text-right text-green-600">{row.completedThisWeek}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderContent = () => {
    if (loading) return <p className="text-muted-foreground">Loading…</p>;
    if (!data) return null;
    switch (activeReport) {
      case 'overview': return renderOverview();
      case 'tasks-by-user': return renderTasksByUser();
      case 'overdue': return renderOverdueTasks();
      case 'projects': return renderProjects();
      case 'trend': return renderTrend();
      case 'blocked': return renderBlocked();
      case 'workload': return renderWorkload();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 rounded-lg border bg-muted p-1">
          {REPORT_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveReport(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeReport === key ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All users" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
