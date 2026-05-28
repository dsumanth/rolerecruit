import { describe, it, expect } from "vitest";
import { generateToken } from "../../convex/lib/tokenGen";

describe("generateToken", () => {
  it("returns a 32-char lowercase alphanumeric string", () => {
    const t = generateToken();
    expect(t).toMatch(/^[a-z0-9]{32}$/);
  });
  it("returns different tokens on successive calls", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});
