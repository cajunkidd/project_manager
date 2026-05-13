import { createApp } from './app';
import { env } from './config/env';
import { ensureMasterAccount } from './modules/users/bootstrap-master';

const app = createApp();

ensureMasterAccount().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to ensure master account:', err);
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`);
});
