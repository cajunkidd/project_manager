import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles, Loader2 } from 'lucide-react';
import { projectsApi, tasksApi, usersApi, aiApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AiTaskCreate from '@/components/AiTaskCreate';
import RiskBadge from '@/components/RiskBadge';
import { formatDate, isOverdue, TASK_STATUSES, PRIORITIES } from '@/lib/utils';
import type { Project, Task, User } from '@/types';

function TaskForm({ open, onClose, onSaved, projectId, users }: {
  open: boolean; onClose: () => void; onSaved: () => void; projectId: string; users: User[];
}) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'normal',
    assignedTo: '', dueDate: '',
    isRecurring: false, recurrencePattern: 'weekly', recurrenceInterval: 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await tasksApi.create({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        projectId,
        assignedTo: form.assignedTo || null,
        dueDate: form.dueDate || null,
        isRecurring: form.isRecurring,
        recurrencePattern: form.isRecurring ? form.recurrencePattern : null,
        recurrenceInterval: form.isRecurring ? form.recurrenceInterval : null,
      });
      onSaved();
      onClose();
      setForm({ title: '', description: '', priority: 'normal', assignedTo: '', dueDate: '', isRecurring: false, recurrencePattern: 'weekly', recurrenceInterval: 1 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Assign To</Label>
            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
              Recurring task
            </label>
            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-3 pl-5">
                <div className="space-y-1">
                  <Label>Repeat every</Label>
                  <Input type="number" min={1} max={99} value={form.recurrenceInterval}
                    onChange={(e) => setForm({ ...form, recurrenceInterval: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-1">
                  <Label>Period</Label>
                  <Select value={form.recurrencePattern} onValueChange={(v) => setForm({ ...form, recurrencePattern: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Day(s)</SelectItem>
                      <SelectItem value="weekly">Week(s)</SelectItem>
                      <SelectItem value="monthly">Month(s)</SelectItem>
                      <SelectItem value="yearly">Year(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project & { tasks?: Task[] } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAiCreate, setShowAiCreate] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [risk, setRisk] = useState<{ score: number; level: string; factors: { label: string; weight: number }[]; explanation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [p, u, r] = await Promise.all([
        projectsApi.get(id!),
        usersApi.list(),
        aiApi.projectRisk(id!).catch(() => null),
      ]);
      setProject(p);
      setUsers(u);
      setRisk(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAiSummary = async () => {
    if (!id) return;
    setSummarizing(true);
    setAiSummary('');
    try {
      const summary = await aiApi.projectSummary(id);
      setAiSummary(summary ?? '');
    } catch {
      setAiSummary('AI summary unavailable — check ANTHROPIC_API_KEY.');
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!project) return <div className="text-red-600">Project not found.</div>;

  const tasks = (project as any).tasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Projects</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="mt-1 text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          {risk && <RiskBadge level={risk.level} score={risk.score} />}
          <Button size="sm" variant="outline" onClick={handleAiSummary} disabled={summarizing}>
            {summarizing
              ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Summarizing…</>
              : <><Sparkles className="mr-1 h-3 w-3 text-purple-500" /> AI Summary</>}
          </Button>
        </div>
      </div>

      {aiSummary && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm whitespace-pre-wrap">{aiSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {risk && risk.factors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Risk Analysis
              <RiskBadge level={risk.level} score={risk.score} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risk.explanation && (
              <p className="text-sm text-muted-foreground italic">
                <Sparkles className="h-3 w-3 inline text-purple-500 mr-1" />
                {risk.explanation}
              </p>
            )}
            <div className="space-y-1.5">
              {risk.factors.sort((a, b) => b.weight - a.weight).map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="flex-1">{f.label}</span>
                  <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${Math.min(100, (f.weight / 40) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">+{f.weight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div>
          <span className="text-muted-foreground">Owner</span>
          <p className="font-medium">{project.owner?.displayName ?? '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Department</span>
          <p className="font-medium">{project.department ?? '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Due Date</span>
          <p className="font-medium">{formatDate(project.dueDate)}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAiCreate(true)}>
              <Sparkles className="mr-1 h-3 w-3 text-purple-500" /> AI Create
            </Button>
            <Button size="sm" onClick={() => setShowTaskForm(true)}>
              <Plus className="mr-1 h-3 w-3" /> Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="divide-y">
              {tasks.map((task: Task) => {
                const overdue = isOverdue(task.dueDate, task.status);
                return (
                  <div key={task.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <Link to={`/tasks/${task.id}`} className="text-sm font-medium hover:underline">
                        {task.title}
                      </Link>
                      {task.assignee && (
                        <p className="text-xs text-muted-foreground">{task.assignee.displayName}</p>
                      )}
                    </div>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskForm
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
        onSaved={load}
        projectId={id!}
        users={users}
      />

      <AiTaskCreate
        open={showAiCreate}
        onClose={() => setShowAiCreate(false)}
        onCreated={load}
        projects={project ? [project as any] : []}
        users={users}
        defaultProjectId={id}
      />
    </div>
  );
}
