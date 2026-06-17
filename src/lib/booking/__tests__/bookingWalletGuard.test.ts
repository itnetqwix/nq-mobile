jest.mock("../../../features/wallet/walletApi", () => ({
  fetchWalletBalance: jest.fn(),
  fetchWalletConfig: jest.fn(),
}));

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

import { Alert } from "react-native";
import { fetchWalletBalance, fetchWalletConfig } from "../../../features/wallet/walletApi";
import { confirmProceedToPaymentIfWalletShort } from "../bookingWalletGuard";

const mockFetchBalance = fetchWalletBalance as jest.Mock;
const mockFetchConfig = fetchWalletConfig as jest.Mock;
const mockAlert = Alert.alert as jest.Mock;

describe("confirmProceedToPaymentIfWalletShort", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBalance.mockResolvedValue({ balances: { available: 10 } });
    mockFetchConfig.mockResolvedValue({ enabled: true, walletPayEnabled: true });
  });

  it("returns true when lesson is free", async () => {
    await expect(confirmProceedToPaymentIfWalletShort(0)).resolves.toBe(true);
    expect(mockFetchBalance).not.toHaveBeenCalled();
  });

  it("returns true when wallet balance covers total", async () => {
    mockFetchBalance.mockResolvedValue({ balances: { available: 50 } });
    await expect(confirmProceedToPaymentIfWalletShort(40)).resolves.toBe(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("shows alert when balance is short", async () => {
    mockAlert.mockImplementation((_t, _m, buttons) => {
      buttons?.find((b: { text: string }) => b.text === "Continue")?.onPress?.();
    });
    await expect(confirmProceedToPaymentIfWalletShort(40)).resolves.toBe(true);
    expect(mockAlert).toHaveBeenCalled();
  });

  it("returns true when wallet pay disabled", async () => {
    mockFetchConfig.mockResolvedValue({ enabled: false });
    await expect(confirmProceedToPaymentIfWalletShort(40)).resolves.toBe(true);
  });
});
