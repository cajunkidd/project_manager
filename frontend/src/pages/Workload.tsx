import { useEffect, useState } from 'react';
import { reportsApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEPARTMENTS = ['IT', 'Marketing', 'Operations', 'Sales', 'HR', 'Finance', 'Safety'];

function WorkloadBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-6 text-right">{value}</span>
    </div>
  );
}

export default function Workload() {
  const [data, setData] = useState<any[]>([]);
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('openTasks');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    reportsApi.workload(department ? { department } : {})
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [department]);

  const sort = (field: string) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sorted = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return (a[sortField] - b[sortField]) * dir;
  });

  const maxOpen = Math.max(...data.map((d) => d.openTasks), 1);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-right px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
      onClick={() => sort(field)}
    >
      {children} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workload</h1>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-2xl font-bold">{data.reduce((s, d) => s + d.openTasks, 0)}</p>
              <p className="text-sm text-muted-foreground">Total open tasks</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-2xl font-bold text-red-600">{data.reduce((s, d) => s + d.overdueTasks, 0)}</p>
              <p className="text-sm text-muted-foreground">Total overdue</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-2xl font-bold text-green-600">{data.reduce((s, d) => s + d.completedThisWeek, 0)}</p>
              <p className="text-sm text-muted-foreground">Completed this week</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium text-left">Open Tasks</th>
                  <SortHeader field="openTasks">#</SortHeader>
                  <SortHeader field="overdueTasks">Overdue</SortHeader>
                  <SortHeader field="urgentTasks">Urgent</SortHeader>
                  <SortHeader field="dueThisWeek">Due This Week</SortHeader>
                  <SortHeader field="completedThisWeek">Done This Week</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((row) => {
                  const overloaded = row.openTasks > 10 || row.overdueTasks > 3;
                  return (
                    <tr key={row.id} className={`${overloaded ? 'bg-red-50' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3 font-medium">
                        {row.displayName}
                        {overloaded && (
                          <span className="ml-2 text-xs text-red-600">⚠ High load</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.department ?? '—'}</td>
                      <td className="px-4 py-3 w-40">
                        <WorkloadBar value={row.openTasks} max={maxOpen} color="bg-blue-500" />
                      </td>
                      <td className="px-4 py-3 text-right">{row.openTasks}</td>
                      <td className="px-4 py-3 text-right">
                        {row.overdueTasks > 0 ? (
                          <span className="text-red-600 font-medium">{row.overdueTasks}</span>
                        ) : 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.urgentTasks > 0 ? (
                          <span className="text-orange-600 font-medium">{row.urgentTasks}</span>
                        ) : 0}
                      </td>
                      <td className="px-4 py-3 text-right">{row.dueThisWeek}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{row.completedThisWeek}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
