import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { UnauthorizedError } from '../../utils/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { realtimeHub } from './realtime.hub';

export const realtimeRouter = Router();

realtimeRouter.get(
  '/stream',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = headerToken ?? queryToken;
    if (!token) throw new UnauthorizedError('Missing token');

    let user;
    try {
      user = verifyToken(token);
    } catch {
      throw new UnauthorizedError('Invalid token');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: hello\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);

    const client = realtimeHub.add(user.id, res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        // ignore
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      realtimeHub.remove(client);
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  }),
);
