import { useEffect, useState } from 'react';
import { contractsApi } from '../api/contracts';
import { glCodesApi } from '../api/glCodes';
import type { Contract, GLCode } from '../types';
import { formatDate } from '../utils/format';

const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;

function money(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [glCodes, setGlCodes] = useState<GLCode[]>([]);
  const [glFilter, setGlFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    contractsApi
      .list({ glCodeId: glFilter || undefined })
      .then(setContracts)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    glCodesApi.list({ active: true }).then(setGlCodes).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glFilter]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Contracts</h1>
        <select value={glFilter} onChange={(e) => setGlFilter(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All GL codes</option>
          {glCodes.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <CreateContractCard glCodes={glCodes} onDone={reload} />

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Contracts ({contracts.length})</h2>
        {contracts.length === 0 ? (
          <div className="muted">No contracts yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>GL code</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <ContractRow key={c.id} contract={c} glCodes={glCodes} onDone={reload} onError={setError} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContractRow({
  contract,
  glCodes,
  onDone,
  onError,
}: {
  contract: Contract;
  glCodes: GLCode[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  async function setGlCode(glCodeId: string) {
    try {
      await contractsApi.update(contract.id, { glCodeId: glCodeId || null });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <tr>
      <td>
        <strong>{contract.contractNumber}</strong>
      </td>
      <td>{contract.title}</td>
      <td className="muted">{contract.vendor ?? '—'}</td>
      <td>{money(contract.amount)}</td>
      <td>
        <span className="badge">{contract.status}</span>
      </td>
      <td>
        <select value={contract.glCodeId ?? ''} onChange={(e) => setGlCode(e.target.value)}>
          <option value="">— Unassigned —</option>
          {glCodes.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function CreateContractCard({ glCodes, onDone }: { glCodes: GLCode[]; onDone: () => void }) {
  const [contractNumber, setContractNumber] = useState('');
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [glCodeId, setGlCodeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await contractsApi.create({
        contractNumber,
        title,
        vendor: vendor || null,
        amount: amount ? Number(amount) : null,
        status,
        glCodeId: glCodeId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      setContractNumber('');
      setTitle('');
      setVendor('');
      setAmount('');
      setStatus('draft');
      setGlCodeId('');
      setStartDate('');
      setEndDate('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>New contract</h2>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={submit} className="form-grid">
        <div>
          <label>Contract number</label>
          <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} required />
        </div>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Vendor</label>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div>
          <label>Amount (USD)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>GL code</label>
          <select value={glCodeId} onChange={(e) => setGlCodeId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {glCodes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="full">
          <button type="submit" className="btn">
            Create contract
          </button>
        </div>
      </form>
    </div>
  );
}
