/** Matrix: R2 — report payload parsing */
import {
  normalizeReportImageKeys,
  parseReportScreenshotItems,
  toReportDataPayload,
} from "../reportDataUtils";

describe("reportDataUtils", () => {
  it("normalizes legacy string keys", () => {
    expect(normalizeReportImageKeys(["file-a.jpg", "file-b.jpg"])).toEqual([
      "file-a.jpg",
      "file-b.jpg",
    ]);
  });

  it("parses objects with title and description", () => {
    const items = parseReportScreenshotItems([
      { imageUrl: "k1", title: "Forehand", description: "Contact point" },
      { name: "k2", description: "Follow through" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      imageUrl: "k1",
      title: "Forehand",
      description: "Contact point",
    });
    expect(items[1].imageUrl).toBe("k2");
  });

  it("builds create payload", () => {
    const payload = toReportDataPayload([
      { imageUrl: "a", title: "", description: "note" },
    ]);
    expect(payload[0].description).toBe("note");
  });
});
