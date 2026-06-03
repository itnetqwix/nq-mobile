import * as Linking from "expo-linking";
import { useEffect, useState } from "react";

export type ReferralSignupParams = {
  referralCode?: string;
  referrerId?: string;
};

function parseReferralUrl(url: string | null): ReferralSignupParams {
  if (!url) return {};
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams ?? {};
    const code = typeof q.code === "string" ? q.code.trim().toUpperCase() : undefined;
    const ref = typeof q.ref === "string" ? q.ref.trim() : undefined;
    if (!code && !ref) return {};
    return { referralCode: code, referrerId: ref };
  } catch {
    return {};
  }
}

/** Reads `?code=` / `?ref=` from `netqwix://signup` or universal links. */
export function useReferralSignupParams(): ReferralSignupParams {
  const [params, setParams] = useState<ReferralSignupParams>({});

  useEffect(() => {
    const apply = (url: string | null) => {
      const next = parseReferralUrl(url);
      if (next.referralCode || next.referrerId) setParams(next);
    };
    void Linking.getInitialURL().then(apply);
    const sub = Linking.addEventListener("url", ({ url }) => apply(url));
    return () => sub.remove();
  }, []);

  return params;
}
