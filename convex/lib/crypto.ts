const ALG = "AES-GCM";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const keyB64 = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!keyB64) throw new Error("WHATSAPP_ENCRYPTION_KEY not set");
  return crypto.subtle.importKey("raw", b64decode(keyB64), { name: ALG }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(plaintext: string): Promise<{ cipher: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: ALG, iv }, key, new TextEncoder().encode(plaintext));
  return { cipher: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

export async function decryptSecret({ cipher, iv }: { cipher: string; iv: string }): Promise<string> {
  const key = await importKey();
  const pt = await crypto.subtle.decrypt({ name: ALG, iv: b64decode(iv) }, key, b64decode(cipher));
  return new TextDecoder().decode(pt);
}
