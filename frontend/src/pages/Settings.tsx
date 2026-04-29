import { useEffect, useState } from 'react';
import { Plus, UserX, UserCheck } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { User } from '@/types';

const ROLES = ['admin', 'manager', 'user', 'viewer'];

function UserForm({
  open, onClose, onSaved, user,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; user?: User;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? '',
    displayName: user?.displayName ?? '',
    password: '',
    role: user?.role ?? 'user',
    department: user?.department ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const data: any = {
          displayName: form.displayName,
          role: form.role,
          department: form.department,
        };
        if (form.password) data.password = form.password;
        await usersApi.update(user!.id, data);
      } else {
        await usersApi.create(form);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'New User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Display Name *</Label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={isEdit}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Password {isEdit && <span className="text-muted-foreground text-xs">(leave blank to keep)</span>}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!isEdit}
              minLength={8}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
          </div>
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

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  user: 'bg-gray-100 text-gray-700',
  viewer: 'bg-purple-100 text-purple-700',
};

export default function Settings() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>();
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeactivate = async (u: User) => {
    if (!confirm(`Deactivate ${u.displayName}?`)) return;
    await usersApi.deactivate(u.id);
    load();
  };

  const handleReactivate = async (u: User) => {
    await usersApi.update(u.id, { isActive: true });
    load();
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Your Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {currentUser?.displayName}</div>
            <div><span className="text-muted-foreground">Email:</span> {currentUser?.email}</div>
            <div><span className="text-muted-foreground">Role:</span> {currentUser?.role}</div>
            <div><span className="text-muted-foreground">Department:</span> {currentUser?.department ?? '—'}</div>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">User management requires admin privileges.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings — Users</h1>
        <Button onClick={() => { setEditUser(undefined); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New User
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-muted/30 ${!u.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium">{u.displayName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGES[u.role] ?? 'bg-gray-100'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.department ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="text-green-600 text-xs font-medium">Active</span>
                    ) : (
                      <span className="text-gray-400 text-xs">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setEditUser(u); setShowForm(true); }}
                      >
                        Edit
                      </Button>
                      {u.isActive ? (
                        <Button
                          size="sm" variant="ghost" className="text-red-500"
                          onClick={() => handleDeactivate(u)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? "Can't deactivate yourself" : 'Deactivate'}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="text-green-600"
                          onClick={() => handleReactivate(u)}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={load}
        user={editUser}
      />
    </div>
  );
}
