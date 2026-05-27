import { describe, it, expect } from "vitest";
import { isIdsMode, isMatchAllMode, type BulkInput } from "../../lib/bulk-input";

describe("BulkInput discriminators", () => {
  it("isIdsMode identifies the ids shape", () => {
    const a: BulkInput<{}> = { ids: ["a", "b"] };
    expect(isIdsMode(a)).toBe(true);
    expect(isMatchAllMode(a)).toBe(false);
  });

  it("isMatchAllMode identifies the matchAll shape", () => {
    const a: BulkInput<{ schoolId: string }> = { matchAll: { schoolId: "s1" } };
    expect(isIdsMode(a)).toBe(false);
    expect(isMatchAllMode(a)).toBe(true);
  });
});
