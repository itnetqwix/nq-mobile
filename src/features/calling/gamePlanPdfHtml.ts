import type { ReportScreenshotItem } from "./reportDataUtils";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type GamePlanPdfMeta = {
  trainerName?: string;
  trainerAbout?: string;
  traineeName?: string;
  logoDataUrl?: string | null;
};

/** Web `reportModal.jsx` #report-pdf layout — cover page + screenshot sections. */
export function buildGamePlanPdfHtml(
  imgDataUrls: string[],
  planTitle: string,
  planNotes: string,
  items: ReportScreenshotItem[],
  meta?: GamePlanPdfMeta
): string {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const logoBlock = meta?.logoDataUrl
    ? `<img class="coverLogo" src="${meta.logoDataUrl}" alt="NetQwix" />`
    : `<p class="brandFallback">NetQwix</p>`;

  const sections = imgDataUrls
    .map((src, i) => {
      const item = items[i];
      const shotTitle = item?.title?.trim() ?? "";
      const caption = item?.description?.trim() || "";
      const indexLabel = shotTitle
        ? `Frame ${i + 1}: ${esc(shotTitle)}`
        : `Frame ${i + 1}`;
      return `
        <section class="shot">
          <p class="shotIndex">${indexLabel}</p>
          <div class="shotImg">
            <img src="${src}" alt="Screenshot ${i + 1}" />
          </div>
          <div class="shotCopy">
            ${
              caption
                ? `<p class="shotDesc">${esc(caption)}</p>`
                : `<p class="shotDesc muted">No notes for this frame.</p>`
            }
          </div>
        </section>
      `;
    })
    .join("\n");

  const trainerBlock =
    meta?.trainerName || meta?.trainerAbout
      ? `
        <section class="trainer">
          <h2>Coach</h2>
          ${meta.trainerName ? `<p class="trainerName">${esc(meta.trainerName)}</p>` : ""}
          ${meta.trainerAbout ? `<p>${esc(meta.trainerAbout)}</p>` : ""}
        </section>
      `
      : "";

  const notesBlock = planNotes.trim()
    ? `<p class="sessionNotes">${esc(planNotes.trim())}</p>`
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      @page { margin: 18px; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        margin: 0;
        padding: 16px;
        color: #111;
        border: 8px solid #14328d;
      }
      .cover {
        page-break-after: always;
        min-height: 90vh;
        padding-bottom: 24px;
      }
      .coverHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .coverLogo {
        max-width: 200px;
        max-height: 56px;
        object-fit: contain;
      }
      .brandFallback {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #14328d;
        margin: 0;
      }
      h1.coverTitle {
        margin: 0;
        font-size: 28px;
        font-weight: 800;
        text-transform: uppercase;
        color: #000;
      }
      .meta { margin-top: 20px; }
      .meta p { margin: 6px 0; font-size: 14px; line-height: 1.45; }
      .meta .topic {
        font-size: 20px;
        font-weight: 700;
        margin-top: 12px;
        color: #14328d;
      }
      .sessionNotes {
        margin-top: 14px;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        color: #333;
      }
      .shotsTitle {
        font-size: 16px;
        font-weight: 700;
        margin: 0 0 12px;
        color: #14328d;
      }
      .shot {
        page-break-inside: avoid;
        margin: 0 0 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #ddd;
      }
      .shotIndex {
        font-size: 12px;
        font-weight: 700;
        color: #14328d;
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .shotImg { text-align: center; margin-bottom: 10px; }
      .shotImg img {
        max-width: 100%;
        max-height: 320px;
        object-fit: contain;
        border-radius: 6px;
      }
      .shotDesc { font-size: 14px; line-height: 1.5; color: #111; margin: 0; white-space: pre-wrap; }
      .shotDesc.muted { color: #666; }
      .trainer { margin-top: 24px; page-break-inside: avoid; }
      .trainer h2 { margin: 0 0 8px; font-size: 18px; color: #14328d; }
      .trainer p { margin: 4px 0; font-size: 13px; line-height: 1.4; }
      .trainerName { font-weight: 700; font-size: 16px; }
      .emptyShots { font-size: 14px; color: #666; }
    </style>
  </head>
  <body>
    <div class="cover">
      <div class="coverHeader">
        <h1 class="coverTitle">Game Plan</h1>
        ${logoBlock}
      </div>
      <div class="meta">
        <p><strong>Date:</strong> ${esc(dateLabel)}</p>
        ${meta?.traineeName ? `<p><strong>Trainee:</strong> ${esc(meta.traineeName)}</p>` : ""}
        <p class="topic"><strong>Topic:</strong> ${esc(planTitle)}</p>
        ${notesBlock}
      </div>
      ${trainerBlock}
    </div>
    <div class="shots">
      <p class="shotsTitle">Session frames</p>
      ${
        sections ||
        `<p class="emptyShots">No screenshots were attached to this plan.</p>`
      }
    </div>
  </body>
</html>
`;
}
