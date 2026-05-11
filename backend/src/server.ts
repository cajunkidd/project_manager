import { exec } from 'child_process';
import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  const url = `http://localhost:${env.port}`;
  // eslint-disable-next-line no-console
  console.log(`Project Manager is running at ${url}`);

  if (process.env.OPEN_BROWSER === '1') {
    const cmd =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`;
    exec(cmd, () => {
      /* best-effort */
    });
  }
});
