import { recurringService } from './recurring.service';

let timer: NodeJS.Timeout | null = null;

const TICK_MS = 60_000; // every minute

export function registerRecurringScheduler(): void {
  if (timer) return;
  if (process.env.NODE_ENV === 'test') return; // tests trigger runDue() explicitly
  // Fire immediately so any backlog from while the server was down is handled.
  recurringService.runDue().catch((e) => console.warn('[recurring] initial run failed:', e));
  timer = setInterval(() => {
    recurringService.runDue().catch((e) => console.warn('[recurring] tick failed:', e));
  }, TICK_MS);
  if (timer.unref) timer.unref();
}

export function stopRecurringScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
