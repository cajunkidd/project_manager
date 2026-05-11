import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { gmailService } from './gmail.service';

const callbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

const setLabelSchema = z.object({ labelName: z.string().min(1).max(80) });

export const gmailAuthedRouter = Router();
export const gmailPublicRouter = Router();

gmailAuthedRouter.use(authMiddleware);

function hostOf(req: { protocol: string; get(name: string): string | undefined }): string {
  return `${req.protocol}://${req.get('host')}`;
}

gmailAuthedRouter.get(
  '/gmail/oauth/start',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    const redirect = gmailService.buildRedirectUri(hostOf(req));
    return res.json({ authorizeUrl: gmailService.authorizeUrl(user.id, redirect) });
  }),
);

gmailAuthedRouter.get(
  '/gmail/status',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    return res.json(await gmailService.status(user.id));
  }),
);

gmailAuthedRouter.patch(
  '/gmail/label',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    const data = setLabelSchema.parse(req.body);
    res.json(await gmailService.setLabel(user.id, data.labelName));
  }),
);

gmailAuthedRouter.delete(
  '/gmail/connection',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    await gmailService.disconnect(user.id);
    res.status(204).send();
  }),
);

gmailAuthedRouter.post(
  '/gmail/poll',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    const redirect = gmailService.buildRedirectUri(hostOf(req));
    const connection = await (await import('../../db/prisma')).prisma.gmailConnection.findUnique({
      where: { userId: user.id },
    });
    if (!connection) return res.status(404).json({ error: 'No Gmail connection for user' });
    return res.json(await gmailService.pollConnection(connection.id, redirect));
  }),
);

// OAuth callback runs outside JWT auth — Google posts the user back here
// without our session cookie.
gmailPublicRouter.get(
  '/gmail/oauth/callback',
  asyncHandler(async (req, res) => {
    const data = callbackSchema.parse(req.query);
    if (data.error) {
      return res.status(400).type('text/html').send(`
        <html><body><h2>Gmail authorization cancelled</h2><p>${data.error}</p></body></html>
      `);
    }
    if (!data.code || !data.state) {
      return res.status(400).type('text/html').send('Missing code or state');
    }
    const redirect = gmailService.buildRedirectUri(hostOf(req));
    try {
      const conn = await gmailService.completeOAuth(data.code, data.state, redirect);
      return res.type('text/html').send(`
        <html><body style="font-family:system-ui;padding:24px">
          <h2>Gmail connected ✓</h2>
          <p>Connected as <strong>${conn.email}</strong>. You can close this window
             and return to Project Manager.</p>
          <script>setTimeout(function(){ window.close(); }, 2000);</script>
        </body></html>
      `);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return res.status(400).type('text/html').send(`
        <html><body><h2>Could not connect Gmail</h2><pre>${message}</pre></body></html>
      `);
    }
  }),
);
