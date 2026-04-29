import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { tasksApi, projectsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import AiTaskCreate from '@/components/AiTaskCreate';
import { formatDate, isOverdue, TASK_STATUSES, PRIORITIES } from '@/lib/utils';
import type { Task, User, Project } from '@/types';

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAiCreate, setShowAiCreate] = useState(false);

  const loadTasks = () => {
    if (!user) return;
    setLoading(true);
    tasksApi.list({
      assignedTo: user.id,
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
      ...(search && { search }),
    }).then((data) => {
      setTasks(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadTasks(); }, [user, statusFilter, priorityFilter, search]);

  useEffect(() => {
    Promise.all([projectsApi.list(), usersApi.list()]).then(([p, u]) => {
      setProjects(p);
      setUsers(u);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Button size="sm" variant="outline" onClick={() => setShowAiCreate(true)}>
          <Sparkles className="mr-1 h-3 w-3 text-purple-500" /> AI Create Task
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="rounded-lg border bg-white divide-y">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate, task.status);
            return (
              <div key={task.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <Link to={`/tasks/${task.id}`} className="text-sm font-medium hover:underline">
                    {task.title}
                  </Link>
                  {task.project && (
                    <p className="text-xs text-muted-foreground">
                      <Link to={`/projects/${task.project.id}`} className="hover:underline">
                        {task.project.name}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.dueDate ? (
                    <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {formatDate(task.dueDate)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground w-20">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AiTaskCreate
        open={showAiCreate}
        onClose={() => setShowAiCreate(false)}
        onCreated={loadTasks}
        projects={projects}
        users={users}
      />
    </div>
  );
}
