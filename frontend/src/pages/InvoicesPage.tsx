import { useEffect, useState } from 'react';
import { contractsApi } from '../api/contracts';
import { glCodesApi } from '../api/glCodes';
import { invoicesApi } from '../api/invoices';
import type { Contract, GLCode, Invoice } from '../types';
import { formatDate } from '../utils/format';

const INVOICE_STATUSES = ['pending', 'approved', 'paid', 'void'] as const;

function money(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [glCodes, setGlCodes] = useState<GLCode[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [glFilter, setGlFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    invoicesApi
      .list({ glCodeId: glFilter || undefined })
      .then(setInvoices)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    glCodesApi.list({ active: true }).then(setGlCodes).catch(() => undefined);
    contractsApi.list().then(setContracts).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glFilter]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Invoices</h1>
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

      <CreateInvoiceCard glCodes={glCodes} contracts={contracts} onDone={reload} />

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Invoices ({invoices.length})</h2>
        {invoices.length === 0 ? (
          <div className="muted">No invoices yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
                <th>Contract</th>
                <th>GL code</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} glCodes={glCodes} onDone={reload} onError={setError} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InvoiceRow({
  invoice,
  glCodes,
  onDone,
  onError,
}: {
  invoice: Invoice;
  glCodes: GLCode[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  async function setGlCode(glCodeId: string) {
    try {
      await invoicesApi.update(invoice.id, { glCodeId: glCodeId || null });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <tr>
      <td>
        <strong>{invoice.invoiceNumber}</strong>
      </td>
      <td className="muted">{invoice.vendor ?? '—'}</td>
      <td>{money(invoice.amount)}</td>
      <td className="muted">{formatDate(invoice.dueDate)}</td>
      <td>
        <span className="badge">{invoice.status}</span>
      </td>
      <td className="muted">{invoice.contract?.contractNumber ?? '—'}</td>
      <td>
        <select value={invoice.glCodeId ?? ''} onChange={(e) => setGlCode(e.target.value)}>
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

function CreateInvoiceCard({
  glCodes,
  contracts,
  onDone,
}: {
  glCodes: GLCode[];
  contracts: Contract[];
  onDone: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string>('pending');
  const [glCodeId, setGlCodeId] = useState('');
  const [contractId, setContractId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await invoicesApi.create({
        invoiceNumber,
        vendor: vendor || null,
        amount: Number(amount || 0),
        status,
        glCodeId: glCodeId || null,
        contractId: contractId || null,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
      });
      setInvoiceNumber('');
      setVendor('');
      setAmount('');
      setStatus('pending');
      setGlCodeId('');
      setContractId('');
      setIssueDate('');
      setDueDate('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>New invoice</h2>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={submit} className="form-grid">
        <div>
          <label>Invoice number</label>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
        </div>
        <div>
          <label>Vendor</label>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div>
          <label>Amount (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {INVOICE_STATUSES.map((s) => (
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
          <label>Contract (optional)</label>
          <select value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">— None —</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNumber} — {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Issue date</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label>Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="full">
          <button type="submit" className="btn">
            Create invoice
          </button>
        </div>
      </form>
    </div>
  );
}
