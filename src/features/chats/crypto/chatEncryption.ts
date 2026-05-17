import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
import * as SecureStore from "expo-secure-store";

export const CHAT_ENC_PREFIX = "NQENC1:";
const SECRET_KEY_STORAGE = "nq_chat_secret_key_v1";
const PUBLIC_KEY_STORAGE = "nq_chat_public_key_v1";

export type ChatKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export function generateChatKeyPair(): ChatKeyPair {
  const pair = nacl.box.keyPair();
  return { publicKey: pair.publicKey, secretKey: pair.secretKey };
}

export async function loadOrCreateLocalChatKeys(): Promise<ChatKeyPair> {
  const pubB64 = await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE);
  const secB64 = await SecureStore.getItemAsync(SECRET_KEY_STORAGE);
  if (pubB64 && secB64) {
    return {
      publicKey: decodeBase64(pubB64),
      secretKey: decodeBase64(secB64),
    };
  }
  const pair = generateChatKeyPair();
  await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE, encodeBase64(pair.publicKey));
  await SecureStore.setItemAsync(SECRET_KEY_STORAGE, encodeBase64(pair.secretKey));
  return pair;
}

export function publicKeyToBase64(publicKey: Uint8Array): string {
  return encodeBase64(publicKey);
}

export function publicKeyFromBase64(b64: string): Uint8Array | null {
  try {
    const bytes = decodeBase64(b64.trim());
    if (bytes.length !== nacl.box.publicKeyLength) return null;
    return bytes;
  } catch {
    return null;
  }
}

function sharedKey(mySecret: Uint8Array, theirPublic: Uint8Array): Uint8Array | null {
  try {
    return nacl.box.before(theirPublic, mySecret);
  } catch {
    return null;
  }
}

export function encryptChatPayload(plaintext: string, mySecret: Uint8Array, theirPublic: Uint8Array): string {
  const shared = sharedKey(mySecret, theirPublic);
  if (!shared) throw new Error("Could not establish secure channel.");
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = new TextEncoder().encode(plaintext);
  const boxed = nacl.box.after(message, nonce, shared);
  const packed = new Uint8Array(nonce.length + boxed.length);
  packed.set(nonce);
  packed.set(boxed, nonce.length);
  return `${CHAT_ENC_PREFIX}${encodeBase64(packed)}`;
}

export function decryptChatPayload(ciphertext: string, mySecret: Uint8Array, theirPublic: Uint8Array): string | null {
  if (!ciphertext.startsWith(CHAT_ENC_PREFIX)) return ciphertext;
  const shared = sharedKey(mySecret, theirPublic);
  if (!shared) return null;
  try {
    const packed = decodeBase64(ciphertext.slice(CHAT_ENC_PREFIX.length));
    const nonce = packed.slice(0, nacl.box.nonceLength);
    const boxed = packed.slice(nacl.box.nonceLength);
    const opened = nacl.box.open.after(boxed, nonce, shared);
    if (!opened) return null;
    return new TextDecoder().decode(opened);
  } catch {
    return null;
  }
}

export function isEncryptedChatContent(content: string | undefined | null): boolean {
  return typeof content === "string" && content.startsWith(CHAT_ENC_PREFIX);
}

/** Encrypt binary media before upload. */
export function encryptChatBytes(bytes: Uint8Array, mySecret: Uint8Array, theirPublic: Uint8Array): Uint8Array {
  const shared = sharedKey(mySecret, theirPublic);
  if (!shared) throw new Error("Could not establish secure channel.");
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box.after(bytes, nonce, shared);
  const packed = new Uint8Array(nonce.length + boxed.length);
  packed.set(nonce);
  packed.set(boxed, nonce.length);
  return packed;
}

export function decryptChatBytes(packed: Uint8Array, mySecret: Uint8Array, theirPublic: Uint8Array): Uint8Array | null {
  const shared = sharedKey(mySecret, theirPublic);
  if (!shared) return null;
  try {
    const nonce = packed.slice(0, nacl.box.nonceLength);
    const boxed = packed.slice(nacl.box.nonceLength);
    return nacl.box.open.after(boxed, nonce, shared);
  } catch {
    return null;
  }
}
