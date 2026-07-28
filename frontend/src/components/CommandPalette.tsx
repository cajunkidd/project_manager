import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  to?: string;
  run?: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelected(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Let the topbar hint button open the palette without prop-drilling.
  useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
      setQuery('');
      setSelected(0);
    }
    window.addEventListener('open-command-palette', onOpenEvent);
    return () => window.removeEventListener('open-command-palette', onOpenEvent);
  }, []);

  if (!open) return null;

  function execute(command: Command) {
    setOpen(false);
    if (command.to) navigate(command.to);
    command.run?.();
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault();
      execute(filtered[selected]);
    }
  }

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder="Jump to a page or run a command…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          aria-label="Search commands"
        />
        {filtered.length === 0 ? (
          <div className="cmdk-empty">No matches for “{query}”</div>
        ) : (
          <ul className="cmdk-list">
            {filtered.map((command, i) => (
              <li key={command.id}>
                <button
                  type="button"
                  className={`cmdk-item${i === selected ? ' selected' : ''}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => execute(command)}
                >
                  {command.icon}
                  {command.label}
                  {command.hint ? <span className="cmdk-hint">{command.hint}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="cmdk-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
