import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const root = process.cwd();
const stageDir = join(root, '.build', 'app');
const ghosteryScopeDir = join(stageDir, 'node_modules', '@ghostery');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

async function copyGhosteryRuntimePackage(packageName) {
  await cp(join(root, 'node_modules', '@ghostery', packageName), join(ghosteryScopeDir, packageName), {
    recursive: true,
  });
}

run('npm', ['run', 'build']);

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await cp(join(root, 'dist'), join(stageDir, 'dist'), { recursive: true });
await cp(join(root, 'assets'), join(stageDir, 'assets'), { recursive: true });
await mkdir(ghosteryScopeDir, { recursive: true });
await copyGhosteryRuntimePackage('adblocker-electron-preload');
await copyGhosteryRuntimePackage('adblocker-content');
await copyGhosteryRuntimePackage('adblocker-extended-selectors');
await writeFile(
  join(stageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      homepage: packageJson.homepage,
      type: 'module',
      main: 'dist/main/main.js',
      author: packageJson.author,
      dependencies: {
        '@ghostery/adblocker-electron-preload': '2.17.3',
      },
      packageManager: 'traversal@0.0.0',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

run('npx', [
  'electron-builder',
  '--projectDir',
  stageDir,
  '--config',
  join(root, 'electron-builder.config.cjs'),
  '--linux',
  'AppImage',
  'deb',
], {
  npm_config_loglevel: 'error',
});
