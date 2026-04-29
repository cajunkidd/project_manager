import { useEffect, useState } from 'react';
import { Mail, Send, Loader2 } from 'lucide-react';
import { authApi, emailApi } from '@/lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Profile {
  email: string;
  emailNotifications: boolean;
  emailDigest: boolean;
}

export default function EmailPreferences({ canSendDigestAll }: { canSendDigestAll: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<'me' | 'all' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      authApi.me().then((u) => setProfile({ email: u.email, emailNotifications: u.emailNotifications, emailDigest: u.emailDigest })),
      emailApi.status().then((s) => setAvailable(s.available)).catch(() => setAvailable(false)),
    ]);
  }, []);

  const updatePref = async (patch: Partial<Profile>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    setSaving(true);
    try {
      await authApi.updateMe(patch);
    } finally {
      setSaving(false);
    }
  };

  const sendMyDigest = async () => {
    setSending('me');
    setMessage('');
    try {
      const result = await emailApi.sendMyDigest();
      setMessage(result.sent ? 'Digest sent to your inbox.' : 'Nothing to send (no overdue or due-soon tasks).');
    } catch {
      setMessage('Failed to send digest.');
    } finally {
      setSending(null);
    }
  };

  const sendDigestAll = async () => {
    if (!confirm('Send a daily digest to all opted-in users?')) return;
    setSending('all');
    setMessage('');
    try {
      const result = await emailApi.sendDigestAll();
      setMessage(`Sent to ${result.sent} user(s), skipped ${result.skipped}.`);
    } catch {
      setMessage('Failed to send digests.');
    } finally {
      setSending(null);
    }
  };

  if (!profile) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {available === false && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Email is not configured on the server. Set SMTP_HOST in the backend environment to enable delivery.
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          Sending to <code>{profile.email}</code>
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={profile.emailNotifications}
            onChange={(e) => updatePref({ emailNotifications: e.target.checked })}
            disabled={saving}
          />
          <span className="text-sm">
            <span className="font-medium">Notification emails</span>
            <span className="block text-xs text-muted-foreground">
              Get an email when you're assigned a task or mentioned in a comment.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={profile.emailDigest}
            onChange={(e) => updatePref({ emailDigest: e.target.checked })}
            disabled={saving}
          />
          <span className="text-sm">
            <span className="font-medium">Daily digest</span>
            <span className="block text-xs text-muted-foreground">
              Summary of overdue and upcoming tasks. Sent when triggered by an admin or scheduler.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={sendMyDigest} disabled={sending !== null || !available}>
            {sending === 'me'
              ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending…</>
              : <><Send className="mr-1 h-3 w-3" /> Send Me a Test Digest</>}
          </Button>
          {canSendDigestAll && (
            <Button size="sm" variant="outline" onClick={sendDigestAll} disabled={sending !== null || !available}>
              {sending === 'all'
                ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending…</>
                : <>Send Digest to All Opted-In Users</>}
            </Button>
          )}
        </div>

        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
