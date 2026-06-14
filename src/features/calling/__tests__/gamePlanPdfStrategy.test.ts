jest.mock("../../../config/env", () => ({
  SERVER_GAME_PLAN_PDF_ENABLED: true,
}));

import {
  reportPayloadHasImages,
  shouldUseServerGamePlanPdfStitch,
} from "../gamePlanPdfStrategy";

describe("gamePlanPdfStrategy", () => {
  it("detects image payloads", () => {
    expect(reportPayloadHasImages([])).toBe(false);
    expect(reportPayloadHasImages([{ imageUrl: "file-1.png" }])).toBe(true);
  });

  it("uses server stitch when enabled and images exist", () => {
    expect(shouldUseServerGamePlanPdfStitch([{ imageUrl: "a.png" }])).toBe(true);
    expect(shouldUseServerGamePlanPdfStitch([])).toBe(false);
  });
});

describe("gamePlanPdfStrategy (server disabled)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../../../config/env", () => ({
      SERVER_GAME_PLAN_PDF_ENABLED: false,
    }));
  });

  it("falls back to client PDF path when env is false", async () => {
    const mod = await import("../gamePlanPdfStrategy");
    expect(mod.shouldUseServerGamePlanPdfStitch([{ imageUrl: "a.png" }])).toBe(false);
  });
});
