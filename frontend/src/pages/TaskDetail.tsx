import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { tasksApi, commentsApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { formatDate, TASK_STATUSES, PRIORITIES } from '@/lib/utils';
import type { Task, User } from '@/types';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [t, u] = await Promise.all([tasksApi.get(id!), usersApi.list()]);
      setTask(t);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const updateField = async (field: string, value: string) => {
    if (!task) return;
    await tasksApi.update(task.id, { [field]: value });
    setTask((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !task) return;
    setSubmitting(true);
    try {
      const newComment = await commentsApi.addToTask(task.id, comment);
      setTask((prev) => prev ? { ...prev, comments: [...(prev.comments ?? []), newComment] } : prev);
      setComment('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!task) return <div className="text-red-600">Task not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        {task.project ? (
          <Link to={`/projects/${task.project.id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> {task.project.name}</Button>
          </Link>
        ) : (
          <Link to="/my-tasks">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Tasks</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            {task.description && <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{task.description}</p>}
          </div>

          {(task.subtasks?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Subtasks ({task.subtasks!.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {task.subtasks!.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <StatusBadge status={sub.status} />
                      <Link to={`/tasks/${sub.id}`} className="text-sm hover:underline">{sub.title}</Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Comments ({task.comments?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {task.comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              {task.comments?.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{c.user?.displayName}</span>
                    <span className="text-muted-foreground text-xs">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              <form onSubmit={addComment} className="flex gap-2 pt-2 border-t">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment… Use @name to mention someone"
                  rows={2}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={submitting || !comment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {(task.activityLogs?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {task.activityLogs!.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-0.5 flex-shrink-0 font-medium text-foreground">{log.user?.displayName}</span>
                      <span>{log.action.replace(/_/g, ' ')}</span>
                      <span className="ml-auto flex-shrink-0">{formatDate(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <Select value={task.status} onValueChange={(v) => updateField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
                <Select value={task.priority} onValueChange={(v) => updateField('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignee</label>
                <Select
                  value={task.assignee?.id ?? ''}
                  onValueChange={(v) => updateField('assignedTo', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</label>
                <p className="text-sm">{formatDate(task.dueDate)}</p>
              </div>
              {task.project && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project</label>
                  <Link to={`/projects/${task.project.id}`} className="text-sm font-medium hover:underline">
                    {task.project.name}
                  </Link>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created By</label>
                <p className="text-sm">{task.createdBy?.displayName ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</label>
                <p className="text-sm">{formatDate(task.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
