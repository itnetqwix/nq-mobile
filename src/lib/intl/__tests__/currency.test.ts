jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US", regionCode: "US", currencyCode: "USD" }],
  getCalendars: () => [{ calendar: "gregory" }],
}));

jest.mock("i18next", () => ({
  __esModule: true,
  default: { language: "en" },
}));

import { formatCurrency, formatCurrencyMinor } from "../currency";

describe("currency formatting", () => {
  it("formats USD with two decimals", () => {
    const s = formatCurrency(42.5, { currency: "USD", locale: "en-US" });
    expect(s).toContain("42.50");
    expect(s).toContain("$");
  });

  it("formats minor units as major currency", () => {
    expect(formatCurrencyMinor(5025, { currency: "USD", locale: "en-US" })).toContain("50.25");
  });

  it("formats JPY without fractional digits", () => {
    const s = formatCurrency(980, { currency: "JPY", locale: "ja-JP" });
    expect(s).toMatch(/980/);
    expect(s).not.toContain(".00");
  });
});
