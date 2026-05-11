import { eventBus, type DomainEvent } from '../../events/bus';
import { externalSystemsService } from './external-systems.service';

const TEAMS_EVENTS: DomainEvent['type'][] = [
  'task.created',
  'task.assigned',
  'task.status_changed',
  'project.created',
  'comment.created',
];

let registered = false;

interface MessageCard {
  '@type': 'MessageCard';
  '@context': 'http://schema.org/extensions';
  themeColor?: string;
  summary: string;
  title: string;
  text?: string;
  sections?: { facts?: { name: string; value: string }[]; markdown?: boolean }[];
}

function colorFor(event: DomainEvent): string {
  switch (event.type) {
    case 'task.assigned':
      return '2563eb';
    case 'task.status_changed':
      return event.toStatus === 'done' ? '16a34a' : 'eab308';
    case 'project.created':
      return '8b5cf6';
    case 'comment.created':
      return '64748b';
    default:
      return '0ea5e9';
  }
}

function summaryFor(event: DomainEvent): string {
  switch (event.type) {
    case 'task.created':
      return `New task: ${event.task.title}`;
    case 'task.assigned':
      return `Task assigned: ${event.task.title}`;
    case 'task.status_changed':
      return `Task ${event.task.title} → ${event.toStatus}`;
    case 'project.created':
      return `New project: ${event.project.name}`;
    case 'comment.created':
      return `New comment`;
    default:
      return 'Project Manager update';
  }
}

export function buildMessageCard(event: DomainEvent): MessageCard {
  const summary = summaryFor(event);
  const themeColor = colorFor(event);
  let title = summary;
  let text: string | undefined;
  const facts: { name: string; value: string }[] = [];

  switch (event.type) {
    case 'task.created':
    case 'task.assigned': {
      title = event.task.title;
      facts.push({ name: 'Status', value: event.task.status });
      facts.push({ name: 'Priority', value: event.task.priority });
      if (event.task.dueDate) facts.push({ name: 'Due', value: event.task.dueDate.toISOString() });
      if (event.type === 'task.assigned')
        facts.push({ name: 'Assignee', value: event.assigneeId });
      break;
    }
    case 'task.status_changed': {
      title = event.task.title;
      facts.push({ name: 'From', value: event.fromStatus });
      facts.push({ name: 'To', value: event.toStatus });
      break;
    }
    case 'project.created': {
      title = event.project.name;
      facts.push({ name: 'Status', value: event.project.status });
      facts.push({ name: 'Priority', value: event.project.priority });
      if (event.project.department)
        facts.push({ name: 'Department', value: event.project.department });
      break;
    }
    case 'comment.created': {
      title = 'New comment';
      text = event.body.slice(0, 500);
      if (event.taskId) facts.push({ name: 'Task', value: event.taskId });
      if (event.projectId) facts.push({ name: 'Project', value: event.projectId });
      break;
    }
  }

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary,
    title,
    text,
    sections: facts.length ? [{ facts, markdown: false }] : undefined,
  };
}

export async function postMessageCard(
  webhookUrl: string,
  card: MessageCard,
): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    return { ok: res.ok, statusCode: res.status };
  } catch (err) {
    return { ok: false, statusCode: null, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export function registerTeamsDispatcher(): void {
  if (registered) return;
  registered = true;

  for (const type of TEAMS_EVENTS) {
    eventBus.on(type, async (event) => {
      const systems = await externalSystemsService.findActiveByKind('teams');
      if (!systems.length) return;
      const card = buildMessageCard(event);
      for (const sys of systems) {
        const events = sys.events ? sys.events.split(',').filter(Boolean) : TEAMS_EVENTS;
        if (!events.includes(event.type)) continue;
        const url = sys.config.webhookUrl;
        if (typeof url !== 'string' || !url) continue;
        await postMessageCard(url, card);
      }
    });
  }
}
