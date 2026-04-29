import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { aiApi, tasksApi, projectsApi, usersApi } from '@/lib/api';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { PRIORITIES } from '@/lib/utils';
import type { Project, User } from '@/types';

interface ParsedTask {
  title?: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  suggestedTags?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: Project[];
  users: User[];
  defaultProjectId?: string;
}

export default function AiTaskCreate({ open, onClose, onCreated, projects, users, defaultProjectId }: Props) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedTask>({});
  const [form, setForm] = useState({
    title: '', description: '', priority: 'normal',
    dueDate: '', projectId: defaultProjectId ?? '', assignedTo: '',
  });
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    setError('');
    try {
      const result = await aiApi.parseTask(rawText);
      setParsed(result);
      setForm((prev) => ({
        ...prev,
        title: result.title ?? '',
        description: result.description ?? '',
        priority: result.priority ?? 'normal',
        dueDate: result.dueDate ?? '',
      }));
      setStep('review');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'AI parsing failed. Check ANTHROPIC_API_KEY.');
    } finally {
      setParsing(false);
    }
  };

  const handleEnhance = async () => {
    if (!form.title) return;
    setParsing(true);
    try {
      const enhanced = await aiApi.enhance(form.title, form.description);
      setForm((prev) => ({ ...prev, description: enhanced }));
    } finally {
      setParsing(false);
    }
  };

  const handleSuggestPriority = async () => {
    if (!form.title) return;
    setParsing(true);
    try {
      const result = await aiApi.suggestPriority(form.title, form.description);
      setForm((prev) => ({ ...prev, priority: result.priority }));
    } finally {
      setParsing(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        projectId: form.projectId || null,
        assignedTo: form.assignedTo || null,
        dueDate: form.dueDate || null,
      });
      onCreated();
      onClose();
      setStep('input');
      setRawText('');
      setParsed({});
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setRawText('');
    setParsed({});
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Task Creator
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe the task in plain English. AI will extract the title, description, priority, and due date.
            </p>
            <Textarea
              autoFocus
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse(); }}
              placeholder="e.g. Replace the failed UPS in server room B, assign to the on-call tech, needs to be done by Friday — it's affecting rack power redundancy"
              rows={5}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse} disabled={parsing || !rawText.trim()}>
                {parsing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…</> : <><Sparkles className="mr-2 h-4 w-4" /> Parse with AI</>}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review and adjust the extracted fields before creating.</p>

            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <button
                  type="button"
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                  onClick={handleEnhance}
                  disabled={parsing}
                >
                  {parsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Enhance with AI
                </button>
              </div>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Priority</Label>
                  <button
                    type="button"
                    className="text-xs text-purple-600 hover:underline disabled:opacity-50"
                    onClick={handleSuggestPriority}
                    disabled={parsing}
                  >
                    <Sparkles className="h-3 w-3 inline" /> Suggest
                  </button>
                </div>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Project</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assign To</Label>
                <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {parsed.estimatedMinutes && (
              <p className="text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 inline text-purple-500" /> AI estimate: ~{parsed.estimatedMinutes} min
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')}>← Back</Button>
              <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
                {saving ? 'Creating…' : 'Create Task'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
