import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  VITE_E2E: 'true',
  VITE_VIBE_MODE: '',
  DISABLE_HMR: 'true',
  PORT: process.env.PORT ?? '8080',
};

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', 'dev'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
