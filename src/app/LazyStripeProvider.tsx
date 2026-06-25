import React, { useEffect, useState, type ReactNode } from "react";
import {
  STRIPE_APPLE_MERCHANT_IDENTIFIER,
  STRIPE_PUBLISHABLE_KEY,
} from "../config/env";

type Props = {
  children: ReactNode;
};

/**
 * Loads @stripe/stripe-react-native after first frame so its React 19 forwardRef
 * warning and native init do not run during the initial module graph.
 */
export function LazyStripeProvider({ children }: Props) {
  const [StripeProvider, setStripeProvider] = useState<
    React.ComponentType<{
      children: ReactNode;
      publishableKey: string;
      merchantIdentifier?: string;
    }> | null
  >(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const mod = require("@stripe/stripe-react-native") as typeof import("@stripe/stripe-react-native");
      setStripeProvider(() => mod.StripeProvider);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!StripeProvider) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder"}
      merchantIdentifier={STRIPE_APPLE_MERCHANT_IDENTIFIER || undefined}
    >
      {children}
    </StripeProvider>
  );
}
