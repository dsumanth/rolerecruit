import { describe, it, expect } from "vitest";
import { EVALUATOR_ROLE_UNION, evaluatorRoles } from "../../convex/types";

describe("evaluator role union", () => {
  it("includes teacher alongside the original three roles", () => {
    expect(evaluatorRoles).toEqual(["principal", "hod", "hr_admin", "teacher"]);
  });

  it("exports a Convex union validator with all four literals", () => {
    expect(EVALUATOR_ROLE_UNION).toBeDefined();
    expect(EVALUATOR_ROLE_UNION.kind).toBe("union");
  });
});
