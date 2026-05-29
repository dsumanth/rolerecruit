import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";

describe("userProfiles schema", () => {
  it("declares an optional expoPushTokens field", () => {
    const validator = (schema.tables.userProfiles as any).validator;
    expect(validator.fields.expoPushTokens).toBeDefined();
    // Optional fields wrap their inner validator in a v.optional() shape.
    const inner = validator.fields.expoPushTokens;
    // convex/values marks optionality via isOptional === "optional".
    expect(inner.isOptional).toBe("optional");
  });
});
