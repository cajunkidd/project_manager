import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { tasksApi, commentsApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StatusBadge, PriorityBadge } from '@/components/StatusBadge';
import { formatDate, TASK_STATUSES, PRIORITIES } from '@/lib/utils';
import type { Task, User } from '@/types';

function InlineEdit({
  value,
  onSave,
  multiline = false,
  className = '',
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const start = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const cancel = () => setEditing(false);
  const save = async () => { await onSave(draft); setEditing(false); };

  if (!editing) {
    return (
      <div className={`group flex items-start gap-2 ${className}`} onClick={start}>
        <span className="cursor-text">{value || <span className="text-muted-foreground italic">Click to edit…</span>}</span>
        <Pencil className="h-3 w-3 mt-1 opacity-0 group-hover:opacity-50 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <Textarea ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="flex-1" />
      ) : (
        <Input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1" />
      )}
      <div className="flex gap-1 mt-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Check className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}><X className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function SubtaskForm({
  open,
  onClose,
  onSaved,
  parentTaskId,
  projectId,
  users,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  parentTaskId: string; projectId?: string; users: User[];
}) {
  const [form, setForm] = useState({ title: '', priority: 'normal', assignedTo: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await tasksApi.create({
        title: form.title,
        priority: form.priority,
        assignedTo: form.assignedTo || null,
        dueDate: form.dueDate || null,
        parentTaskId,
        projectId: projectId ?? null,
      });
      onSaved();
      onClose();
      setForm({ title: '', priority: 'normal', assignedTo: '', dueDate: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Subtask</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add Subtask'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const updateField = async (field: string, value: string | null) => {
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

  const deleteTask = async () => {
    if (!task || !confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await tasksApi.remove(task.id);
      navigate(task.project ? `/projects/${task.project.id}` : '/my-tasks');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!task) return <div className="text-red-600">Task not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
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
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={deleteTask}
          disabled={deleting}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Delete Task
        </Button>
      </div>

      {task.parentTask && (
        <div className="text-sm text-muted-foreground">
          Subtask of{' '}
          <Link to={`/tasks/${task.parentTask.id}`} className="font-medium hover:underline">
            {task.parentTask.title}
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <InlineEdit
              value={task.title}
              onSave={(v) => updateField('title', v)}
              className="text-2xl font-bold"
            />
            <div className="mt-2">
              <InlineEdit
                value={task.description ?? ''}
                onSave={(v) => updateField('description', v)}
                multiline
                className="text-muted-foreground text-sm"
              />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                Subtasks ({task.subtasks?.length ?? 0})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowSubtaskForm(true)}>
                <Plus className="mr-1 h-3 w-3" /> Add Subtask
              </Button>
            </CardHeader>
            <CardContent>
              {(task.subtasks?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No subtasks.</p>
              ) : (
                <div className="space-y-2">
                  {task.subtasks!.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3">
                      <StatusBadge status={sub.status} />
                      <Link to={`/tasks/${sub.id}`} className="text-sm hover:underline flex-1">
                        {sub.title}
                      </Link>
                      {sub.assignee && (
                        <span className="text-xs text-muted-foreground">{sub.assignee.displayName}</span>
                      )}
                      <PriorityBadge priority={sub.priority} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comments ({task.comments?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.comments?.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
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
                  placeholder="Add a comment… Use @DisplayName to mention someone"
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
                      <span className="mt-0.5 flex-shrink-0 font-medium text-foreground">
                        {log.user?.displayName}
                      </span>
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
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
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
                  onValueChange={(v) => updateField('assignedTo', v || null)}
                >
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</label>
                <Input
                  type="date"
                  value={task.dueDate?.slice(0, 10) ?? ''}
                  onChange={(e) => updateField('dueDate', e.target.value || null)}
                />
              </div>
              {task.project && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project</label>
                  <Link to={`/projects/${task.project.id}`} className="block text-sm font-medium hover:underline">
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

      <SubtaskForm
        open={showSubtaskForm}
        onClose={() => setShowSubtaskForm(false)}
        onSaved={load}
        parentTaskId={task.id}
        projectId={task.project?.id}
        users={users}
      />
    </div>
  );
}
