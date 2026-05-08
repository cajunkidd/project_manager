import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi, type SearchResults } from '../api/search';

const DEBOUNCE_MS = 200;

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const handle = window.setTimeout(() => {
      searchApi
        .search(query)
        .then(setResults)
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const totalHits = results
    ? results.tasks.length + results.projects.length + results.comments.length
    : 0;

  function go(url: string) {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(url);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <form onSubmit={submitSearch}>
        <input
          className="search-input"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </form>
      {open && results && totalHits > 0 ? (
        <div className="search-menu">
          {results.tasks.length > 0 ? (
            <div className="search-section">
              <div className="search-section-label">Tasks</div>
              {results.tasks.slice(0, 5).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="search-item"
                  onClick={() => go(hit.url)}
                >
                  <div className="search-item-title">{hit.title}</div>
                  {hit.snippet ? <div className="search-item-snippet">{hit.snippet}</div> : null}
                </button>
              ))}
            </div>
          ) : null}
          {results.projects.length > 0 ? (
            <div className="search-section">
              <div className="search-section-label">Projects</div>
              {results.projects.slice(0, 3).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="search-item"
                  onClick={() => go(hit.url)}
                >
                  <div className="search-item-title">{hit.title}</div>
                  {hit.snippet ? <div className="search-item-snippet">{hit.snippet}</div> : null}
                </button>
              ))}
            </div>
          ) : null}
          {results.comments.length > 0 ? (
            <div className="search-section">
              <div className="search-section-label">Comments</div>
              {results.comments.slice(0, 3).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="search-item"
                  onClick={() => go(hit.url)}
                >
                  <div className="search-item-title">{hit.title}</div>
                  {hit.snippet ? <div className="search-item-snippet">{hit.snippet}</div> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="search-footer">
            <button
              type="button"
              className="link"
              onClick={() => go(`/search?q=${encodeURIComponent(query)}`)}
            >
              See all results →
            </button>
          </div>
        </div>
      ) : open && query.trim() && results && totalHits === 0 ? (
        <div className="search-menu">
          <div className="search-empty muted">No matches.</div>
        </div>
      ) : null}
    </div>
  );
}
