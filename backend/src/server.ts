import { createApp } from './app';
import { env } from './config/env';
import { usersService } from './modules/users/users.service';

const app = createApp();

app.listen(env.port, async () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`);
  try {
    const { promoted } = await usersService.syncBootstrapAdmins();
    if (promoted.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`Bootstrap admin sync: promoted ${promoted.join(', ')} → admin`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Bootstrap admin sync failed:', err);
  }
});
