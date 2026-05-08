import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formsApi, type FormFieldInput } from '../api/forms';
import { projectsApi } from '../api/projects';
import { http } from '../api/client';
import type { IntakeForm, Priority, Project, User } from '../types';

interface FormState {
  name: string;
  description: string;
  defaultProjectId: string;
  defaultAssigneeId: string;
  defaultPriority: Priority;
  isActive: boolean;
  fields: (FormFieldInput & { _key: string })[];
}

const FIELD_TYPES = [
  { value: 'text', label: 'Single line text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
] as const;

function emptyField(): FormState['fields'][number] {
  return {
    _key: Math.random().toString(36).slice(2),
    label: '',
    fieldType: 'text',
    isRequired: false,
    options: null,
  };
}

export function FormBuilderPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>({
    name: '',
    description: '',
    defaultProjectId: '',
    defaultAssigneeId: '',
    defaultPriority: 'normal',
    isActive: true,
    fields: [emptyField()],
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
    http.get<User[]>('/users').then(setUsers).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    formsApi
      .get(id)
      .then((f: IntakeForm) => {
        setState({
          name: f.name,
          description: f.description ?? '',
          defaultProjectId: f.defaultProjectId ?? '',
          defaultAssigneeId: f.defaultAssigneeId ?? '',
          defaultPriority: f.defaultPriority,
          isActive: f.isActive,
          fields: f.fields.map((field) => ({
            _key: field.id,
            id: field.id,
            label: field.label,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            options: field.options ? (JSON.parse(field.options) as string[]) : null,
            sortOrder: field.sortOrder,
          })),
        });
      })
      .catch((err) => setError(err.message));
  }, [mode, id]);

  function updateField(key: string, patch: Partial<FormFieldInput>) {
    setState((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f._key === key ? { ...f, ...patch } : f)),
    }));
  }

  function removeField(key: string) {
    setState((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f._key !== key),
    }));
  }

  function addField() {
    setState((prev) => ({ ...prev, fields: [...prev.fields, emptyField()] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: state.name,
        description: state.description || null,
        defaultProjectId: state.defaultProjectId || null,
        defaultAssigneeId: state.defaultAssigneeId || null,
        defaultPriority: state.defaultPriority,
        isActive: state.isActive,
        fields: state.fields
          .filter((f) => f.label.trim())
          .map((f, idx) => ({
            label: f.label,
            fieldType: f.fieldType,
            isRequired: f.isRequired ?? false,
            options:
              f.fieldType === 'dropdown'
                ? typeof f.options === 'string'
                  ? null
                  : f.options ?? null
                : null,
            sortOrder: idx,
          })),
      };
      if (mode === 'new') {
        const created = await formsApi.create(payload);
        navigate(`/forms/${created.id}/edit`);
      } else if (id) {
        await formsApi.update(id, payload);
        navigate('/forms');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <Link to="/forms" className="muted" style={{ fontSize: 13 }}>
            ← Forms
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>
            {mode === 'new' ? 'New form' : 'Edit form'}
          </h1>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={onSubmit} className="col">
        <div className="card form-grid">
          <div className="full">
            <label htmlFor="form-name">Form name</label>
            <input
              id="form-name"
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              required
            />
          </div>
          <div className="full">
            <label htmlFor="form-desc">Description</label>
            <textarea
              id="form-desc"
              rows={2}
              value={state.description}
              onChange={(e) => setState({ ...state, description: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="form-proj">Default project</label>
            <select
              id="form-proj"
              value={state.defaultProjectId}
              onChange={(e) => setState({ ...state, defaultProjectId: e.target.value })}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="form-assignee">Default assignee</label>
            <select
              id="form-assignee"
              value={state.defaultAssigneeId}
              onChange={(e) => setState({ ...state, defaultAssigneeId: e.target.value })}
            >
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="form-priority">Default priority</label>
            <select
              id="form-priority"
              value={state.defaultPriority}
              onChange={(e) =>
                setState({ ...state, defaultPriority: e.target.value as Priority })
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="row" style={{ marginTop: 24 }}>
            <input
              id="form-active"
              type="checkbox"
              checked={state.isActive}
              onChange={(e) => setState({ ...state, isActive: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <label htmlFor="form-active" style={{ marginBottom: 0 }}>
              Accepting submissions
            </label>
          </div>
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Fields</h2>
          <div className="col">
            {state.fields.map((f) => (
              <div key={f._key} className="subtle-card form-grid">
                <div className="full">
                  <label>Label</label>
                  <input
                    value={f.label}
                    onChange={(e) => updateField(f._key, { label: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Type</label>
                  <select
                    value={f.fieldType}
                    onChange={(e) =>
                      updateField(f._key, {
                        fieldType: e.target.value as FormFieldInput['fieldType'],
                      })
                    }
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row" style={{ marginTop: 24 }}>
                  <input
                    id={`req-${f._key}`}
                    type="checkbox"
                    checked={!!f.isRequired}
                    onChange={(e) => updateField(f._key, { isRequired: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor={`req-${f._key}`} style={{ marginBottom: 0 }}>
                    Required
                  </label>
                </div>
                {f.fieldType === 'dropdown' ? (
                  <div className="full">
                    <label>Options (comma-separated)</label>
                    <input
                      value={Array.isArray(f.options) ? f.options.join(', ') : ''}
                      onChange={(e) =>
                        updateField(f._key, {
                          options: e.target.value
                            .split(',')
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                ) : null}
                <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="link"
                    onClick={() => removeField(f._key)}
                    style={{ color: 'var(--danger)' }}
                  >
                    Remove field
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addField}>
              + Add field
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Link to="/forms" className="btn btn-secondary">
            Cancel
          </Link>
          <button className="btn" type="submit">
            {mode === 'new' ? 'Create form' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
