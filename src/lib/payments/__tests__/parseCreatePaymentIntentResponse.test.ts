import {
  parseCreatePaymentIntentResponse,
  resolvePaymentIntentBookingType,
} from "../parseCreatePaymentIntentResponse";

describe("parseCreatePaymentIntentResponse", () => {
  it("unwraps client_secret from axios envelope", () => {
    const res = {
      data: {
        status: 1,
        data: { client_secret: "pi_test_secret", id: "pi_test" },
      },
    };
    expect(parseCreatePaymentIntentResponse(res)).toEqual({
      skip: false,
      client_secret: "pi_test_secret",
      id: "pi_test",
    });
  });

  it("returns skip when server marks free checkout", () => {
    const res = { data: { data: { skip: true } } };
    expect(parseCreatePaymentIntentResponse(res)).toEqual({ skip: true });
  });

  it("throws with server message when secret missing", () => {
    const res = { data: { data: { message: "Quote expired" } } };
    expect(() => parseCreatePaymentIntentResponse(res)).toThrow("Quote expired");
  });
});

describe("resolvePaymentIntentBookingType", () => {
  it("maps scheduled to session_booking", () => {
    expect(resolvePaymentIntentBookingType("scheduled")).toBe("session_booking");
  });
});
