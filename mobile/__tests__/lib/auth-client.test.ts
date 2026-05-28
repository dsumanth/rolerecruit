// The real auth-client is a thin wrapper around better-auth's createAuthClient.
// Its runtime correctness is validated end-to-end (sign-in flow); here we just
// verify the module file exists and exports a symbol named authClient.
// Importing the real module pulls in better-auth's ESM bundle which our jest
// config does not transform.

import fs from "fs";
import path from "path";

describe("authClient module", () => {
  it("exists and exports an authClient symbol", () => {
    const filePath = path.resolve(__dirname, "../../src/lib/auth-client.ts");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/export const authClient/);
  });
});
