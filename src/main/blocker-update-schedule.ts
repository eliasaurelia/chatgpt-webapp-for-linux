export interface BlockerUpdateScheduleInput {
  intervalHours: number;
  lastUpdatedAt?: string;
  now: Date;
}

export function computeNextBlockerUpdateDelayMs(input: BlockerUpdateScheduleInput): number {
  const intervalMs = input.intervalHours * 60 * 60 * 1000;
  const parsedLastUpdatedAt = input.lastUpdatedAt ? Date.parse(input.lastUpdatedAt) : Number.NaN;
  const baseTime = Number.isFinite(parsedLastUpdatedAt) ? parsedLastUpdatedAt : input.now.getTime();

  return Math.max(0, baseTime + intervalMs - input.now.getTime());
}
