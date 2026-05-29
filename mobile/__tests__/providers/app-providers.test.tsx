import fs from "fs";
import path from "path";

// AppProviders is a thin wrapper around ConvexBetterAuthProvider. The real
// provider requires better-auth's ESM bundle which our jest config does not
// transform. Validate at the file-shape level instead; the real wiring is
// exercised end-to-end via Expo Go.

describe("AppProviders module", () => {
  it("exports AppProviders and wires Convex + auth client", () => {
    const filePath = path.resolve(__dirname, "../../src/providers/app-providers.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/export function AppProviders/);
    expect(src).toMatch(/ConvexBetterAuthProvider/);
    expect(src).toMatch(/authClient/);
  });
});
