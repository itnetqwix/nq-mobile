import React from "react";
import { useCmsLiveRefresh } from "./hooks/useCmsLiveRefresh";

/** Polls CMS manifest and refreshes banners/tips/legal/blogs without app updates. */
export function CmsLiveRefreshBridge() {
  useCmsLiveRefresh(true);
  return null;
}
