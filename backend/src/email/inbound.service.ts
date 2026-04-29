import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface InboundPayload {
  from: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(private prisma: PrismaService) {}

  private extractEmail(field: string): string {
    const match = field.match(/<([^>]+)>/);
    return (match ? match[1] : field).trim().toLowerCase();
  }

  private stripQuotedReply(text: string): string {
    if (!text) return '';
    const lines = text.split('\n');
    const out: string[] = [];
    for (const line of lines) {
      if (/^On .+ wrote:\s*$/i.test(line)) break;
      if (/^-----Original Message-----/i.test(line)) break;
      if (/^From: .+/i.test(line) && out.some((l) => l.trim())) break;
      if (line.startsWith('>')) continue;
      out.push(line);
    }
    return out.join('\n').trim();
  }

  private extractTaskIdPrefix(subject: string): string | null {
    const m = subject.match(/\[task:([a-f0-9]{8})\]/i);
    return m ? m[1] : null;
  }

  async ingest(payload: InboundPayload): Promise<{ result: string; entityId?: string }> {
    if (!payload.from) throw new BadRequestException('Missing from');
    const senderEmail = this.extractEmail(payload.from);

    const sender = await this.prisma.user.findUnique({
      where: { email: senderEmail },
      select: { id: true, displayName: true, isActive: true },
    });
    if (!sender || !sender.isActive) {
      this.logger.warn(`Inbound email from unknown sender: ${senderEmail}`);
      throw new BadRequestException(`Unknown sender: ${senderEmail}`);
    }

    const subject = (payload.subject ?? '').trim();
    const body = this.stripQuotedReply(payload.text ?? '');
    if (!body) throw new BadRequestException('Empty message body');

    const taskIdPrefix = this.extractTaskIdPrefix(subject);
    if (taskIdPrefix) {
      const task = await this.prisma.task.findFirst({
        where: { id: { startsWith: taskIdPrefix } },
        select: { id: true },
      });
      if (task) {
        await this.prisma.comment.create({
          data: {
            taskId: task.id,
            userId: sender.id,
            body,
          },
        });
        this.logger.log(`Inbound reply added comment to task ${task.id} from ${senderEmail}`);
        return { result: 'comment_added', entityId: task.id };
      }
    }

    const cleanedSubject = subject.replace(/^(re|fwd?):\s*/i, '').replace(/\s*\[task:[a-f0-9]+\]\s*$/i, '').trim();
    const task = await this.prisma.task.create({
      data: {
        title: cleanedSubject || `Email from ${sender.displayName}`,
        description: body,
        priority: 'normal',
        status: 'to_do',
        assignedTo: sender.id,
        createdById: sender.id,
      },
      select: { id: true },
    });
    this.logger.log(`Inbound email created task ${task.id} from ${senderEmail}`);
    return { result: 'task_created', entityId: task.id };
  }
}
