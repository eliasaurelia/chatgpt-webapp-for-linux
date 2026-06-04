import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LINUX_CHROMIUM_SWITCHES,
  USER_CHROMIUM_FLAGS_FILE_NAME,
  applyLinuxChromiumFlags,
  parseUserChromiumFlagsConfig,
  userChromiumFlagsPath,
} from '../src/main/chromium-flags.ts';

test('uses a project-specific flags file under XDG_CONFIG_HOME', () => {
  assert.equal(USER_CHROMIUM_FLAGS_FILE_NAME, 'chatgpt-webapp-flags.conf');
  assert.equal(
    userChromiumFlagsPath({ XDG_CONFIG_HOME: '/tmp/config' }, '/home/user'),
    '/tmp/config/chatgpt-webapp-flags.conf',
  );
});

test('falls back to ~/.config for the user flags file', () => {
  assert.equal(
    userChromiumFlagsPath({}, '/home/user'),
    '/home/user/.config/chatgpt-webapp-flags.conf',
  );
});

test('parses user Chromium flags while ignoring blank lines and comments', () => {
  const result = parseUserChromiumFlagsConfig(`
    # Wayland override
    --ozone-platform=wayland

    --enable-features=UseOzonePlatform,WaylandWindowDecorations
  `);

  assert.deepEqual(result.flags, [
    '--ozone-platform=wayland',
    '--enable-features=UseOzonePlatform,WaylandWindowDecorations',
  ]);
  assert.deepEqual(result.invalidLines, []);
});

test('reports invalid lines without dropping valid flags', () => {
  const result = parseUserChromiumFlagsConfig(`
    ozone-platform=wayland
    --enable-wayland-ime
  `);

  assert.deepEqual(result.flags, ['--enable-wayland-ime']);
  assert.deepEqual(result.invalidLines, [
    {
      lineNumber: 2,
      text: 'ozone-platform=wayland',
    },
  ]);
});

test('applies default Linux switches before user flags', () => {
  const calls: string[] = [];

  applyLinuxChromiumFlags(
    {
      appendSwitch: (name, value) => {
        calls.push(value === undefined ? `switch:${name}` : `switch:${name}=${value}`);
      },
      appendArgument: (argument) => {
        calls.push(`argument:${argument}`);
      },
    },
    ['--ozone-platform=wayland'],
  );

  assert.deepEqual(calls, [
    ...DEFAULT_LINUX_CHROMIUM_SWITCHES.map(({ name, value }) => `switch:${name}=${value}`),
    'argument:--ozone-platform=wayland',
  ]);
});
