import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formsApi } from '../api/forms';
import type { FormField, IntakeForm } from '../types';

function parseOptions(field: FormField): string[] {
  if (!field.options) return [];
  try {
    return JSON.parse(field.options) as string[];
  } catch {
    return [];
  }
}

export function FormSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    formsApi.get(id).then(setForm).catch((err) => setError(err.message));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await formsApi.submit(id, values);
      navigate(`/tasks/${result.task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <div className="error">{error}</div>;
  if (!form) return <div className="muted">Loading…</div>;

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <Link to="/forms" className="muted" style={{ fontSize: 13 }}>
            ← Forms
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>{form.name}</h1>
          {form.description ? <p className="muted">{form.description}</p> : null}
        </div>
      </div>
      <div className="card">
        <form onSubmit={onSubmit} className="col">
          {form.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
            />
          ))}
          {error ? <div className="error">{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldInputProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const required = field.isRequired;
  const id = `field-${field.id}`;
  const labelText = `${field.label}${required ? ' *' : ''}`;

  if (field.fieldType === 'textarea') {
    return (
      <div>
        <label htmlFor={id}>{labelText}</label>
        <textarea
          id={id}
          rows={4}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      </div>
    );
  }

  if (field.fieldType === 'dropdown') {
    const options = parseOptions(field);
    return (
      <div>
        <label htmlFor={id}>{labelText}</label>
        <select
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.fieldType === 'checkbox') {
    return (
      <div className="row">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 'auto' }}
        />
        <label htmlFor={id} style={{ marginBottom: 0 }}>
          {labelText}
        </label>
      </div>
    );
  }

  if (field.fieldType === 'date') {
    return (
      <div>
        <label htmlFor={id}>{labelText}</label>
        <input
          id={id}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id}>{labelText}</label>
      <input
        id={id}
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
