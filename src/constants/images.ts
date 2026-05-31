/**
 * Brand assets bundled with the app.
 * - `netqwix_logo.png` — pin / Q mark (drawer toggle, compact header)
 * - `netqwix_logo-fulll.png` — full horizontal logo (drawer, auth, loaders, splash)
 */
export const brandImages = {
  /** Pin badge — sidebar toggle, home nav title */
  netqwixMark: require("../../assets/netqwix_logo.png"),
  netqwixPin: require("../../assets/netqwix_logo.png"),
  /** Full NetQwix wordmark + mark (login, sign-up, drawer, loaders) */
  netqwixWordmark: require("../../assets/netqwix_logo-fulll.png"),
  netqwixFullLogo: require("../../assets/netqwix_logo-fulll.png"),
} as const;
