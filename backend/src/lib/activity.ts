import { prisma } from "../prisma";

type LogInput = {
  entityType: "project" | "task" | "comment" | "user";
  entityId: string;
  action: string;
  userId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function logActivity(input: LogInput) {
  await prisma.activityLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId ?? null,
      oldValue: (input.oldValue ?? null) as never,
      newValue: (input.newValue ?? null) as never,
    },
  });
}
