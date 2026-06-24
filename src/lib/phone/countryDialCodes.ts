export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  /** Example national number without country code */
  example: string;
  minDigits: number;
  maxDigits: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "US", name: "United States", dial: "+1", example: "555 010 1234", minDigits: 10, maxDigits: 10 },
  { iso: "CA", name: "Canada", dial: "+1", example: "555 010 1234", minDigits: 10, maxDigits: 10 },
  { iso: "IN", name: "India", dial: "+91", example: "98765 43210", minDigits: 10, maxDigits: 10 },
  { iso: "GB", name: "United Kingdom", dial: "+44", example: "7911 123456", minDigits: 10, maxDigits: 11 },
  { iso: "AU", name: "Australia", dial: "+61", example: "412 345 678", minDigits: 9, maxDigits: 9 },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES.find((c) => c.iso === "US") ?? PHONE_COUNTRIES[0];

export function formatE164Phone(dial: string, national: string): string {
  const dialDigits = dial.replace(/\D/g, "");
  const nationalDigits = national.replace(/\D/g, "");
  if (!dialDigits || !nationalDigits) return "";
  return `+${dialDigits}${nationalDigits}`;
}

export function splitE164Phone(e164: string): { country: PhoneCountry; national: string } {
  const trimmed = e164.trim();
  if (!trimmed) {
    return { country: DEFAULT_PHONE_COUNTRY, national: "" };
  }
  const digits = trimmed.startsWith("+") ? trimmed.slice(1).replace(/\D/g, "") : trimmed.replace(/\D/g, "");
  if (!digits) {
    return { country: DEFAULT_PHONE_COUNTRY, national: "" };
  }

  const sorted = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dial.replace(/\D/g, "").length - a.dial.replace(/\D/g, "").length
  );
  for (const country of sorted) {
    const code = country.dial.replace(/\D/g, "");
    if (digits.startsWith(code)) {
      return { country, national: digits.slice(code.length) };
    }
  }

  return { country: DEFAULT_PHONE_COUNTRY, national: digits };
}

export function isValidNationalPhone(country: PhoneCountry, national: string): boolean {
  const digits = national.replace(/\D/g, "");
  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}
