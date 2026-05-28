import { describe, it, expect } from "vitest";
import { BUILT_IN_TEMPLATES } from "../../convex/formTemplates.defaults";

describe("built-in form template defaults", () => {
  it("provides one default template per evaluator role", () => {
    const roles = BUILT_IN_TEMPLATES.map((t) => t.role).sort();
    expect(roles).toEqual(["hod", "hr_admin", "principal", "teacher"]);
  });
  it("every default ends with a dictation-enabled comments field", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const last = t.fields[t.fields.length - 1];
      expect(last.key).toBe("comments");
      expect(last.type).toBe("text");
      expect(last.allowDictation).toBe(true);
    }
  });
  it("principal default has subject knowledge, classroom management, communication, overall fit, comments", () => {
    const p = BUILT_IN_TEMPLATES.find((t) => t.role === "principal")!;
    expect(p.fields.map((f) => f.key)).toEqual([
      "subjectKnowledge",
      "classroomManagement",
      "communication",
      "overallFit",
      "comments",
    ]);
  });
  it("HOD default weights subjectKnowledge and pedagogy at 2", () => {
    const h = BUILT_IN_TEMPLATES.find((t) => t.role === "hod")!;
    expect(h.fields.find((f) => f.key === "subjectKnowledge")?.weight).toBe(2);
    expect(h.fields.find((f) => f.key === "pedagogy")?.weight).toBe(2);
  });
});
