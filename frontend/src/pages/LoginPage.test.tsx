import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in and redirects on success', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: 'tok',
          user: {
            id: 'u1',
            email: 'a@x.com',
            displayName: 'Alice',
            role: 'user',
            department: null,
            isActive: true,
          },
        }),
        { status: 200 },
      ),
    );

    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'a@x.com');
    await user.type(screen.getByLabelText(/password/i), 'password1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(window.localStorage.getItem('pm.auth.token')).toBe('tok');
  });

  it('shows the server error on bad credentials', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 }),
    );

    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'a@x.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongwrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
