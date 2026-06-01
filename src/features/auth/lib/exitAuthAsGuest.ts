import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "../../../navigation/navigationRef";

type ParentNav = {
  canGoBack?: () => boolean;
  goBack?: () => void;
};

/**
 * Leave the Auth modal after intro or from login/sign-up.
 * Uses goBack when Auth was presented on top of Main; otherwise resets to guest home.
 */
export function exitAuthAsGuest(navigation: {
  getParent?: () => ParentNav | undefined;
}): void {
  const parent = navigation.getParent?.();
  if (parent?.canGoBack?.()) {
    parent.goBack?.();
    return;
  }
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  }
}
