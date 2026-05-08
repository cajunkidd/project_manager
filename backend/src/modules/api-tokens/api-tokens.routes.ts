import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiTokensService } from './api-tokens.service';

const SCOPES = [
  'tasks:read',
  'tasks:write',
  'projects:read',
  'projects:write',
  'forms:submit',
] as const;

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(SCOPES)).min(1),
});

export const apiTokensRouter = Router();

apiTokensRouter.use(authMiddleware);
apiTokensRouter.use(requireRole('admin'));

apiTokensRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tokens = await apiTokensService.list();
    res.json(
      tokens.map(({ tokenHash: _h, ...rest }) => ({
        ...rest,
        scopes: rest.scopes.split(',').filter(Boolean),
      })),
    );
  }),
);

apiTokensRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const { token, record } = await apiTokensService.create(data, req.user?.id);
    const { tokenHash: _h, ...rest } = record;
    res.status(201).json({
      token,
      record: { ...rest, scopes: rest.scopes.split(',').filter(Boolean) },
    });
  }),
);

apiTokensRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await apiTokensService.revoke(req.params.id);
    res.status(204).send();
  }),
);
