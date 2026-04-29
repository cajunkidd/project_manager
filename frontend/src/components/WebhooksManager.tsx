import { useEffect, useState } from 'react';
import { Plus, Trash2, Webhook, Eye, EyeOff, Copy, RefreshCw, History } from 'lucide-react';
import { webhooksApi } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { formatDate } from '@/lib/utils';

const EVENTS = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'project.created',
  'project.updated',
  'form.submitted',
] as const;

interface Subscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: { displayName: string };
  _count?: { deliveries: number };
}

interface Delivery {
  id: string;
  event: string;
  status: string;
  statusCode: number | null;
  attempts: number;
  error: string | null;
  deliveredAt: string;
}

function WebhookForm({
  open, onClose, onSaved, sub,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sub?: Subscription;
}) {
  const isEdit = !!sub;
  const [form, setForm] = useState({
    name: sub?.name ?? '',
    url: sub?.url ?? '',
    events: sub?.events ?? ['task.created'],
    isActive: sub?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleEvent = (e: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(e) ? prev.events.filter((x) => x !== e) : [...prev.events, e],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.events.length === 0) {
      setError('Select at least one event.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) await webhooksApi.update(sub!.id, form);
      else await webhooksApi.create(form);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save webhook.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Webhook' : 'New Webhook'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Slack notifier" />
          </div>
          <div className="space-y-1">
            <Label>URL *</Label>
            <Input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
              placeholder="https://hooks.example.com/abc123"
            />
          </div>
          <div className="space-y-2">
            <Label>Events *</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {EVENTS.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.events.includes(evt)}
                    onChange={() => toggleEvent(evt)}
                  />
                  <code className="text-xs">{evt}</code>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({
  open, onClose, sub,
}: { open: boolean; onClose: () => void; sub?: Subscription }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!sub) return;
    setLoading(true);
    try {
      const data = await webhooksApi.deliveries(sub.id);
      setDeliveries(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, sub?.id]);

  const redeliver = async (id: string) => {
    await webhooksApi.redeliver(id);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recent Deliveries — {sub?.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    d.status === 'delivered'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {d.status}{d.statusCode ? ` ${d.statusCode}` : ''}
                </span>
                <code className="text-xs flex-shrink-0">{d.event}</code>
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {d.error ?? `Attempt ${d.attempts}`}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(d.deliveredAt)}
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => redeliver(d.id)} title="Redeliver">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function WebhooksManager() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | undefined>();
  const [showDeliveries, setShowDeliveries] = useState<Subscription | undefined>();
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const data = await webhooksApi.list();
      setSubs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (s: Subscription) => {
    if (!confirm(`Delete webhook "${s.name}"?`)) return;
    await webhooksApi.remove(s.id);
    load();
  };

  const toggleSecret = (id: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret).catch(() => {});
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Webhooks
        </CardTitle>
        <Button size="sm" onClick={() => { setEditSub(undefined); setShowForm(true); }}>
          <Plus className="mr-1 h-3 w-3" /> New Webhook
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhooks configured. Webhooks deliver event payloads to external URLs with HMAC-SHA256 signatures.
          </p>
        ) : (
          <div className="divide-y">
            {subs.map((s) => (
              <div key={s.id} className="py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      {!s.isActive && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">Paused</span>
                      )}
                      {s._count && (
                        <span className="text-xs text-muted-foreground">
                          {s._count.deliveries} deliveries
                        </span>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground truncate block">{s.url}</code>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setShowDeliveries(s)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditSub(s); setShowForm(true); }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.events.map((e) => (
                    <code key={e} className="text-xs bg-muted px-1.5 py-0.5 rounded">{e}</code>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Secret:</span>
                  <code className="flex-1 truncate">
                    {revealedSecrets.has(s.id) ? s.secret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleSecret(s.id)}>
                    {revealedSecrets.has(s.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copySecret(s.secret)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <WebhookForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={load}
          sub={editSub}
        />
        <DeliveriesDialog
          open={!!showDeliveries}
          onClose={() => setShowDeliveries(undefined)}
          sub={showDeliveries}
        />
      </CardContent>
    </Card>
  );
}
