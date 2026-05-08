import Anthropic from '@anthropic-ai/sdk';
import {
  extractTasksFromText,
  scoreProjectRisk,
  summarizeProject,
} from './ai.heuristic';
import type { ExtractedTask, ProjectAIContext, ProjectSummary, RiskScore } from './ai.types';

export interface AIProvider {
  name: string;
  summarizeProject(ctx: ProjectAIContext): Promise<ProjectSummary>;
  scoreProjectRisk(ctx: ProjectAIContext): Promise<RiskScore>;
  extractTasks(text: string): Promise<ExtractedTask[]>;
}

const heuristicProvider: AIProvider = {
  name: 'heuristic',
  async summarizeProject(ctx) {
    return summarizeProject(ctx);
  },
  async scoreProjectRisk(ctx) {
    return scoreProjectRisk(ctx);
  },
  async extractTasks(text) {
    return extractTasksFromText(text);
  },
};

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'recommendations', 'completed', 'open', 'overdue', 'blockers'],
  properties: {
    headline: { type: 'string' },
    recommendations: { type: 'array', items: { type: 'string' } },
    completed: { type: 'array', items: { type: 'string' } },
    open: { type: 'array', items: { type: 'string' } },
    overdue: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'array', items: { type: 'string' } },
  },
} as const;

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'priority'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          dueDate: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

function summaryPrompt(ctx: ProjectAIContext): string {
  const taskLines = ctx.tasks
    .slice(0, 60)
    .map(
      (t) =>
        `- [${t.status}|${t.priority}|${t.assignedToId ? 'assigned' : 'unassigned'}|due:${
          t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'none'
        }] ${t.title}`,
    )
    .join('\n');
  const commentLines = ctx.recentComments
    .slice(0, 8)
    .map((c) => `- ${c.body.slice(0, 240)}`)
    .join('\n');

  return [
    `Project: ${ctx.project.name}`,
    `Status: ${ctx.project.status} · Priority: ${ctx.project.priority}`,
    `Due date: ${ctx.project.dueDate ? ctx.project.dueDate.toISOString().slice(0, 10) : 'none'}`,
    ctx.project.description ? `Description: ${ctx.project.description}` : '',
    '',
    'Tasks:',
    taskLines || '(none)',
    '',
    'Recent comments:',
    commentLines || '(none)',
    '',
    'Produce a concise project status summary grounded only in the data above.',
    'Output JSON with: headline (one sentence), recommendations (3-5 actionable bullets),',
    'and short title-only lists for completed/open/overdue/blockers (≤5 items each).',
  ]
    .filter(Boolean)
    .join('\n');
}

const EXTRACT_PROMPT = [
  'You convert rough text (notes, emails, meeting summaries) into discrete actionable tasks.',
  '',
  'Rules:',
  '- Each task title is a single concrete action ("Replace switch in Lake Charles").',
  '- Detect priority from urgency words: asap/urgent/critical → urgent; today/eod/important → high; whenever/someday → low; otherwise normal.',
  '- Detect due dates: ISO dates, "today", "tomorrow", "this week", "next week" → ISO 8601 date.',
  '- Skip non-actionable lines (purely informational sentences).',
  '- Do not invent tasks not implied by the text.',
].join('\n');

class AnthropicAIProvider implements AIProvider {
  name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-opus-4-7') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async summarizeProject(ctx: ProjectAIContext): Promise<ProjectSummary> {
    // Use heuristic to compute deterministic metrics — don't ask the LLM to count.
    const baseline = summarizeProject(ctx);
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system:
          'You are a concise project manager. Ground every claim only in the provided data. Reply in the requested JSON shape.',
        messages: [{ role: 'user', content: summaryPrompt(ctx) }],
        output_config: {
          format: { type: 'json_schema', schema: SUMMARY_SCHEMA },
        },
      });
      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return baseline;
      const parsed = JSON.parse(textBlock.text) as Partial<ProjectSummary>;
      return {
        ...baseline,
        headline: parsed.headline ?? baseline.headline,
        recommendations: parsed.recommendations ?? baseline.recommendations,
        completed: parsed.completed ?? baseline.completed,
        open: parsed.open ?? baseline.open,
        overdue: parsed.overdue ?? baseline.overdue,
        blockers: parsed.blockers ?? baseline.blockers,
      };
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('[ai:anthropic] summary failed, falling back to heuristic:', err);
      }
      return baseline;
    }
  }

  async scoreProjectRisk(ctx: ProjectAIContext): Promise<RiskScore> {
    // Risk score is a deterministic numeric calculation; LLM adds no value.
    return scoreProjectRisk(ctx);
  }

  async extractTasks(text: string): Promise<ExtractedTask[]> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: EXTRACT_PROMPT,
        messages: [{ role: 'user', content: text }],
        output_config: {
          format: { type: 'json_schema', schema: EXTRACT_SCHEMA },
        },
      });
      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return extractTasksFromText(text);
      const parsed = JSON.parse(textBlock.text) as {
        tasks: { title: string; description?: string; priority: string; dueDate?: string; reason?: string }[];
      };
      return parsed.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? null,
        priority: (t.priority as ExtractedTask['priority']) ?? 'normal',
        status: 'to_do',
        dueDate: t.dueDate ?? null,
        reason: t.reason,
      }));
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('[ai:anthropic] extract failed, falling back to heuristic:', err);
      }
      return extractTasksFromText(text);
    }
  }
}

let activeProvider: AIProvider = heuristicProvider;

export function getAIProvider(): AIProvider {
  return activeProvider;
}

export function configureAIProvider(): AIProvider {
  const choice = process.env.AI_PROVIDER ?? 'heuristic';
  if (choice === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    activeProvider = new AnthropicAIProvider(
      process.env.ANTHROPIC_API_KEY,
      process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7',
    );
  } else {
    activeProvider = heuristicProvider;
  }
  return activeProvider;
}

// Configure once at module load so the rest of the codebase reads `getAIProvider()`.
configureAIProvider();
