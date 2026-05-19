/**
 * Brand assets bundled with the app.
 * - `netqwix_logo.png` — pin / Q mark (drawer toggle, home header, drawer header)
 * - `netquix_logo_v1.png` — horizontal wordmark (login / sign-up)
 */
export const brandImages = {
  /** Pin badge — sidebar toggle, home nav title, open drawer header */
  netqwixMark: require("../../assets/netqwix_logo.png"),
  netqwixPin: require("../../assets/netqwix_logo.png"),
  /** Horizontal wordmark for auth and loaders */
  netqwixWordmark: require("../../assets/netquix_logo_v1.png"),
} as const;
