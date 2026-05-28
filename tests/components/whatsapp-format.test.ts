import { describe, it, expect } from "vitest";
import { formatUsd } from "../../app/dashboard/settings/messaging/whatsapp/_components/format";

describe("formatUsd", () => {
  it("formats to 2 dp with a dollar sign", () => {
    expect(formatUsd(20.954)).toBe("$20.95");
    expect(formatUsd(0)).toBe("$0.00");
  });
});
