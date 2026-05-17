import { useCallback, useEffect, useRef, useState } from "react";
import {
  decryptChatPayload,
  encryptChatPayload,
  isEncryptedChatContent,
  loadOrCreateLocalChatKeys,
  publicKeyFromBase64,
} from "../crypto/chatEncryption";
import { fetchPartnerChatPublicKey, registerMyChatPublicKey } from "../crypto/chatKeysApi";

export function useChatE2E(partnerUserId: string | undefined) {
  const [ready, setReady] = useState(false);
  const [canEncrypt, setCanEncrypt] = useState(false);
  const keysRef = useRef<Awaited<ReturnType<typeof loadOrCreateLocalChatKeys>> | null>(null);
  const partnerPubRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setCanEncrypt(false);
    void (async () => {
      try {
        const keys = await loadOrCreateLocalChatKeys();
        keysRef.current = keys;
        await registerMyChatPublicKey();
        let partnerPub: Uint8Array | null = null;
        if (partnerUserId) {
          const pkB64 = await fetchPartnerChatPublicKey(partnerUserId);
          partnerPub = pkB64 ? publicKeyFromBase64(pkB64) : null;
        }
        partnerPubRef.current = partnerPub;
        if (!cancelled) {
          setCanEncrypt(Boolean(partnerPub));
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setCanEncrypt(false);
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerUserId]);

  const encryptForSend = useCallback(
    (plaintext: string): string => {
      const keys = keysRef.current;
      const their = partnerPubRef.current;
      if (!keys || !their) return plaintext;
      return encryptChatPayload(plaintext, keys.secretKey, their);
    },
    []
  );

  const decryptForDisplay = useCallback((content: string): string => {
    if (!isEncryptedChatContent(content)) return content;
    const keys = keysRef.current;
    const their = partnerPubRef.current;
    if (!keys || !their) return "🔒 Encrypted message";
    return decryptChatPayload(content, keys.secretKey, their) ?? "🔒 Unable to decrypt";
  }, []);

  return {
    ready,
    canEncrypt,
    encryptForSend,
    decryptForDisplay,
    isE2EActive: canEncrypt,
  };
}
