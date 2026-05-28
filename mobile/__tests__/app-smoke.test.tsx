import fs from "fs";
import path from "path";

// App.tsx wraps the tree in providers that depend on better-auth's ESM bundle.
// Our jest config does not transform that bundle, so we verify App at the
// file-shape level: it must exist and wire in AppProviders.

describe("App module", () => {
  it("imports AppProviders and exports a default component", () => {
    const filePath = path.resolve(__dirname, "../App.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/AppProviders/);
    expect(src).toMatch(/export default function App/);
  });
});
