/**
 * OkHttp (Android) only allows tab + printable ASCII in header values.
 * REST uses addUnsafeNonAscii; WebSocketModule does not — sanitize before WS upgrade.
 */
export function sanitizeHttpHeaderValue(value: string): string {
  let out = "";
  let changed = false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x09 || (c >= 0x20 && c <= 0x7e)) {
      out += value[i];
    } else {
      changed = true;
    }
  }
  return changed ? out : value;
}

export function sanitizeHttpHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = sanitizeHttpHeaderValue(value);
  }
  return out;
}
