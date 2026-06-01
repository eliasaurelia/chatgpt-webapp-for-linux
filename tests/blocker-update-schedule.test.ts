import test from 'node:test';
import assert from 'node:assert/strict';

import { computeNextBlockerUpdateDelayMs } from '../src/main/blocker-update-schedule.ts';

test('schedules from the last successful rule update when available', () => {
  assert.equal(
    computeNextBlockerUpdateDelayMs({
      intervalHours: 24,
      lastUpdatedAt: '2026-06-01T00:00:00.000Z',
      now: new Date('2026-06-01T06:00:00.000Z'),
    }),
    18 * 60 * 60 * 1000,
  );
});

test('runs overdue blocker updates immediately', () => {
  assert.equal(
    computeNextBlockerUpdateDelayMs({
      intervalHours: 6,
      lastUpdatedAt: '2026-06-01T00:00:00.000Z',
      now: new Date('2026-06-01T08:00:00.000Z'),
    }),
    0,
  );
});

test('uses the current time as the base when no update timestamp exists', () => {
  assert.equal(
    computeNextBlockerUpdateDelayMs({
      intervalHours: 12,
      lastUpdatedAt: undefined,
      now: new Date('2026-06-01T08:00:00.000Z'),
    }),
    12 * 60 * 60 * 1000,
  );
});
