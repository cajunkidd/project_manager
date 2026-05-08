import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getToken, http, setToken } from './client';

describe('api client', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists tokens via localStorage', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('attaches the Authorization header when a token is present', async () => {
    setToken('tok');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await http.get('/things');
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = request.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  it('throws ApiError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Boom' }), { status: 500 }),
    );
    await expect(http.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('returns undefined for 204 No Content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(http.delete('/x')).resolves.toBeUndefined();
  });

  it('serializes JSON body with the right Content-Type', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await http.post('/things', { a: 1 });
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.body).toBe(JSON.stringify({ a: 1 }));
    const headers = request.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
