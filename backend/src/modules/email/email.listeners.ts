import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { emailService } from './email.service';

let registered = false;

export function registerEmailListeners(): void {
  if (registered) return;
  registered = true;

  eventBus.on('task.assigned', async (event) => {
    if (!event.assigneeId) return;
    const user = await prisma.user.findUnique({
      where: { id: event.assigneeId },
      select: { email: true, isActive: true, displayName: true },
    });
    if (!user || !user.isActive) return;
    await emailService.send(
      user.email,
      `Task assigned: ${event.task.title}`,
      `Hi ${user.displayName},\n\nYou were assigned the task "${event.task.title}".\nStatus: ${event.task.status} · Priority: ${event.task.priority}\n`,
      { kind: 'task_assigned', taskId: event.task.id },
    );
  });

  eventBus.on('comment.created', async (event) => {
    if (!event.mentionedUserIds.length) return;
    const users = await prisma.user.findMany({
      where: { id: { in: event.mentionedUserIds }, isActive: true },
      select: { id: true, email: true, displayName: true },
    });
    await Promise.all(
      users.map((user) =>
        emailService.send(
          user.email,
          'You were mentioned',
          `Hi ${user.displayName},\n\nYou were mentioned in a comment:\n\n${event.body}\n`,
          { kind: 'mention', taskId: event.taskId, projectId: event.projectId },
        ),
      ),
    );
  });
}
