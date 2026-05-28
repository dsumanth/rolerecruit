import fs from "fs";
import path from "path";

describe("HRTabs file", () => {
  it("registers Candidates and Pipeline tabs", () => {
    const filePath = path.resolve(__dirname, "../../src/navigation/hr-tabs.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/Tab\.Screen\s+name="Inbox"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Calendar"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Candidates"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Pipeline"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Profile"/);
  });
});

describe("AppNav HR branch", () => {
  it("imports HRTabs and switches on useRoleContext.isHR", () => {
    const filePath = path.resolve(__dirname, "../../src/navigation/app-nav.tsx");
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/from "@\/navigation\/hr-tabs"/);
    expect(src).toMatch(/useRoleContext/);
    expect(src).toMatch(/isHR/);
  });
});
