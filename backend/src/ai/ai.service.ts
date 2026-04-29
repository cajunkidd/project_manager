import { Injectable, ServiceUnavailableException } from '@nestjs/common';
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

  isAvailable(): boolean {
    return !!this.client;
  }
}
