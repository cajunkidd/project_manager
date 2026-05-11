import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { PROJECT_MEMBER_ROLES, membersService } from './members.service';

const addSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(PROJECT_MEMBER_ROLES).optional(),
});

const updateSchema = z.object({
  role: z.enum(PROJECT_MEMBER_ROLES),
});

export const projectMembersRouter = Router({ mergeParams: true });

projectMembersRouter.use(authMiddleware);

projectMembersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    if (!req.user) throw new UnauthorizedError();
    await membersService.ensureAccess(projectId, {
      userId: req.user.id,
      globalRole: req.user.role,
    });
    res.json(await membersService.listForProject(projectId));
  }),
);

projectMembersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    if (!req.user) throw new UnauthorizedError();
    await membersService.ensureAccess(
      projectId,
      { userId: req.user.id, globalRole: req.user.role },
      'owner',
    );
    const data = addSchema.parse(req.body);
    res.status(201).json(await membersService.addMember(projectId, data.userId, data.role));
  }),
);

projectMembersRouter.patch(
  '/:userId',
  asyncHandler(async (req, res) => {
    const { id: projectId, userId } = req.params as { id: string; userId: string };
    if (!req.user) throw new UnauthorizedError();
    await membersService.ensureAccess(
      projectId,
      { userId: req.user.id, globalRole: req.user.role },
      'owner',
    );
    const data = updateSchema.parse(req.body);
    res.json(await membersService.updateRole(projectId, userId, data.role));
  }),
);

projectMembersRouter.delete(
  '/:userId',
  asyncHandler(async (req, res) => {
    const { id: projectId, userId } = req.params as { id: string; userId: string };
    if (!req.user) throw new UnauthorizedError();
    // Owners can remove anyone; members can remove themselves.
    if (req.user.id !== userId) {
      await membersService.ensureAccess(
        projectId,
        { userId: req.user.id, globalRole: req.user.role },
        'owner',
      );
    } else {
      await membersService.ensureAccess(projectId, {
        userId: req.user.id,
        globalRole: req.user.role,
      });
    }
    await membersService.removeMember(projectId, userId);
    res.status(204).send();
  }),
);
