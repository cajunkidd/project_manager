import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { tasksService } from '../tasks/tasks.service';
import { tokenAuth } from './api-token.middleware';

const taskSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['backlog', 'to_do', 'in_progress', 'waiting', 'review']).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
});

export const publicApiRouter = Router();

publicApiRouter.post(
  '/tasks',
  tokenAuth('tasks:write'),
  asyncHandler(async (req, res) => {
    const data = taskSchema.parse(req.body);
    const task = await tasksService.create({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    });
    res.status(201).json(task);
  }),
);

publicApiRouter.get(
  '/tasks/:id',
  tokenAuth('tasks:read'),
  asyncHandler(async (req, res) => {
    res.json(await tasksService.getById(req.params.id));
  }),
);
