import { eventBus } from '../../events/bus';
import { notificationsService } from './notifications.service';

let registered = false;

export function registerNotificationListeners(): void {
  if (registered) return;
  registered = true;

  eventBus.on('task.assigned', async (event) => {
    await notificationsService.create({
      userId: event.assigneeId,
      type: 'task_assigned',
      title: 'Task assigned',
      message: `You were assigned: ${event.task.title}`,
      entityType: 'task',
      entityId: event.task.id,
    });
  });

  eventBus.on('task.status_changed', async (event) => {
    if (event.toStatus === 'done' && event.task.assignedToId) {
      // Don't notify the assignee if they marked it themselves.
      if (event.task.assignedToId === event.actorId) return;
      await notificationsService.create({
        userId: event.task.assignedToId,
        type: 'task_status_changed',
        title: 'Task completed',
        message: `${event.task.title} marked done`,
        entityType: 'task',
        entityId: event.task.id,
      });
    }
  });

  eventBus.on('comment.created', async (event) => {
    await Promise.all(
      event.mentionedUserIds.map((userId) =>
        notificationsService.create({
          userId,
          type: 'mention',
          title: 'You were mentioned',
          message: event.body.length > 140 ? `${event.body.slice(0, 137)}…` : event.body,
          entityType: event.taskId ? 'task' : 'project',
          entityId: event.taskId ?? event.projectId ?? null,
        }),
      ),
    );
  });

  eventBus.on('form.submitted', async (event) => {
    if (event.actorId) {
      await notificationsService.create({
        userId: event.actorId,
        type: 'form_submitted',
        title: 'Submission received',
        message: 'Your request was submitted.',
        entityType: 'form_submission',
        entityId: event.submission.id,
      });
    }
  });
}
