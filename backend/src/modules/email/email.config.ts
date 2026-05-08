import { setEmailProvider } from './email.provider';
import { SmtpEmailProvider } from './email.smtp';

export function configureEmailProvider(): void {
  const provider = process.env.EMAIL_PROVIDER ?? 'stub';
  if (provider === 'smtp' && process.env.SMTP_HOST) {
    setEmailProvider(
      new SmtpEmailProvider({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM ?? 'no-reply@example.com',
      }),
    );
  }
  // else: keep the default capturing stub.
}
