import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async log(
    entityType: string,
    entityId: string,
    action: string,
    oldValue: any,
    newValue: any,
    userId?: string,
  ) {
    return this.prisma.activityLog.create({
      data: { entityType, entityId, action, oldValue, newValue, userId },
    });
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.activityLog.findMany({
      where: { entityType, entityId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
