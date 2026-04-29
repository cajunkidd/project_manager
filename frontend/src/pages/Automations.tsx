import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, Zap } from 'lucide-react';
import { automationsApi, usersApi, projectsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate, TASK_STATUSES, PRIORITIES } from '@/lib/utils';
import type { User, Project } from '@/types';

const TRIGGERS = [
  { value: 'task.created', label: 'When a task is created' },
  { value: 'task.status_changed', label: 'When task status changes' },
  { value: 'task.assigned', label: 'When a task is assigned' },
  { value: 'task.priority_changed', label: 'When task priority changes' },
  { value: 'task.overdue', label: 'When a task is overdue (manual run)' },
];

interface Condition { field: string; operator: string; value: any; }
interface Action { type: string; params: Record<string, any>; }

interface Rule {
  id: string;
  name: string;
  triggerType: string;
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  createdAt: string;
  createdBy?: { id: string; displayName: string };
}

function ConditionEditor({
  condition, onChange, onRemove,
}: { condition: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-2 items-center">
      <Select value={condition.field} onValueChange={(v) => onChange({ ...condition, field: v })}>
        <SelectTrigger className="w-32"><SelectValue placeholder="Field" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="projectId">Project</SelectItem>
          <SelectItem value="assignedTo">Assignee</SelectItem>
        </SelectContent>
      </Select>
      <Select value={condition.operator} onValueChange={(v) => onChange({ ...condition, operator: v })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Op" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">equals</SelectItem>
          <SelectItem value="not_equals">not equals</SelectItem>
          <SelectItem value="changed_to">changed to</SelectItem>
          <SelectItem value="changed_from">changed from</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={condition.value ?? ''}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Value"
        className="flex-1"
      />
      <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={onRemove}>✕</Button>
    </div>
  );
}

function ActionEditor({
  action, onChange, onRemove, users,
}: { action: Action; onChange: (a: Action) => void; onRemove: () => void; users: User[] }) {
  const setParam = (key: string, value: any) =>
    onChange({ ...action, params: { ...action.params, [key]: value } });

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
      <div className="flex gap-2">
        <Select value={action.type} onValueChange={(v) => onChange({ type: v, params: {} })}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Action type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="notify">Notify a user</SelectItem>
            <SelectItem value="change_status">Change status</SelectItem>
            <SelectItem value="set_priority">Set priority</SelectItem>
            <SelectItem value="assign">Assign to user</SelectItem>
            <SelectItem value="create_subtask">Create subtask</SelectItem>
            <SelectItem value="add_comment">Add comment</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={onRemove}>✕</Button>
      </div>

      {action.type === 'notify' && (
        <>
          <Select value={action.params.userId ?? ''} onValueChange={(v) => setParam('userId', v)}>
            <SelectTrigger><SelectValue placeholder="Notify…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="$assignee">The assigned user</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notification title"
            value={action.params.title ?? ''}
            onChange={(e) => setParam('title', e.target.value)}
          />
          <Textarea
            placeholder="Message (use {{title}}, {{status}}, {{priority}}, {{assignee}}, {{project}})"
            value={action.params.message ?? ''}
            onChange={(e) => setParam('message', e.target.value)}
            rows={2}
          />
        </>
      )}

      {action.type === 'change_status' && (
        <Select value={action.params.status ?? ''} onValueChange={(v) => setParam('status', v)}>
          <SelectTrigger><SelectValue placeholder="New status" /></SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {action.type === 'set_priority' && (
        <Select value={action.params.priority ?? ''} onValueChange={(v) => setParam('priority', v)}>
          <SelectTrigger><SelectValue placeholder="New priority" /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {action.type === 'assign' && (
        <Select value={action.params.userId ?? ''} onValueChange={(v) => setParam('userId', v)}>
          <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
          <SelectContent>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {action.type === 'create_subtask' && (
        <>
          <Input
            placeholder="Subtask title"
            value={action.params.title ?? ''}
            onChange={(e) => setParam('title', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={action.params.priority ?? 'normal'} onValueChange={(v) => setParam('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={action.params.assignedTo ?? ''} onValueChange={(v) => setParam('assignedTo', v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                <SelectItem value="$assignee">Same as parent assignee</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {action.type === 'add_comment' && (
        <Textarea
          placeholder="Comment text"
          value={action.params.body ?? ''}
          onChange={(e) => setParam('body', e.target.value)}
          rows={2}
        />
      )}
    </div>
  );
}

function RuleBuilder({
  open, onClose, onSaved, rule, users, projects,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  rule?: Rule; users: User[]; projects: Project[];
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [triggerType, setTriggerType] = useState(rule?.triggerType ?? 'task.created');
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<Action[]>(rule?.actions ?? []);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actions.length === 0) {
      alert('Add at least one action.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name, triggerType, conditions, actions, isActive };
      if (rule) await automationsApi.update(rule.id, payload);
      else await automationsApi.create(payload);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Automation' : 'New Automation Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <Label>Rule Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions (all must match)</Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setConditions([...conditions, { field: 'status', operator: 'equals', value: '' }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Condition
              </Button>
            </div>
            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">No conditions — rule fires on every trigger event.</p>
            )}
            {conditions.map((c, i) => (
              <ConditionEditor
                key={i}
                condition={c}
                onChange={(updated) => setConditions(conditions.map((x, idx) => idx === i ? updated : x))}
                onRemove={() => setConditions(conditions.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Actions *</Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setActions([...actions, { type: 'notify', params: {} }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Action
              </Button>
            </div>
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground">Add at least one action.</p>
            )}
            {actions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                users={users}
                onChange={(updated) => setActions(actions.map((x, idx) => idx === i ? updated : x))}
                onRemove={() => setActions(actions.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Automations() {
  const { isManager } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editRule, setEditRule] = useState<Rule | undefined>();
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [r, u, p] = await Promise.all([automationsApi.list(), usersApi.list(), projectsApi.list()]);
      setRules(r);
      setUsers(u);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (rule: Rule) => {
    await automationsApi.toggle(rule.id);
    load();
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Delete automation "${rule.name}"?`)) return;
    await automationsApi.remove(rule.id);
    load();
  };

  const runOverdueCheck = async () => {
    setRunning(true);
    try {
      const result = await automationsApi.runOverdueCheck();
      alert(`Checked ${result.checked} overdue tasks. Any matching rules have been executed.`);
    } finally {
      setRunning(false);
    }
  };

  if (!isManager) {
    return <p className="text-muted-foreground">Only managers and admins can view automations.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Automations</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runOverdueCheck} disabled={running}>
            <Play className="mr-2 h-4 w-4" /> {running ? 'Running…' : 'Run Overdue Check'}
          </Button>
          <Button onClick={() => { setEditRule(undefined); setShowBuilder(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No automation rules yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create rules to auto-notify, auto-assign, or auto-route tasks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{rule.name}</h3>
                      {rule.isActive ? (
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Active</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Paused</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {TRIGGERS.find((t) => t.value === rule.triggerType)?.label ?? rule.triggerType}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {rule.conditions.length > 0 && (
                        <span className="bg-blue-50 text-blue-700 rounded px-2 py-1">
                          {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="bg-purple-50 text-purple-700 rounded px-2 py-1">
                        {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        Created by {rule.createdBy?.displayName ?? '—'} · {formatDate(rule.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleToggle(rule)}>
                      {rule.isActive ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      const full = await automationsApi.get(rule.id);
                      setEditRule(full);
                      setShowBuilder(true);
                    }}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(rule)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RuleBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSaved={load}
        rule={editRule}
        users={users}
        projects={projects}
      />
    </div>
  );
}
