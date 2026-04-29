import { useEffect, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { timeEntriesApi } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface TimeEntry {
  id: string;
  minutes: number;
  notes?: string;
  loggedAt: string;
  user: { id: string; displayName: string };
}

interface Props {
  taskId: string;
  currentUserId?: string;
}

export default function TimeLogger({ taskId, currentUserId }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [form, setForm] = useState({ minutes: '', notes: '', loggedAt: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await timeEntriesApi.getForTask(taskId);
    setEntries(data.entries ?? []);
    setTotalMinutes(data.totalMinutes ?? 0);
  };

  useEffect(() => { load(); }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(form.minutes);
    if (!mins || mins <= 0) return;
    setSaving(true);
    try {
      await timeEntriesApi.create(taskId, {
        minutes: mins,
        notes: form.notes || undefined,
        loggedAt: form.loggedAt || undefined,
      });
      setForm({ minutes: '', notes: '', loggedAt: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await timeEntriesApi.delete(id);
    load();
  };

  const fmt = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Tracking
          {totalMinutes > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Total: {fmt(totalMinutes)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fmt(e.minutes)}</span>
                    <span className="text-muted-foreground text-xs">by {e.user.displayName}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(e.loggedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {e.notes && <p className="text-muted-foreground text-xs mt-0.5">{e.notes}</p>}
                </div>
                {e.user.id === currentUserId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(e.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Log Time</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Minutes *</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 90"
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.loggedAt}
                onChange={(e) => setForm({ ...form, loggedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="What did you work on?"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <Button type="submit" size="sm" disabled={saving || !form.minutes}>
            {saving ? 'Saving…' : 'Log Time'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
