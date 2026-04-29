import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'changed_to' | 'changed_from';
  value: any;
}

export interface AutomationAction {
  type: 'notify' | 'change_status' | 'assign' | 'create_subtask' | 'add_comment' | 'set_priority';
  params: Record<string, any>;
}

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.automationRule.findMany({
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async findActiveByTrigger(triggerType: string) {
    return this.prisma.automationRule.findMany({
      where: { isActive: true, triggerType },
    });
  }

  async create(data: {
    name: string;
    triggerType: string;
    conditions?: AutomationCondition[];
    actions: AutomationAction[];
    isActive?: boolean;
  }, userId: string) {
    return this.prisma.automationRule.create({
      data: {
        name: data.name,
        triggerType: data.triggerType,
        conditions: (data.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions: data.actions as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
        createdById: userId,
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    return this.prisma.automationRule.update({
      where: { id },
      data,
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  async toggle(id: string) {
    const rule = await this.findById(id);
    return this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.automationRule.delete({ where: { id } });
  }
}
