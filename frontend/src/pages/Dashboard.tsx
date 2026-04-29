import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { dashboardApi, aiApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import RiskBadge from '@/components/RiskBadge';
import { formatDate, isOverdue } from '@/lib/utils';
import type { Task } from '@/types';

interface ProjectRisk {
  projectId: string;
  name: string;
  score: number;
  level: string;
  topFactor: string | null;
}

interface DashboardData {
  openTasks: Task[];
  overdueTasks: Task[];
  dueSoonTasks: Task[];
  recentActivity: any[];
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-lg p-3 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: Task }) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <Link to={`/tasks/${task.id}`} className="text-sm font-medium hover:underline">
          {task.title}
        </Link>
        {task.project && (
          <p className="text-xs text-muted-foreground">{task.project.name}</p>
        )}
      </div>
      <div className="ml-4 flex items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        {task.dueDate && (
          <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [managerData, setManagerData] = useState<any | null>(null);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [myData, mgData, riskData] = await Promise.all([
          dashboardApi.me(),
          isManager ? dashboardApi.manager() : null,
          isManager ? aiApi.listRisks().catch(() => []) : Promise.resolve([]),
        ]);
        setData(myData);
        if (mgData) setManagerData(mgData);
        setRisks(riskData ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isManager]);

  const atRiskProjects = risks.filter((r) => r.score >= 25);

  if (loading) return <div className="text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.displayName}</h1>
        <p className="text-muted-foreground">Here's what needs your attention today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Tasks" value={data?.openTasks.length ?? 0} icon={CheckCircle2} color="bg-blue-500" />
        <StatCard label="Overdue" value={data?.overdueTasks.length ?? 0} icon={AlertCircle} color="bg-red-500" />
        <StatCard label="Due This Week" value={data?.dueSoonTasks.length ?? 0} icon={Clock} color="bg-yellow-500" />
        {isManager && managerData && (
          <StatCard label="Completed This Week" value={managerData.completedThisWeek} icon={TrendingUp} color="bg-green-500" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(data?.overdueTasks.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-red-600">
                <AlertCircle className="h-4 w-4" /> Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data!.overdueTasks.map((t) => <TaskRow key={t.id} task={t} />)}
            </CardContent>
          </Card>
        )}

        {(data?.dueSoonTasks.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Due This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data!.dueSoonTasks.map((t) => <TaskRow key={t.id} task={t} />)}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Open Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks. Great work!</p>
            ) : (
              data?.openTasks.slice(0, 10).map((t) => <TaskRow key={t.id} task={t} />)
            )}
          </CardContent>
        </Card>

        {isManager && managerData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Projects by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {managerData.projectsByStatus.map((g: any) => (
                  <div key={g.status} className="flex items-center justify-between text-sm">
                    <StatusBadge status={g.status} />
                    <span className="font-medium">{g._count.status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isManager && atRiskProjects.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-orange-600">
                <AlertTriangle className="h-4 w-4" /> Projects at Risk ({atRiskProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {atRiskProjects.slice(0, 8).map((r) => (
                  <div key={r.projectId} className="flex items-center gap-3 py-2.5">
                    <Link to={`/projects/${r.projectId}`} className="text-sm font-medium hover:underline flex-1 min-w-0 truncate">
                      {r.name}
                    </Link>
                    {r.topFactor && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">{r.topFactor}</span>
                    )}
                    <RiskBadge level={r.level} score={r.score} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
