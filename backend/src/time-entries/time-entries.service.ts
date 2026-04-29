import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  async getForTask(taskId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { taskId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { loggedAt: 'desc' },
    });
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    return { entries, totalMinutes };
  }

  async getUserEntries(userId: string, filters: { from?: string; to?: string }) {
    return this.prisma.timeEntry.findMany({
      where: {
        userId,
        ...(filters.from && { loggedAt: { gte: new Date(filters.from) } }),
        ...(filters.to && { loggedAt: { lte: new Date(filters.to) } }),
      },
      include: {
        task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async create(data: { taskId: string; minutes: number; notes?: string; loggedAt?: string }, userId: string) {
    return this.prisma.timeEntry.create({
      data: {
        taskId: data.taskId,
        userId,
        minutes: data.minutes,
        notes: data.notes ?? null,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      },
      include: { user: { select: { id: true, displayName: true } } },
    });
  }

  async update(id: string, data: { minutes?: number; notes?: string; loggedAt?: string }, userId: string) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(data.minutes !== undefined && { minutes: data.minutes }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.loggedAt && { loggedAt: new Date(data.loggedAt) }),
      },
      include: { user: { select: { id: true, displayName: true } } },
    });
  }

  async delete(id: string) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async reportByProject(filters: { userId?: string; from?: string; to?: string }) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.from && { loggedAt: { gte: new Date(filters.from) } }),
        ...(filters.to && { loggedAt: { lte: new Date(filters.to) } }),
      },
      include: {
        task: { select: { project: { select: { id: true, name: true } } } },
        user: { select: { id: true, displayName: true } },
      },
    });

    const byProject: Record<string, { projectId: string; projectName: string; totalMinutes: number }> = {};
    for (const e of entries) {
      const pid = e.task.project?.id ?? 'none';
      const pname = e.task.project?.name ?? 'No Project';
      if (!byProject[pid]) byProject[pid] = { projectId: pid, projectName: pname, totalMinutes: 0 };
      byProject[pid].totalMinutes += e.minutes;
    }

    return Object.values(byProject).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }
}
