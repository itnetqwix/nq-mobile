import type { ReportScreenshotItem } from "./reportDataUtils";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Web `reportModal.jsx` #report-pdf layout — cover + per-screenshot sections. */
export function buildGamePlanPdfHtml(
  imgDataUrls: string[],
  planTitle: string,
  planNotes: string,
  items: ReportScreenshotItem[],
  meta?: { trainerName?: string; trainerAbout?: string }
): string {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sections = imgDataUrls
    .map((src, i) => {
      const item = items[i];
      const caption = item?.description?.trim() || item?.title?.trim() || "";
      return `
        <section class="shot">
          <div class="shotImg">
            <img src="${src}" alt="Screenshot ${i + 1}" />
          </div>
          <div class="shotCopy">
            ${caption ? `<p class="shotDesc">${esc(caption)}</p>` : `<p class="shotDesc muted">No notes for this frame.</p>`}
          </div>
        </section>
        <hr class="divider" />
      `;
    })
    .join("\n");

  const trainerBlock =
    meta?.trainerName || meta?.trainerAbout
      ? `
        <section class="trainer">
          <h2>Expert</h2>
          ${meta.trainerAbout ? `<p>${esc(meta.trainerAbout)}</p>` : ""}
          ${meta.trainerName ? `<p class="trainerName">${esc(meta.trainerName)}</p>` : ""}
        </section>
      `
      : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        margin: 0;
        padding: 20px;
        color: #111;
        border: 10px solid #14328d;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 8px;
      }
      .brand {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #14328d;
      }
      h1.coverTitle {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        text-transform: uppercase;
        color: #000;
      }
      .meta { margin-top: 12px; }
      .meta p { margin: 4px 0; font-size: 14px; }
      .meta .topic { font-size: 18px; font-weight: 700; margin-top: 8px; }
      .meta .name { font-size: 16px; color: #222; }
      .notes {
        margin-top: 10px;
        font-size: 13px;
        line-height: 1.5;
        color: #333;
        white-space: pre-wrap;
      }
      hr.divider {
        border: none;
        border-top: 2px solid #000;
        margin: 16px 0;
      }
      .shot {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
        page-break-inside: avoid;
        margin: 12px 0;
      }
      .shotImg { flex: 1; min-width: 0; text-align: center; }
      .shotImg img {
        max-width: 100%;
        max-height: 260px;
        object-fit: contain;
        border-radius: 8px;
      }
      .shotCopy { flex: 1; min-width: 0; }
      .shotDesc { font-size: 14px; line-height: 1.45; color: #111; margin: 0; }
      .shotDesc.muted { color: #666; }
      .trainer { margin-top: 20px; page-break-inside: avoid; }
      .trainer h2 { margin: 0 0 6px; font-size: 18px; }
      .trainer p { margin: 4px 0; font-size: 13px; line-height: 1.4; }
      .trainerName { font-weight: 700; font-size: 16px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <p class="brand">NetQwix</p>
        <h1 class="coverTitle">Game Plan</h1>
      </div>
    </div>
    <div class="meta">
      <p><strong>Date:</strong> ${esc(dateLabel)}</p>
      <p class="topic">Topic: ${esc(planTitle)}</p>
      ${planNotes.trim() ? `<p class="name">Notes: ${esc(planNotes.trim())}</p>` : ""}
    </div>
    ${planNotes.trim() && !planNotes.includes(planTitle) ? "" : ""}
    <hr class="divider" />
    ${sections || `<p class="shotDesc muted">No screenshots in this session.</p>`}
    ${trainerBlock}
  </body>
</html>
`;
}
