import { prisma } from "../prisma";

type NotifyInput = {
  userId: string;
  title: string;
  message: string;
  type: "task_assigned" | "mention" | "comment_reply" | "status_changed" | "project_updated";
  entityType?: "task" | "project" | "comment";
  entityId?: string;
};

export async function notify(input: NotifyInput) {
  if (!input.userId) return;
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}
