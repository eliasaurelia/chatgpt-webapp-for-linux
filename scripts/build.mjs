import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await rm('dist', { recursive: true, force: true });
run('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit']);
run('npx', [
  'esbuild',
  'src/main/main.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--target=node22',
  '--external:electron',
  '--outfile=dist/main/main.js',
]);
run('npx', [
  'esbuild',
  'src/preload/settings-preload.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node22',
  '--external:electron',
  '--outfile=dist/preload/settings-preload.cjs',
]);
run('npx', [
  'esbuild',
  'src/preload/chat-export-preload.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node22',
  '--external:electron',
  '--outfile=dist/preload/chat-export-preload.cjs',
]);
run('npx', ['vite', 'build']);
