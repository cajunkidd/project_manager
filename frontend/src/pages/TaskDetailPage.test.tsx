import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskDetailPage } from './TaskDetailPage';

interface MockTask {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedToId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  subtasks: MockTask[];
  dependencies: Array<{
    id: string;
    taskId: string;
    dependsOnTaskId: string;
    createdAt: string;
    dependsOnTask: { id: string; title: string; status: string; priority: string; dueDate: string | null };
  }>;
  dependents: Array<unknown>;
}

function makeTask(overrides: Partial<MockTask>): MockTask {
  return {
    id: 't1',
    projectId: null,
    parentTaskId: null,
    title: 'Task one',
    description: null,
    status: 'to_do',
    priority: 'normal',
    assignedToId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    sortOrder: 0,
    createdAt: '2026-05-10T12:00:00.000Z',
    updatedAt: '2026-05-10T12:00:00.000Z',
    subtasks: [],
    dependencies: [],
    dependents: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks/t1']}>
      <Routes>
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TaskDetailPage — dependencies', () => {
  beforeEach(() => {
    window.localStorage.setItem('pm.auth.token', 'tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('shows a blocker warning when dependencies are open', async () => {
    const task = makeTask({
      dependencies: [
        {
          id: 'dep1',
          taskId: 't1',
          dependsOnTaskId: 't2',
          createdAt: '2026-05-10T12:00:00.000Z',
          dependsOnTask: {
            id: 't2',
            title: 'Blocker',
            status: 'in_progress',
            priority: 'normal',
            dueDate: null,
          },
        },
      ],
    });

    const fetchMock = vi.fn<FetchFn>(async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.endsWith('/api/tasks/t1')) return jsonResponse(task);
      if (url.endsWith('/api/tasks/t1/comments')) return jsonResponse([]);
      if (url.endsWith('/api/tasks')) return jsonResponse([task]);
      return jsonResponse({ error: 'not mocked: ' + url }, 500);
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    renderPage();

    expect(await screen.findByText('Task one')).toBeInTheDocument();
    expect(
      screen.getByText(/Blocked by 1 open dependency/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blocker' })).toBeInTheDocument();
  });

  it('surfaces the API error when adding a self-dependency would fail', async () => {
    const task = makeTask({});
    const otherTask = { ...task, id: 't2', title: 'Other task' };

    const responses: Record<string, () => Response> = {
      'GET /api/tasks/t1': () => jsonResponse(task),
      'GET /api/tasks/t1/comments': () => jsonResponse([]),
      'GET /api/tasks': () => jsonResponse([task, otherTask]),
      'POST /api/tasks/t1/dependencies': () =>
        jsonResponse({ error: 'A task cannot depend on itself' }, 400),
    };

    const fetchMock = vi.fn<FetchFn>(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const path = url.replace(/^.*\/api/, '/api');
      const method = init?.method ?? 'GET';
      const key = `${method} ${path}`;
      const handler = responses[key];
      if (!handler) return jsonResponse({ error: 'not mocked: ' + key }, 500);
      return handler();
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Task one');
    const select = screen.getByLabelText(/choose blocking task/i);
    await user.selectOptions(select, 't2');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(
        screen.getByText('A task cannot depend on itself'),
      ).toBeInTheDocument();
    });
  });
});
