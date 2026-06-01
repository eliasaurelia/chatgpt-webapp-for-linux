import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { collectRuntimeDependencyNames } from '../scripts/runtime-dependencies.mjs';

test('marks the Ghostery Electron blocker as a runtime dependency', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.ok(packageJson.dependencies?.['@ghostery/adblocker-electron']);
  assert.equal(packageJson.devDependencies?.['@ghostery/adblocker-electron'], undefined);
});

test('packages the complete Ghostery blocker dependency closure', async () => {
  const dependencies = await collectRuntimeDependencyNames(process.cwd(), [
    '@ghostery/adblocker-electron',
  ]);

  assert.ok(dependencies.includes('@ghostery/adblocker-electron'));
  assert.ok(dependencies.includes('@ghostery/adblocker'));
  assert.ok(dependencies.includes('@ghostery/url-parser'));
  assert.ok(dependencies.includes('@remusao/smaz-compress'));
  assert.ok(dependencies.includes('@remusao/smaz-decompress'));
  assert.ok(dependencies.includes('@remusao/trie'));
  assert.ok(dependencies.includes('tldts-core'));
});
