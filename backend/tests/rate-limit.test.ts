import express from 'express';
import request from 'supertest';
import { createRateLimiter, ipKey } from '../src/middleware/rateLimit';

describe('rate limit middleware', () => {
  it('allows requests under the limit and 429s once exceeded', async () => {
    const app = express();
    app.use(
      createRateLimiter({ windowMs: 60_000, max: 3, keyFn: ipKey, message: 'slow down' }),
    );
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).get('/ping');
      expect(ok.status).toBe(200);
      expect(ok.headers['x-ratelimit-limit']).toBe('3');
      expect(Number(ok.headers['x-ratelimit-remaining'])).toBe(3 - (i + 1));
    }

    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ error: 'slow down' });
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('isolates counters per key', async () => {
    const app = express();
    let userId = 'alice';
    app.use((req, _res, next) => {
      (req as express.Request).user = { id: userId, email: 'x', role: 'user' };
      next();
    });
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyFn: (req) => req.user?.id ?? 'unknown',
      }),
    );
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    await request(app).get('/ping');
    await request(app).get('/ping');
    const aliceBlocked = await request(app).get('/ping');
    expect(aliceBlocked.status).toBe(429);

    userId = 'bob';
    const bobOk = await request(app).get('/ping');
    expect(bobOk.status).toBe(200);
  });

  it('resets the window after windowMs elapses', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 50, max: 1, keyFn: ipKey }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/ping');
    expect(first.status).toBe(200);
    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 70));
    const afterReset = await request(app).get('/ping');
    expect(afterReset.status).toBe(200);
  });
});
