/**
 * Game-plan PDF via expo-print (must be in native dev/production builds).
 * Static import so Metro bundles the native module; dynamic import often fails silently.
 */

import * as Print from "expo-print";

export type PdfPrintResult = {
  uri: string;
};

/** True when the native print module is linked in this binary. */
export function isPdfPrintAvailable(): boolean {
  return (
    typeof Print.printToFileAsync === "function" &&
    typeof Print.printAsync === "function"
  );
}

/**
 * Renders HTML to a temporary PDF file.
 * @throws when expo-print is unavailable (e.g. Expo Go without dev client rebuild).
 */
export async function printHtmlToPdfFile(html: string): Promise<PdfPrintResult> {
  if (!isPdfPrintAvailable()) {
    throw new Error(
      "PDF export is not available in this build. Rebuild the dev client after installing expo-print (npm run ios:device / android:install-dev)."
    );
  }
  const result = await Print.printToFileAsync({
    html,
    base64: false,
    width: 612,
    height: 792,
  });
  if (!result?.uri) {
    throw new Error("PDF export failed — no file was created.");
  }
  return { uri: result.uri };
}
