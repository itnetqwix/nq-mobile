import {
  canvasPointToContentUV,
  contentUVToCanvasPoint,
  getObjectFitContainRect,
  getObjectFitCoverRect,
  insetsFromMeasuredRect,
  overlayPointToLocalVideoPoint,
  localVideoPointToOverlayPoint,
  resolveAnnotationMappingFrame,
  resolveClipContentInsets,
} from "../annotationCoords";

const ASPECT_16_9 = { width: 16, height: 9 };

function roundTripContain(
  frameW: number,
  frameH: number,
  x: number,
  y: number
): { u: number; v: number } | null {
  const uv = canvasPointToContentUV(x, y, frameW, frameH, ASPECT_16_9, "contain");
  if (!uv) return null;
  const pt = contentUVToCanvasPoint(uv.u, uv.v, frameW, frameH, ASPECT_16_9, "contain");
  if (!pt) return null;
  return canvasPointToContentUV(pt.x, pt.y, frameW, frameH, ASPECT_16_9, "contain");
}

describe("annotationCoords", () => {
  it("round-trips overlay points through contain UV", () => {
    const rect = getObjectFitContainRect(400, 800, 16, 9);
    expect(rect).not.toBeNull();
    const cx = rect!.x + rect!.width * 0.35;
    const cy = rect!.y + rect!.height * 0.62;
    const uv = roundTripContain(400, 800, cx, cy);
    expect(uv).not.toBeNull();
    expect(uv!.u).toBeCloseTo(0.35, 5);
    expect(uv!.v).toBeCloseTo(0.62, 5);
  });

  it("round-trips overlay points through cover UV", () => {
    const rect = getObjectFitCoverRect(400, 800, 16, 9);
    expect(rect).not.toBeNull();
    const x = rect!.x + rect!.width * 0.5;
    const y = rect!.y + rect!.height * 0.25;
    const uv = canvasPointToContentUV(x, y, 400, 800, ASPECT_16_9, "cover");
    expect(uv).not.toBeNull();
    const pt = contentUVToCanvasPoint(uv!.u, uv!.v, 400, 800, ASPECT_16_9, "cover");
    expect(pt).not.toBeNull();
    const uv2 = canvasPointToContentUV(pt!.x, pt!.y, 400, 800, ASPECT_16_9, "cover");
    expect(uv2!.u).toBeCloseTo(uv!.u, 5);
    expect(uv2!.v).toBeCloseTo(uv!.v, 5);
  });

  it("uses larger video rect for trainee (no trainer controls)", () => {
    const canvas = { width: 390, height: 700 };
    const trainer = resolveClipContentInsets(canvas, { mode: "single", trainerControls: true });
    const trainee = resolveClipContentInsets(canvas, { mode: "single", trainerControls: false });
    const trainerFrame = resolveAnnotationMappingFrame(canvas, { contentInsets: trainer });
    const traineeFrame = resolveAnnotationMappingFrame(canvas, { contentInsets: trainee });
    expect(traineeFrame.height).toBeGreaterThan(trainerFrame.height);
    expect(traineeFrame.height - trainerFrame.height).toBeGreaterThan(50);
  });

  it("splits dual-locked panes into distinct top/bottom rects", () => {
    const canvas = { width: 390, height: 700 };
    const topInsets = resolveClipContentInsets(canvas, {
      mode: "dual-locked",
      paneIndex: 0,
      trainerControls: true,
    });
    const bottomInsets = resolveClipContentInsets(canvas, {
      mode: "dual-locked",
      paneIndex: 1,
      trainerControls: true,
    });
    const top = resolveAnnotationMappingFrame(canvas, { contentInsets: topInsets });
    const bottom = resolveAnnotationMappingFrame(canvas, { contentInsets: bottomInsets });
    expect(top.offsetY).toBe(0);
    expect(bottom.offsetY).toBeGreaterThan(top.height);
    expect(top.height + bottom.height).toBeLessThan(canvas.height);
  });

  it("uses full-height frame for dual-unlocked focused pane", () => {
    const canvas = { width: 390, height: 700 };
    const stacked = resolveClipContentInsets(canvas, {
      mode: "dual-unlocked",
      paneIndex: 0,
      trainerControls: true,
      focused: false,
    });
    const focused = resolveClipContentInsets(canvas, {
      mode: "dual-unlocked",
      paneIndex: 0,
      trainerControls: true,
      focused: true,
    });
    const stackedFrame = resolveAnnotationMappingFrame(canvas, { contentInsets: stacked });
    const focusedFrame = resolveAnnotationMappingFrame(canvas, { contentInsets: focused });
    expect(focusedFrame.height).toBeGreaterThan(stackedFrame.height);
  });

  it("prefers measured rect over analytic insets", () => {
    const canvas = { width: 400, height: 800 };
    const measured = { x: 12, y: 48, width: 376, height: 620 };
    const fromMeasured = resolveAnnotationMappingFrame(canvas, { measuredContentRect: measured });
    const fromInsets = resolveAnnotationMappingFrame(canvas, {
      contentInsets: insetsFromMeasuredRect(canvas, measured),
    });
    expect(fromMeasured).toEqual({
      width: measured.width,
      height: measured.height,
      offsetX: measured.x,
      offsetY: measured.y,
    });
    expect(fromInsets.width).toBe(measured.width);
    expect(fromInsets.height).toBe(measured.height);
  });

  it("round-trips zoom/pan overlay transforms", () => {
    const frame = { width: 360, height: 640, offsetX: 15, offsetY: 40 };
    const zoomPan = { zoom: 1.8, pan: { x: 12, y: -8 } };
    const overlay = { x: 120, y: 280 };
    const local = overlayPointToLocalVideoPoint(
      overlay.x,
      overlay.y,
      frame,
      ASPECT_16_9,
      "contain",
      zoomPan
    );
    const back = localVideoPointToOverlayPoint(
      local.x,
      local.y,
      frame,
      ASPECT_16_9,
      "contain",
      zoomPan
    );
    expect(back.x).toBeCloseTo(overlay.x, 4);
    expect(back.y).toBeCloseTo(overlay.y, 4);
  });
});

describe("buildGamePlanPdfHtml layout", () => {
  it("renders single-flow GAME PLAN skeleton", async () => {
    const { buildGamePlanPdfHtml } = await import("../gamePlanPdfHtml");
    const html = buildGamePlanPdfHtml(
      ["data:image/jpeg;base64,abc"],
      "Forehand topspin",
      "Session focus notes",
      [{ imageUrl: "k1", title: "", description: "Contact point" }],
      {
        traineeName: "Alex Trainee",
        trainerName: "Coach Pat",
        trainerAbout: "USPTA certified",
      }
    );
    expect(html).toContain("Game Plan");
    expect(html).toContain("planTitle");
    expect(html).toContain("Forehand topspin");
    expect(html).not.toContain("Topic:");
    expect(html).toContain("Name:");
    expect(html).toContain("Alex Trainee");
    expect(html).toContain("frameRow");
    expect(html).toContain("Contact point");
    expect(html).toContain("Expert");
    expect(html).toContain("Coach Pat");
    expect(html).not.toContain("Session frames");
    expect(html).not.toContain("page-break-after");
  });
});
