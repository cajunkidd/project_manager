import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

const MODEL = 'claude-haiku-4-5-20251001';
const SUMMARY_MODEL = 'claude-sonnet-4-6';

const TASK_PARSE_SYSTEM = `You are a task extraction assistant for an IT project management tool.
Extract structured task data from natural-language input and return ONLY a JSON object.
Today's date: {{TODAY}}

Respond with exactly this JSON shape (omit fields you cannot determine):
{
  "title": "string — concise task title",
  "description": "string — clear task description",
  "priority": "low|normal|high|urgent",
  "dueDate": "YYYY-MM-DD or null",
  "estimatedMinutes": number or null,
  "suggestedTags": ["string"]
}

Rules:
- Title should be ≤80 chars, action-oriented (e.g. "Replace core switch in Building A")
- Description expands on the title with technical context
- Priority: urgent=safety/outage, high=major impact, normal=standard, low=nice-to-have
- If the user mentions a specific date or "next [weekday]", compute the ISO date
- estimatedMinutes: 30, 60, 90, 120, 240, 480 — use your best judgment
- Return ONLY valid JSON, no markdown, no commentary`;

const ENHANCE_SYSTEM = `You are a technical writing assistant for IT project tasks.
Improve the given task description to be clear, actionable, and complete.
Return ONLY the improved description text — no JSON, no markdown headers, no commentary.
Keep it concise (2-4 sentences max). Use plain text.`;

const SUMMARY_SYSTEM = `You are a project status analyst for an IT department.
Analyze the provided project data and write a concise health summary.
Format: 3-5 bullet points covering overall health, progress highlights,
blockers or risks, and recommended next actions.
Use plain text bullets starting with "•". Be specific about numbers and names.`;

const RISK_SYSTEM = `You are a project risk analyst for an IT department.
Given a project's risk factors, write a concise 2-3 sentence plain-language
explanation of why the project is at risk and what should be done first.
Be specific about numbers. Do not repeat the score back. No bullets, no markdown.`;

@Injectable()
export class AiService {
  private client: Anthropic | null = null;

  constructor(private prisma: PrismaService) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  private ensureClient() {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features require ANTHROPIC_API_KEY to be set in the environment.',
      );
    }
    return this.client;
  }

  async parseTask(rawText: string): Promise<{
    title?: string;
    description?: string;
    priority?: string;
    dueDate?: string | null;
    estimatedMinutes?: number | null;
    suggestedTags?: string[];
  }> {
    const client = this.ensureClient();
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = TASK_PARSE_SYSTEM.replace('{{TODAY}}', today);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: rawText }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    try {
      return JSON.parse(text.trim());
    } catch {
      return { title: rawText.slice(0, 80) };
    }
  }

  async enhanceDescription(title: string, roughNotes: string): Promise<string> {
    const client = this.ensureClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: ENHANCE_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Task title: ${title}\n\nRough notes: ${roughNotes}`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : roughNotes;
  }

  async projectSummary(projectId: string): Promise<string> {
    const client = this.ensureClient();

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { displayName: true } },
        tasks: {
          select: {
            title: true, status: true, priority: true, dueDate: true,
            assignee: { select: { displayName: true } },
          },
        },
      },
    });

    if (!project) throw new Error('Project not found');

    const tasksByStatus = project.tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    const overdue = project.tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && !['done', 'cancelled'].includes(t.status),
    );
    const blocked = project.tasks.filter((t) => t.status === 'waiting');
    const done = project.tasks.filter((t) => t.status === 'done');

    const context = `Project: ${project.name}
Status: ${project.status} | Priority: ${project.priority}
Owner: ${project.owner?.displayName ?? 'Unassigned'}
Due: ${project.dueDate ? new Date(project.dueDate).toDateString() : 'Not set'}
Description: ${project.description ?? 'None'}

Task breakdown: ${JSON.stringify(tasksByStatus)}
Total tasks: ${project.tasks.length}
Completed: ${done.length}
Overdue: ${overdue.length} ${overdue.map((t) => t.title).join(', ')}
Blocked/waiting: ${blocked.length} ${blocked.map((t) => t.title).join(', ')}

Recent urgent/high tasks:
${project.tasks
  .filter((t) => ['urgent', 'high'].includes(t.priority) && !['done', 'cancelled'].includes(t.status))
  .slice(0, 5)
  .map((t) => `- [${t.priority}] ${t.title} (${t.status}) — ${t.assignee?.displayName ?? 'Unassigned'}`)
  .join('\n')}`;

    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: SUMMARY_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: context }],
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  }

  async suggestPriority(title: string, description: string): Promise<{ priority: string; reason: string }> {
    const client = this.ensureClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 128,
      system: [
        {
          type: 'text',
          text: `You are a priority classifier for IT tasks. Return ONLY JSON: {"priority":"low|normal|high|urgent","reason":"one sentence"}
urgent=outage/security/data loss, high=major disruption, normal=standard work, low=improvement/nice-to-have`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: `Title: ${title}\nDescription: ${description}` },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    try {
      return JSON.parse(text);
    } catch {
      return { priority: 'normal', reason: 'Could not determine priority.' };
    }
  }

  private scoreProject(project: {
    name: string;
    dueDate: Date | null;
    tasks: { status: string; dueDate: Date | null; assignedTo: string | null; updatedAt: Date; title: string }[];
  }) {
    const now = new Date();
    const activeTasks = project.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
    const overdue = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
    const blocked = activeTasks.filter((t) => t.status === 'waiting');
    const unassigned = activeTasks.filter((t) => !t.assignedTo);

    const lastActivity = project.tasks.reduce<Date | null>((latest, t) => {
      const u = new Date(t.updatedAt);
      return !latest || u > latest ? u : latest;
    }, null);
    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / 86_400_000)
      : 999;

    const dueDateProximity = project.dueDate
      ? Math.floor((new Date(project.dueDate).getTime() - now.getTime()) / 86_400_000)
      : null;

    let score = 0;
    const factors: { label: string; value: number; weight: number }[] = [];

    if (activeTasks.length > 0 && overdue.length > 0) {
      const overduePct = (overdue.length / activeTasks.length) * 100;
      const w = Math.min(40, Math.round(overduePct * 0.5));
      if (w > 0) factors.push({ label: `${overdue.length} overdue task(s)`, value: overdue.length, weight: w });
      score += w;
    }

    if (blocked.length > 0) {
      const w = Math.min(20, blocked.length * 5);
      factors.push({ label: `${blocked.length} blocked task(s)`, value: blocked.length, weight: w });
      score += w;
    }

    if (unassigned.length > 0 && activeTasks.length > 0) {
      const unassignedPct = (unassigned.length / activeTasks.length) * 100;
      const w = Math.min(15, Math.round(unassignedPct * 0.3));
      if (w > 0) factors.push({ label: `${unassigned.length} unassigned task(s)`, value: unassigned.length, weight: w });
      score += w;
    }

    if (daysSinceActivity > 7 && activeTasks.length > 0) {
      const w = Math.min(15, daysSinceActivity);
      factors.push({ label: `${daysSinceActivity} days since last activity`, value: daysSinceActivity, weight: w });
      score += w;
    }

    if (dueDateProximity !== null && dueDateProximity < 14 && activeTasks.length > 0) {
      const w = dueDateProximity < 0 ? 25 : dueDateProximity < 7 ? 15 : 8;
      const label = dueDateProximity < 0
        ? `Project ${Math.abs(dueDateProximity)} days past due`
        : `Project due in ${dueDateProximity} days, ${activeTasks.length} tasks remain`;
      factors.push({ label, value: dueDateProximity, weight: w });
      score += w;
    }

    score = Math.min(100, score);
    const level: 'low' | 'medium' | 'high' | 'critical' =
      score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

    return { score, level, factors, activeTasks, overdue, blocked, unassigned, daysSinceActivity, dueDateProximity };
  }

  async analyzeProjectRisk(projectId: string): Promise<{
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: { label: string; value: number; weight: number }[];
    explanation: string | null;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { displayName: true } },
        tasks: {
          select: {
            title: true, status: true, dueDate: true, assignedTo: true, updatedAt: true,
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const r = this.scoreProject(project);

    let explanation: string | null = null;
    if (this.client && r.score >= 25) {
      const context = `Project: ${project.name}
Owner: ${project.owner?.displayName ?? 'Unassigned'}
Active tasks: ${r.activeTasks.length} (${r.overdue.length} overdue, ${r.blocked.length} blocked, ${r.unassigned.length} unassigned)
Days since last activity: ${r.daysSinceActivity}
${r.dueDateProximity !== null ? `Project due in ${r.dueDateProximity} days` : 'No project due date'}
Risk score: ${r.score}/100 (${r.level})
Top overdue tasks: ${r.overdue.slice(0, 5).map((t) => t.title).join(', ') || 'none'}`;

      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 256,
          system: [
            { type: 'text', text: RISK_SYSTEM, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: context }],
        });
        explanation = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
      } catch {
        explanation = null;
      }
    }

    return { score: r.score, level: r.level, factors: r.factors, explanation };
  }

  async listProjectRisks(): Promise<
    { projectId: string; name: string; score: number; level: string; topFactor: string | null }[]
  > {
    const projects = await this.prisma.project.findMany({
      where: { status: { notIn: ['done', 'cancelled', 'on_hold'] } },
      select: {
        id: true, name: true, dueDate: true,
        tasks: {
          select: { title: true, status: true, dueDate: true, assignedTo: true, updatedAt: true },
        },
      },
    });

    return projects
      .map((p) => {
        const r = this.scoreProject(p);
        const topFactor = [...r.factors].sort((a, b) => b.weight - a.weight)[0]?.label ?? null;
        return { projectId: p.id, name: p.name, score: r.score, level: r.level, topFactor };
      })
      .sort((a, b) => b.score - a.score);
  }

  isAvailable(): boolean {
    return !!this.client;
  }
}
