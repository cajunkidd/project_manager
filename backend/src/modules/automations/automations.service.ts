import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';

export const TRIGGERS = [
  'task_created',
  'task_updated',
  'task_status_changed',
  'comment_created',
  'form_submitted',
] as const;
export type TriggerType = (typeof TRIGGERS)[number];

export const ACTIONS = [
  'send_notification',
  'assign_user',
  'change_status',
  'change_priority',
  'add_comment',
] as const;
export type ActionType = (typeof ACTIONS)[number];

export interface AutomationCondition {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
}

export interface AutomationAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface CreateAutomationInput {
  name: string;
  triggerType: TriggerType;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  isActive?: boolean;
}

export type UpdateAutomationInput = Partial<CreateAutomationInput>;

function serializeRule(input: CreateAutomationInput | UpdateAutomationInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.triggerType !== undefined) data.triggerType = input.triggerType;
  if (input.conditions !== undefined)
    data.conditions = input.conditions ? JSON.stringify(input.conditions) : null;
  if (input.actions !== undefined) {
    if (!input.actions.length) throw new ValidationError('Automation needs at least one action');
    data.actions = JSON.stringify(input.actions);
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;
  return data;
}

export const automationsService = {
  async list() {
    return prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async getById(id: string) {
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundError('Automation rule not found');
    return rule;
  },

  async create(input: CreateAutomationInput, userId?: string) {
    if (!input.actions?.length) throw new ValidationError('Automation needs at least one action');
    return prisma.automationRule.create({
      data: {
        name: input.name,
        triggerType: input.triggerType,
        conditions: input.conditions ? JSON.stringify(input.conditions) : null,
        actions: JSON.stringify(input.actions),
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
      },
    });
  },

  async update(id: string, input: UpdateAutomationInput) {
    await this.getById(id);
    return prisma.automationRule.update({ where: { id }, data: serializeRule(input) });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.automationRule.delete({ where: { id } });
  },

  async findActiveByTrigger(triggerType: TriggerType) {
    const rules = await prisma.automationRule.findMany({
      where: { triggerType, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((rule) => ({
      ...rule,
      parsedConditions: rule.conditions
        ? (JSON.parse(rule.conditions) as AutomationCondition[])
        : [],
      parsedActions: JSON.parse(rule.actions) as AutomationAction[],
    }));
  },
};
