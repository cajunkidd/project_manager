import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchApi, type SearchResults } from '../api/search';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/format';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuery) {
      setResults(null);
      return;
    }
    searchApi
      .search(initialQuery)
      .then(setResults)
      .catch((err) => setError(err.message));
  }, [initialQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    setParams(next);
  }

  const totalHits = results
    ? results.tasks.length + results.projects.length + results.comments.length
    : 0;

  return (
    <div className="col">
      <div className="page-header">
        <h1>Search</h1>
      </div>
      <form onSubmit={onSubmit} className="card">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a query and press enter…"
          autoFocus
        />
      </form>
      {error ? <div className="error">{error}</div> : null}

      {!initialQuery ? (
        <div className="muted">Type something to search.</div>
      ) : results === null ? (
        <div className="muted">Searching…</div>
      ) : totalHits === 0 ? (
        <div className="muted">No matches for "{initialQuery}".</div>
      ) : (
        <>
          {results.projects.length > 0 ? (
            <div className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
                Projects ({results.projects.length})
              </h2>
              <ul className="ai-bullets">
                {results.projects.map((hit) => (
                  <li key={hit.id}>
                    <Link to={hit.url}>{hit.title}</Link>
                    {hit.snippet ? <div className="muted" style={{ fontSize: 12 }}>{hit.snippet}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {results.tasks.length > 0 ? (
            <div className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Tasks ({results.tasks.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {results.tasks.map((hit) => (
                    <tr key={hit.id}>
                      <td>
                        <Link to={hit.url}>{hit.title}</Link>
                        {hit.snippet ? (
                          <div className="muted" style={{ fontSize: 12 }}>{hit.snippet}</div>
                        ) : null}
                      </td>
                      <td className="muted">{hit.projectName ?? '—'}</td>
                      <td>{hit.status ? <StatusBadge status={hit.status} /> : null}</td>
                      <td className="muted">{formatDate(hit.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {results.comments.length > 0 ? (
            <div className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
                Comments ({results.comments.length})
              </h2>
              <ul className="ai-bullets">
                {results.comments.map((hit) => (
                  <li key={hit.id}>
                    <Link to={hit.url}>{hit.title}</Link>
                    {hit.snippet ? <div className="muted" style={{ fontSize: 12 }}>{hit.snippet}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
