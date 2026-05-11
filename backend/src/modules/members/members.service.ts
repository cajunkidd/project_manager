import { prisma } from '../../db/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';

export const PROJECT_MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

const ROLE_RANK: Record<ProjectMemberRole, number> = { viewer: 1, editor: 2, owner: 3 };

const MEMBER_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true } },
} as const;

export interface AccessContext {
  userId: string;
  globalRole: string;
}

function bypassesAcl(role: string): boolean {
  return role === 'admin';
}

export const membersService = {
  async listForProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    return prisma.projectMember.findMany({
      where: { projectId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  },

  async getMembership(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  },

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const m = await this.getMembership(projectId, userId);
    return !!m;
  },

  async ensureAccess(
    projectId: string,
    ctx: AccessContext,
    minRole: ProjectMemberRole = 'viewer',
  ): Promise<void> {
    if (bypassesAcl(ctx.globalRole)) return;
    const m = await this.getMembership(projectId, ctx.userId);
    if (!m) throw new ForbiddenError('You do not have access to this project');
    if (ROLE_RANK[m.role as ProjectMemberRole] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires ${minRole} role on this project`);
    }
  },

  async accessibleProjectIds(ctx: AccessContext): Promise<string[] | 'ALL'> {
    if (bypassesAcl(ctx.globalRole)) return 'ALL';
    const rows = await prisma.projectMember.findMany({
      where: { userId: ctx.userId },
      select: { projectId: true },
    });
    return rows.map((r) => r.projectId);
  },

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectMemberRole = 'editor',
  ) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    const existing = await this.getMembership(projectId, userId);
    if (existing) throw new ConflictError('User is already a member');
    return prisma.projectMember.create({
      data: { projectId, userId, role },
      include: MEMBER_INCLUDE,
    });
  },

  async updateRole(projectId: string, userId: string, role: ProjectMemberRole) {
    const m = await this.getMembership(projectId, userId);
    if (!m) throw new NotFoundError('Membership not found');
    return prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
      include: MEMBER_INCLUDE,
    });
  },

  async removeMember(projectId: string, userId: string) {
    const m = await this.getMembership(projectId, userId);
    if (!m) throw new NotFoundError('Membership not found');
    if (m.role === 'owner') {
      const owners = await prisma.projectMember.count({
        where: { projectId, role: 'owner' },
      });
      if (owners <= 1) {
        throw new ConflictError('Cannot remove the last owner of a project');
      }
    }
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  },

  async ensureOwnerSeeded(projectId: string, ownerUserId: string) {
    const existing = await this.getMembership(projectId, ownerUserId);
    if (existing) return;
    await prisma.projectMember.create({
      data: { projectId, userId: ownerUserId, role: 'owner' },
    });
  },
};
