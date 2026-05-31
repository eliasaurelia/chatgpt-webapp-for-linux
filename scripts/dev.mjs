import { spawn, spawnSync } from 'node:child_process';

const devServerUrl = 'http://127.0.0.1:5173';
const processes = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });
  processes.push(child);
  return child;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Vite did not respond at ${url}`);
}

function shutdown() {
  for (const child of processes) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(143);
});

run('npm', ['run', 'build']);

start('npx', ['vite', '--host', '127.0.0.1']);
await waitForServer(devServerUrl);

const electron = start('npx', ['electron', '.'], {
  env: {
    CHATGPT_WEBAPP_DEV_SERVER_URL: devServerUrl,
  },
});

electron.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 0);
});

