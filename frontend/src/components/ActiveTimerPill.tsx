import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveTimer } from '../timer/ActiveTimerContext';
import { formatDuration } from '../utils/format';

export function ActiveTimerPill() {
  const { active, stop } = useActiveTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const elapsed = Math.floor((now - new Date(active.startedAt).getTime()) / 1000);
  const title = active.task?.title ?? 'task';

  return (
    <div
      className="user-pill"
      style={{
        background: 'rgba(40, 167, 69, 0.12)',
        border: '1px solid rgba(40, 167, 69, 0.4)',
        borderRadius: 999,
        padding: '2px 10px',
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 11, opacity: 0.8 }}>● tracking</span>
      <Link
        to={`/tasks/${active.taskId}`}
        style={{ fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {title}
      </Link>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(elapsed)}
      </strong>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '0 8px', fontSize: 11 }}
        onClick={() => stop().catch(() => undefined)}
      >
        Stop
      </button>
    </div>
  );
}
