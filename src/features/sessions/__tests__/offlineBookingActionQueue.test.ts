jest.mock("../../../lib/storage/mmkvHotStorage", () => ({
  readJsonFromMmkv: jest.fn(),
  writeJsonToMmkv: jest.fn(),
}));

jest.mock("../../home/api/homeApi", () => ({
  updateBookedSessionStatus: jest.fn().mockResolvedValue(undefined),
}));

import { isNetworkRequestError } from "../offlineBookingActionQueue";

describe("offlineBookingActionQueue", () => {
  it("detects axios network errors", () => {
    expect(isNetworkRequestError({ code: "ERR_NETWORK" })).toBe(true);
    expect(isNetworkRequestError({ code: "ECONNABORTED" })).toBe(true);
    expect(isNetworkRequestError({ message: "Network Error" })).toBe(true);
    expect(isNetworkRequestError({ response: { status: 500 } })).toBe(false);
  });
});
