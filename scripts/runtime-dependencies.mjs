import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function packagePath(root, packageName) {
  return join(root, 'node_modules', ...packageName.split('/'));
}

export async function readRuntimePackageJson(root, packageName) {
  return JSON.parse(await readFile(join(packagePath(root, packageName), 'package.json'), 'utf8'));
}

export async function collectRuntimeDependencyNames(root, packageNames) {
  const seen = new Set();
  const queue = [...packageNames];

  while (queue.length > 0) {
    const packageName = queue.shift();
    if (!packageName || seen.has(packageName)) {
      continue;
    }

    seen.add(packageName);
    const packageJson = await readRuntimePackageJson(root, packageName);
    queue.push(...Object.keys(packageJson.dependencies ?? {}));
  }

  return [...seen].sort();
}

export async function collectRuntimeDependencyVersions(root, packageNames) {
  const versions = {};

  for (const packageName of packageNames) {
    const packageJson = await readRuntimePackageJson(root, packageName);
    versions[packageName] = packageJson.version;
  }

  return versions;
}

export async function copyRuntimeDependencyClosure({ root, stageDir, packageNames }) {
  const dependencies = await collectRuntimeDependencyNames(root, packageNames);

  for (const packageName of dependencies) {
    const destination = join(stageDir, 'node_modules', ...packageName.split('/'));
    await mkdir(dirname(destination), { recursive: true });
    await cp(packagePath(root, packageName), destination, { recursive: true });
  }

  return dependencies;
}
