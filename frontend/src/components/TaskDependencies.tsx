import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, X, Plus } from 'lucide-react';
import { dependenciesApi, tasksApi } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { StatusBadge } from './StatusBadge';

interface DepTask {
  depId: string;
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: { id: string; displayName: string } | null;
}

interface Props {
  taskId: string;
}

export default function TaskDependencies({ taskId }: Props) {
  const [blockedBy, setBlockedBy] = useState<DepTask[]>([]);
  const [blocking, setBlocking] = useState<DepTask[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const load = async () => {
    const data = await dependenciesApi.get(taskId);
    setBlockedBy(data.blockedBy ?? []);
    setBlocking(data.blocking ?? []);
  };

  useEffect(() => { load(); }, [taskId]);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await tasksApi.list({ search: q });
      setSearchResults(results.filter((t: any) => t.id !== taskId));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const addDep = async (dependsOnTaskId: string) => {
    setAdding(true);
    try {
      await dependenciesApi.add(taskId, dependsOnTaskId);
      setSearch('');
      setSearchResults([]);
      setShowSearch(false);
      load();
    } finally {
      setAdding(false);
    }
  };

  const removeDep = async (depId: string) => {
    await dependenciesApi.remove(taskId, depId);
    load();
  };

  const total = blockedBy.length + blocking.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Dependencies
          {total > 0 && <span className="text-xs text-muted-foreground font-normal">({total})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockedBy.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Blocked by</p>
            {blockedBy.map((t) => (
              <DepRow key={t.depId} task={t} onRemove={() => removeDep(t.depId)} />
            ))}
          </div>
        )}
        {blocking.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Blocking</p>
            {blocking.map((t) => (
              <DepRow key={t.depId} task={t} onRemove={() => removeDep(t.depId)} />
            ))}
          </div>
        )}
        {total === 0 && !showSearch && (
          <p className="text-sm text-muted-foreground">No dependencies.</p>
        )}

        {showSearch ? (
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
            {searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {searchResults.map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    disabled={adding}
                    onClick={() => addDep(t.id)}
                  >
                    <StatusBadge status={t.status} />
                    <span className="flex-1 truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowSearch(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add Dependency
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DepRow({ task, onRemove }: { task: DepTask; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <StatusBadge status={task.status} />
      <Link to={`/tasks/${task.id}`} className="flex-1 truncate hover:underline">
        {task.title}
      </Link>
      {task.assignee && (
        <span className="text-xs text-muted-foreground flex-shrink-0">{task.assignee.displayName}</span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground hover:text-red-600 flex-shrink-0"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
