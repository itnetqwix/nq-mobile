import { Alert, Linking, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { navigationRef, navigateToAuthLogin, navigateToWalletTopUp } from "../../../navigation/navigationRef";
import type { SystemStateActionId } from "../presets/types";

const REMEMBER_DEVICE_KEY = "nq_remember_device";

export type ActionContext = {
  onRetry?: () => void;
  onDismiss?: () => void;
};

export async function getRememberDevice(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(REMEMBER_DEVICE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setRememberDevice(enabled: boolean): Promise<void> {
  try {
    if (enabled) await SecureStore.setItemAsync(REMEMBER_DEVICE_KEY, "1");
    else await SecureStore.deleteItemAsync(REMEMBER_DEVICE_KEY);
  } catch {
    /* noop */
  }
}

export async function runSystemStateAction(
  action: SystemStateActionId,
  ctx: ActionContext = {}
): Promise<void> {
  switch (action) {
    case "go_home":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main");
      }
      ctx.onDismiss?.();
      break;
    case "go_back":
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
      }
      ctx.onDismiss?.();
      break;
    case "retry":
      ctx.onRetry?.();
      break;
    case "auth_login":
      ctx.onDismiss?.();
      await navigateToAuthLogin();
      break;
    case "auth_signup":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Auth", { screen: "SignUp" });
      }
      break;
    case "contact_support":
      void Linking.openURL("mailto:support@netqwix.com?subject=NetQwix%20App%20Support");
      break;
    case "open_faq":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "DashboardFeature",
              params: { featureId: "faq" },
            },
          },
        });
      }
      break;
    case "open_settings":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "ShellSurface",
              params: { surfaceId: "settings" },
            },
          },
        });
      }
      break;
    case "open_wallet":
      navigateToWalletTopUp();
      ctx.onDismiss?.();
      break;
    case "open_notifications":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "ShellSurface",
              params: { surfaceId: "notifications" },
            },
          },
        });
      }
      break;
    case "resend_email":
      Alert.alert(
        "Verification email",
        "Check your inbox for a verification link. Contact support if you need help."
      );
      break;
    case "verify_phone":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main");
      }
      break;
    case "book_lesson":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: { screen: "Schedule" },
        });
      }
      break;
    case "open_clips":
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate("Main", {
          screen: "Tabs",
          params: {
            screen: "Home",
            params: {
              screen: "ShellSurface",
              params: { surfaceId: "clips" },
            },
          },
        });
      }
      break;
    case "open_privacy":
      void Linking.openURL("https://www.netqwix.com/privacy-policy");
      break;
    case "open_terms":
      void Linking.openURL("https://www.netqwix.com/terms-and-conditions");
      break;
    case "open_store": {
      const iosId = Constants.expoConfig?.ios?.bundleIdentifier;
      const androidPkg = Constants.expoConfig?.android?.package;
      const url =
        Platform.OS === "ios"
          ? `https://apps.apple.com/app/id${iosId ?? "netqwix"}`
          : `https://play.google.com/store/apps/details?id=${androidPkg ?? "com.netqwix.app"}`;
      void Linking.openURL(url);
      break;
    }
    case "toggle_remember_device": {
      const next = !(await getRememberDevice());
      await setRememberDevice(next);
      Alert.alert(
        "Remember device",
        next
          ? "We'll keep you signed in on this device when possible."
          : "You'll need to sign in again after your session expires."
      );
      break;
    }
    case "dismiss":
      ctx.onDismiss?.();
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
      }
      break;
    default:
      break;
  }
}

export function navigateToSystemState(
  stateId: import("../presets/types").SystemStateId,
  params?: { message?: string }
) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate("SystemState", {
    stateId,
    message: params?.message,
  });
  return true;
}
