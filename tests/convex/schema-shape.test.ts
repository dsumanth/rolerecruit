import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";

describe("schema shape", () => {
  it("defines demoSessions table", () => {
    expect(schema.tables.demoSessions).toBeDefined();
  });
  it("defines evaluationInvites table", () => {
    expect(schema.tables.evaluationInvites).toBeDefined();
  });
  it("defines formTemplates table", () => {
    expect(schema.tables.formTemplates).toBeDefined();
  });
  it("defines decisionRules table", () => {
    expect(schema.tables.decisionRules).toBeDefined();
  });
  it("evaluations table has inviteId field", () => {
    const ev = schema.tables.evaluations;
    expect(ev).toBeDefined();
    const validator = (ev as any).validator;
    expect(validator.fields.inviteId).toBeDefined();
  });
});
