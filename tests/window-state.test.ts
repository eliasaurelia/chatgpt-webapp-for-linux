import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWindowOptionsFromState,
  extractWindowState,
} from '../src/main/window-state.ts';

test('creates native Linux window options from saved state', () => {
  assert.deepEqual(
    createWindowOptionsFromState({ width: 1000, height: 700, x: 11, y: 22, maximized: false }),
    { width: 1000, height: 700, x: 11, y: 22, frame: true, show: true, backgroundColor: '#f7f7f2' },
  );
});

test('extracts maximized state without persisting transient maximized bounds', () => {
  const fakeWindow = {
    isMaximized: () => true,
    getNormalBounds: () => ({ width: 1100, height: 760, x: 30, y: 50 }),
  };

  assert.deepEqual(extractWindowState(fakeWindow), {
    width: 1100,
    height: 760,
    x: 30,
    y: 50,
    maximized: true,
  });
});
