/**
 * Simple encryption/decryption for API keys stored in KV.
 * Uses AES-256-GCM with a server-side secret.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

function getSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 chars');
  }
  return secret;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.slice(0, 32)),
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
  return keyMaterial;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey(getSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Pack iv + ciphertext as base64
  const packed = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...packed));
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await deriveKey(getSecret());
  const packed = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));

  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
