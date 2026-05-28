export const STALLED_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STAGES = new Set(["rejected", "hired", "withdrawn"]);

export interface StalledInput {
  now: number;
  lastOutboundAt: number | null;
  lastInboundAt: number | null;
  stage: string;
}

export function isStalled(input: StalledInput): boolean {
  if (TERMINAL_STAGES.has(input.stage)) return false;
  if (input.lastOutboundAt == null) return false;
  if (input.lastInboundAt != null && input.lastInboundAt >= input.lastOutboundAt) return false;
  const ageMs = input.now - input.lastOutboundAt;
  return ageMs >= STALLED_DAYS * DAY_MS;
}
