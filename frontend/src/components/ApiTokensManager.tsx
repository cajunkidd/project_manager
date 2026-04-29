import { useEffect, useState } from 'react';
import { Plus, Key, Copy, AlertCircle } from 'lucide-react';
import { apiTokensApi } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { formatDate } from '@/lib/utils';

interface Token {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; displayName: string };
}

function CreateTokenDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', expiresAt: '' });
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await apiTokensApi.create({
        name: form.name,
        expiresAt: form.expiresAt || null,
      });
      setCreated({ token: result.token, name: result.name });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm({ name: '', expiresAt: '' });
    setCreated(null);
    setCopied(false);
    onClose();
  };

  const copy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? 'Token Created' : 'New API Token'}</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 flex gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Copy this token now.</p>
                <p className="text-xs">It won't be shown again. If you lose it, revoke and create a new one.</p>
              </div>
            </div>
            <div className="bg-muted rounded p-3 font-mono text-xs break-all">
              {created.token}
            </div>
            <Button onClick={copy} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Token'}
            </Button>
            <DialogFooter>
              <Button onClick={reset}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CI integration"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tokens act with your account's permissions. Use the header
              <code className="bg-muted px-1 mx-1">Authorization: Bearer pmat_...</code>
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.name}>
                {saving ? 'Creating…' : 'Create Token'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ApiTokensManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const data = await apiTokensApi.list();
      setTokens(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (t: Token) => {
    if (!confirm(`Revoke token "${t.name}"? It will stop working immediately.`)) return;
    await apiTokensApi.revoke(t.id);
    load();
  };

  const isExpired = (t: Token) =>
    t.expiresAt ? new Date(t.expiresAt) < new Date() : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Tokens
        </CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" /> New Token
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API tokens. Use these for external systems calling the API. Tokens act with your account's permissions.
          </p>
        ) : (
          <div className="divide-y">
            {tokens.map((t) => {
              const dead = !!t.revokedAt || isExpired(t);
              return (
                <div key={t.id} className={`py-2.5 flex items-center gap-3 ${dead ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      {t.revokedAt && <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-xs">Revoked</span>}
                      {!t.revokedAt && isExpired(t) && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">Expired</span>}
                    </div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <code>{t.prefix}…</code>
                      <span>Created {formatDate(t.createdAt)}</span>
                      {t.lastUsedAt && <span>Used {formatDate(t.lastUsedAt)}</span>}
                      {t.expiresAt && <span>Expires {formatDate(t.expiresAt)}</span>}
                      {t.createdBy && <span>by {t.createdBy.displayName}</span>}
                    </div>
                  </div>
                  {!dead && (
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => revoke(t)}>
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <CreateTokenDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      </CardContent>
    </Card>
  );
}
