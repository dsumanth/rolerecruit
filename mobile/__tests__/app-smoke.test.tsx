import fs from "fs";
import path from "path";

// App.tsx imports AppProviders which constructs a ConvexReactClient at
// module load and throws unless EXPO_PUBLIC_CONVEX_URL is configured. The
// jest environment does not provide that URL, so we verify App at the
// file-shape level: it must wire SafeAreaProvider, AppProviders, and AppNav.
// The auth-gated render path is covered by __tests__/navigation/app-nav.test.tsx.

describe("App module", () => {
  it("wires SafeAreaProvider, AppProviders, and AppNav", () => {
    const filePath = path.resolve(__dirname, "../App.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/SafeAreaProvider/);
    expect(src).toMatch(/AppProviders/);
    expect(src).toMatch(/AppNav/);
    expect(src).toMatch(/export default function App/);
  });
});
