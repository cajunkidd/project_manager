import { useEffect, useState } from 'react';
import { Plus, ChevronRight, ClipboardCheck, Settings } from 'lucide-react';
import { formsApi, projectsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import type { Project, User } from '@/types';

type FieldType = 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'user';

interface FormField {
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  options?: string[];
  sortOrder: number;
}

interface Form {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  defaultProject?: { id: string; name: string };
  defaultAssignee?: { id: string; displayName: string };
  defaultPriority: string;
  _count?: { fields: number; submissions: number };
  fields?: FormField[];
}

function FormBuilder({
  open,
  onClose,
  onSaved,
  form,
  projects,
  users,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  form?: Form;
  projects: Project[];
  users: User[];
}) {
  const [name, setName] = useState(form?.name ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [defaultProjectId, setDefaultProjectId] = useState(form?.defaultProject?.id ?? '');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(form?.defaultAssignee?.id ?? '');
  const [defaultPriority, setDefaultPriority] = useState(form?.defaultPriority ?? 'normal');
  const [fields, setFields] = useState<FormField[]>(
    form?.fields?.map((f: any) => ({ ...f, options: f.options ?? [] })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields([...fields, { label: '', fieldType: 'text', isRequired: false, options: [], sortOrder: fields.length }]);
  };

  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));

  const updateField = (i: number, update: Partial<FormField>) => {
    setFields(fields.map((f, idx) => idx === i ? { ...f, ...update } : f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        defaultProjectId: defaultProjectId || null,
        defaultAssigneeId: defaultAssigneeId || null,
        defaultPriority,
        fields: fields.map((f, i) => ({
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: f.options?.length ? f.options : undefined,
          sortOrder: i,
        })),
      };
      if (form) await formsApi.update(form.id, payload);
      else await formsApi.create(payload);
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
          <DialogTitle>{form ? 'Edit Form' : 'New Intake Form'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <Label>Form Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Default Project</Label>
              <Select value={defaultProjectId} onValueChange={setDefaultProjectId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Assignee</Label>
              <Select value={defaultAssigneeId} onValueChange={setDefaultAssigneeId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default Priority</Label>
              <Select value={defaultPriority} onValueChange={setDefaultPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'normal', 'high', 'urgent'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="mr-1 h-3 w-3" /> Add Field
              </Button>
            </div>
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">No fields yet. Add fields that submitters will fill out.</p>
            )}
            {fields.map((field, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    placeholder="Field label"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={field.fieldType}
                    onValueChange={(v) => updateField(i, { fieldType: v as FieldType })}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Long Text</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="user">User Picker</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeField(i)}
                    className="text-red-500 hover:text-red-600 px-2">✕</Button>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.isRequired}
                      onChange={(e) => updateField(i, { isRequired: e.target.checked })}
                    />
                    Required
                  </label>
                  {field.fieldType === 'dropdown' && (
                    <div className="flex-1">
                      <Input
                        placeholder="Options (comma-separated)"
                        value={field.options?.join(', ') ?? ''}
                        onChange={(e) => updateField(i, {
                          options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Form'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormSubmitModal({ form, onClose, onSubmitted }: { form: Form; onClose: () => void; onSubmitted: () => void }) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const users = [] as User[];

  const setValue = (label: string, value: any) => setValues((prev) => ({ ...prev, [label]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await formsApi.submit(form.id, values);
      setDone(true);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.name}</DialogTitle>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
        </DialogHeader>
        {done ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <ClipboardCheck className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold">Submitted!</p>
            <p className="text-sm text-muted-foreground">A task has been created from your request.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {(form.fields ?? []).map((field: any) => (
              <div key={field.label} className="space-y-1">
                <Label>
                  {field.label}
                  {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.fieldType === 'text' && (
                  <Input
                    value={values[field.label] ?? ''}
                    onChange={(e) => setValue(field.label, e.target.value)}
                    required={field.isRequired}
                  />
                )}
                {field.fieldType === 'textarea' && (
                  <Textarea
                    value={values[field.label] ?? ''}
                    onChange={(e) => setValue(field.label, e.target.value)}
                    required={field.isRequired}
                    rows={3}
                  />
                )}
                {field.fieldType === 'dropdown' && (
                  <Select value={values[field.label] ?? ''} onValueChange={(v) => setValue(field.label, v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.fieldType === 'date' && (
                  <Input
                    type="date"
                    value={values[field.label] ?? ''}
                    onChange={(e) => setValue(field.label, e.target.value)}
                    required={field.isRequired}
                  />
                )}
                {field.fieldType === 'checkbox' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values[field.label] ?? false}
                      onChange={(e) => setValue(field.label, e.target.checked)}
                    />
                    {field.label}
                  </label>
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Forms() {
  const { isManager } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editForm, setEditForm] = useState<Form | undefined>();
  const [submitForm, setSubmitForm] = useState<Form | undefined>();
  const [tab, setTab] = useState<'forms' | 'submissions'>('forms');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [f, s, p, u] = await Promise.all([
        formsApi.list(),
        formsApi.submissions(),
        projectsApi.list(),
        usersApi.list(),
      ]);
      setForms(f);
      setSubmissions(s);
      setProjects(p);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  };

  const loadFormWithFields = async (form: Form) => {
    const full = await formsApi.get(form.id);
    setEditForm(full);
    setShowBuilder(true);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Intake Forms</h1>
        {isManager && (
          <Button onClick={() => { setEditForm(undefined); setShowBuilder(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Form
          </Button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
        {(['forms', 'submissions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : tab === 'forms' ? (
        forms.length === 0 ? (
          <p className="text-muted-foreground">No forms yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{form.name}</h3>
                    {!form.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Inactive</span>
                    )}
                  </div>
                  {form.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{form.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{form._count?.fields ?? 0} fields</span>
                    <span>{form._count?.submissions ?? 0} submissions</span>
                  </div>
                  {form.defaultProject && (
                    <p className="mt-1 text-xs text-muted-foreground">→ {form.defaultProject.name}</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    {form.isActive && (
                      <Button size="sm" onClick={async () => {
                        const full = await formsApi.get(form.id);
                        setSubmitForm(full);
                      }}>
                        <ChevronRight className="mr-1 h-3 w-3" /> Submit Request
                      </Button>
                    )}
                    {isManager && (
                      <Button size="sm" variant="outline" onClick={() => loadFormWithFields(form)}>
                        <Settings className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        submissions.length === 0 ? (
          <p className="text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="rounded-lg border bg-white divide-y">
            {submissions.map((s: any) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.form?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    By {s.submittedBy?.displayName} · {formatDate(s.createdAt)}
                  </p>
                </div>
                {s.createdTask && (
                  <div className="text-sm text-muted-foreground">
                    Task: <span className="font-medium">{s.createdTask.title}</span>
                    <span className="ml-2 text-xs bg-muted rounded px-1">{s.createdTask.status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <FormBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSaved={load}
        form={editForm}
        projects={projects}
        users={users}
      />
      {submitForm && (
        <FormSubmitModal
          form={submitForm}
          onClose={() => setSubmitForm(undefined)}
          onSubmitted={load}
        />
      )}
    </div>
  );
}
