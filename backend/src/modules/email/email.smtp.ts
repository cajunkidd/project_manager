import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../../db/prisma';
import type { EmailProvider, OutboundEmail } from './email.provider';

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor(opts: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  }) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: opts.user && opts.pass ? { user: opts.user, pass: opts.pass } : undefined,
    });
    this.from = opts.from;
  }

  async send(email: OutboundEmail): Promise<{ id: string }> {
    const log = await prisma.emailLog.create({
      data: {
        direction: 'outbound',
        toAddress: email.to,
        fromAddress: this.from,
        subject: email.subject,
        body: email.body,
        meta: email.meta ? JSON.stringify(email.meta) : null,
      },
    });
    await this.transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.body,
    });
    return { id: log.id };
  }
}
