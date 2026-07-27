import { useEffect, useState } from 'react';
import { glCodesApi, type GLCodeUploadResult } from '../api/glCodes';
import type { GLCode } from '../types';

export function GLCodesPage() {
  const [glCodes, setGlCodes] = useState<GLCode[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    glCodesApi
      .list({ search: search || undefined })
      .then(setGlCodes)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>GL Codes</h1>
        <input
          placeholder="Search codes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
      </div>
      {error ? <div className="error">{error}</div> : null}

      <UploadCard onDone={reload} />
      <AddGLCodeCard onDone={reload} />

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Chart of accounts ({glCodes.length})</h2>
        {glCodes.length === 0 ? (
          <div className="muted">No GL codes yet. Upload your chart of accounts to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Linked</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {glCodes.map((g) => (
                <GLCodeRow key={g.id} glCode={g} onDone={reload} onError={setError} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function GLCodeRow({
  glCode,
  onDone,
  onError,
}: {
  glCode: GLCode;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const linked = (glCode._count?.contracts ?? 0) + (glCode._count?.invoices ?? 0);

  async function toggleActive() {
    try {
      await glCodesApi.update(glCode.id, { isActive: !glCode.isActive });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove() {
    try {
      await glCodesApi.remove(glCode.id);
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <tr>
      <td>
        <strong>{glCode.code}</strong>
      </td>
      <td>{glCode.name}</td>
      <td className="muted">{glCode.category ?? '—'}</td>
      <td className="muted">
        {glCode._count ? `${glCode._count.contracts} contracts · ${glCode._count.invoices} invoices` : '—'}
      </td>
      <td>
        <span className={`badge${glCode.isActive ? ' status-active' : ' status-cancelled'}`}>
          {glCode.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button type="button" className="btn btn-secondary" onClick={toggleActive}>
          {glCode.isActive ? 'Deactivate' : 'Activate'}
        </button>{' '}
        {linked === 0 ? (
          <button type="button" className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function AddGLCodeCard({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await glCodesApi.create({
        code,
        name,
        category: category || null,
        description: description || null,
      });
      setCode('');
      setName('');
      setCategory('');
      setDescription('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Add a single GL code</h2>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={submit} className="form-grid">
        <div>
          <label>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6000-100" required />
        </div>
        <div>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office supplies" required />
        </div>
        <div>
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="expense" />
        </div>
        <div>
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="full">
          <button type="submit" className="btn">
            Add GL code
          </button>
        </div>
      </form>
    </div>
  );
}

function UploadCard({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<GLCodeUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const trimmed = text.trim();
      // Accept a pasted JSON array of rows, otherwise treat the input as CSV.
      let payload: { codes?: GLCodeUploadRowInput[]; csv?: string };
      if (trimmed.startsWith('[')) {
        payload = { codes: JSON.parse(trimmed) };
      } else {
        payload = { csv: trimmed };
      }
      const res = await glCodesApi.upload(payload);
      setResult(res);
      setText('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Upload chart of accounts</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        Paste CSV (columns: <code>code,name,description,category</code>) or a JSON array of GL code
        objects. Existing codes are updated in place; new codes are created.
      </p>
      {error ? <div className="error">{error}</div> : null}
      {result ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>
            Imported {result.total} GL code{result.total === 1 ? '' : 's'} — {result.created} created,{' '}
            {result.updated} updated.
          </strong>
          {result.errors.length > 0 ? (
            <ul style={{ margin: '8px 0 0' }}>
              {result.errors.map((er, i) => (
                <li key={i} className="error">
                  Row {er.row}
                  {er.code ? ` (${er.code})` : ''}: {er.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={upload}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'code,name,description,category\n6000-100,Office supplies,,expense\n4000-000,Product revenue,,revenue'}
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" className="btn" disabled={busy || !text.trim()}>
            {busy ? 'Uploading…' : 'Upload GL codes'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface GLCodeUploadRowInput {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive?: boolean;
}
