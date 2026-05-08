import { prisma } from '../../db/prisma';

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  meta?: Record<string, unknown>;
}

export interface EmailProvider {
  send(email: OutboundEmail): Promise<{ id: string }>;
}

class CapturingProvider implements EmailProvider {
  public sent: OutboundEmail[] = [];

  async send(email: OutboundEmail): Promise<{ id: string }> {
    this.sent.push(email);
    const log = await prisma.emailLog.create({
      data: {
        direction: 'outbound',
        toAddress: email.to,
        subject: email.subject,
        body: email.body,
        meta: email.meta ? JSON.stringify(email.meta) : null,
      },
    });
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log(`[email:stub] → ${email.to} :: ${email.subject}`);
    }
    return { id: log.id };
  }

  reset() {
    this.sent = [];
  }
}

const stubProvider = new CapturingProvider();
let activeProvider: EmailProvider = stubProvider;

export function setEmailProvider(provider: EmailProvider): void {
  activeProvider = provider;
}

export function getEmailProvider(): EmailProvider {
  return activeProvider;
}

export function getStubProvider(): CapturingProvider {
  return stubProvider;
}
