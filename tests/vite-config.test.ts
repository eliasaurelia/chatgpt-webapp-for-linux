import test from 'node:test';
import assert from 'node:assert/strict';

import viteConfig from '../vite.config.ts';

test('uses relative asset URLs so the privacy window works from file URLs', () => {
  const config = typeof viteConfig === 'function' ? viteConfig({ command: 'build', mode: 'production' }) : viteConfig;

  assert.equal(config.base, './');
});
