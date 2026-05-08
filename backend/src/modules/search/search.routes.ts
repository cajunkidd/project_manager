import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { searchService } from './search.service';

const querySchema = z.object({ q: z.string().min(1).max(200) });

export const searchRouter = Router();
searchRouter.use(authMiddleware);

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q } = querySchema.parse({ q: (req.query.q as string | undefined) ?? '' });
    res.json(await searchService.search(q));
  }),
);
