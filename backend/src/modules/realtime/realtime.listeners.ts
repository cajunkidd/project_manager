import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { realtimeHub } from './realtime.hub';

let registered = false;

async function projectAudience(projectId: string | null | undefined): Promise<string[]> {
  if (!projectId) return [];
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function adminAudience(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

async function audienceForProject(projectId: string | null | undefined): Promise<string[]> {
  const [members, admins] = await Promise.all([
    projectAudience(projectId),
    adminAudience(),
  ]);
  return Array.from(new Set([...members, ...admins]));
}

export function registerRealtimeListeners(): void {
  if (registered) return;
  registered = true;

  eventBus.on('project.created', async (event) => {
    const audience = await audienceForProject(event.project.id);
    realtimeHub.send(audience, {
      type: 'project.created',
      data: { projectId: event.project.id, actorId: event.actorId ?? null },
    });
  });

  eventBus.on('project.updated', async (event) => {
    const audience = await audienceForProject(event.project.id);
    realtimeHub.send(audience, {
      type: 'project.updated',
      data: { projectId: event.project.id, actorId: event.actorId ?? null },
    });
  });

  eventBus.on('task.created', async (event) => {
    const audience = event.task.projectId
      ? await audienceForProject(event.task.projectId)
      : await adminAudience();
    if (event.task.assignedToId) audience.push(event.task.assignedToId);
    if (event.actorId) audience.push(event.actorId);
    realtimeHub.send(new Set(audience), {
      type: 'task.created',
      data: {
        taskId: event.task.id,
        projectId: event.task.projectId,
        actorId: event.actorId ?? null,
      },
    });
  });

  eventBus.on('task.updated', async (event) => {
    const audience = event.task.projectId
      ? await audienceForProject(event.task.projectId)
      : await adminAudience();
    if (event.task.assignedToId) audience.push(event.task.assignedToId);
    if (event.before.assignedToId) audience.push(event.before.assignedToId);
    realtimeHub.send(new Set(audience), {
      type: 'task.updated',
      data: {
        taskId: event.task.id,
        projectId: event.task.projectId,
        actorId: event.actorId ?? null,
      },
    });
  });

  eventBus.on('task.status_changed', async (event) => {
    const audience = event.task.projectId
      ? await audienceForProject(event.task.projectId)
      : await adminAudience();
    if (event.task.assignedToId) audience.push(event.task.assignedToId);
    realtimeHub.send(new Set(audience), {
      type: 'task.status_changed',
      data: {
        taskId: event.task.id,
        projectId: event.task.projectId,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
      },
    });
  });

  eventBus.on('task.assigned', async (event) => {
    realtimeHub.send([event.assigneeId], {
      type: 'task.assigned',
      data: {
        taskId: event.task.id,
        projectId: event.task.projectId,
        assigneeId: event.assigneeId,
      },
    });
  });

  eventBus.on('comment.created', async (event) => {
    let projectId = event.projectId ?? null;
    if (!projectId && event.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: event.taskId },
        select: { projectId: true },
      });
      projectId = task?.projectId ?? null;
    }
    const audience = projectId ? await audienceForProject(projectId) : await adminAudience();
    audience.push(event.authorId);
    for (const id of event.mentionedUserIds) audience.push(id);
    realtimeHub.send(new Set(audience), {
      type: 'comment.created',
      data: {
        taskId: event.taskId ?? null,
        projectId: event.projectId ?? projectId,
        authorId: event.authorId,
      },
    });
  });
}
