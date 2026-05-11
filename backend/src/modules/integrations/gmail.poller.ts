import { gmailService } from './gmail.service';

let timer: NodeJS.Timeout | null = null;

export interface GmailPollerOptions {
  intervalMs?: number;
  redirectUri?: string;
}

/**
 * Starts a background interval that polls every connected Gmail label and
 * ingests new messages as tasks. Off by default; opt in by setting
 * GMAIL_POLLER_ENABLED=1 in the environment, or by calling startGmailPoller
 * explicitly.
 */
export function startGmailPoller(opts: GmailPollerOptions = {}): void {
  if (timer) return;
  const intervalMs = opts.intervalMs ?? Number(process.env.GMAIL_POLL_INTERVAL_MS ?? 60_000);
  const redirectUri =
    opts.redirectUri ?? process.env.GMAIL_REDIRECT_URI ?? 'http://localhost:4000/api/integrations/gmail/oauth/callback';

  const tick = async () => {
    try {
      await gmailService.pollAll(redirectUri);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('Gmail poller error:', err);
      }
    }
  };

  timer = setInterval(tick, intervalMs);
  // Keep the loop from blocking process shutdown.
  if (typeof timer.unref === 'function') timer.unref();
  // Run once on startup.
  void tick();
}

export function stopGmailPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function maybeAutoStartGmailPoller(): void {
  if (process.env.GMAIL_POLLER_ENABLED === '1') startGmailPoller();
}
