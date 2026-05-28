// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../../convex/lib/crypto";

beforeAll(() => {
  // 32 random bytes, base64 - matches `openssl rand -base64 32`
  process.env.WHATSAPP_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
});

describe("crypto", () => {
  it("roundtrips a secret", async () => {
    const { cipher, iv } = await encryptSecret("EAAG-super-secret-token");
    expect(cipher).not.toContain("EAAG");
    const plain = await decryptSecret({ cipher, iv });
    expect(plain).toBe("EAAG-super-secret-token");
  });

  it("uses a fresh IV per call", async () => {
    const a = await encryptSecret("same");
    const b = await encryptSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("throws on tampered ciphertext", async () => {
    const { cipher, iv } = await encryptSecret("tamper-me");
    const broken = cipher.slice(0, -4) + (cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(decryptSecret({ cipher: broken, iv })).rejects.toThrow();
  });
});
