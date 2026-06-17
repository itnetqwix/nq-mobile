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

/** Single-flow GAME PLAN layout — matches server stitch + web `#report-pdf`. */
export function buildGamePlanPdfHtml(
  imgDataUrls: string[],
  planTitle: string,
  planNotes: string,
  items: ReportScreenshotItem[],
  meta?: GamePlanPdfMeta
): string {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const logoBlock = meta?.logoDataUrl
    ? `<img class="headerLogo" src="${meta.logoDataUrl}" alt="NetQwix" />`
    : `<p class="brandFallback">NETQWIX</p>`;

  const frameBlocks = imgDataUrls
    .map((src, i) => {
      const item = items[i];
      const caption = item?.description?.trim() || item?.title?.trim() || "";
      return `
        <section class="frame">
          <div class="frameImg">
            <img src="${src}" alt="Frame ${i + 1}" />
          </div>
          ${
            caption
              ? `<p class="frameNotes">${esc(caption)}</p>`
              : ""
          }
          <hr class="rule" />
        </section>
      `;
    })
    .join("\n");

  const sessionNotes = planNotes.trim();
  const expertAbout = meta?.trainerAbout?.trim() ?? "";
  const expertName = meta?.trainerName?.trim() ?? "";

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
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      h1.title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        text-transform: uppercase;
        color: #000;
      }
      .headerLogo {
        max-width: 140px;
        max-height: 48px;
        object-fit: contain;
      }
      .brandFallback {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #14328d;
        margin: 0;
      }
      .meta p {
        margin: 4px 0;
        font-size: 12px;
        line-height: 1.45;
      }
      .sessionNotes {
        margin: 8px 0 0;
        font-size: 11px;
        line-height: 1.5;
        white-space: pre-wrap;
        color: #333;
      }
      hr.rule {
        border: none;
        border-top: 2px solid #000;
        margin: 16px 0;
      }
      .frame {
        page-break-inside: avoid;
        margin: 0 0 4px;
      }
      .frameImg {
        text-align: center;
        margin-bottom: 8px;
      }
      .frameImg img {
        max-width: 100%;
        max-height: 260px;
        object-fit: contain;
      }
      .frameNotes {
        font-size: 11px;
        line-height: 1.5;
        color: #111;
        margin: 0 0 8px;
        white-space: pre-wrap;
      }
      .expertFooter {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-top: 8px;
        page-break-inside: avoid;
      }
      .expertFooter h2 {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 700;
        color: #000;
      }
      .expertBio {
        flex: 1;
        max-width: 62%;
      }
      .expertBio p {
        margin: 0;
        font-size: 10px;
        line-height: 1.4;
        color: #111;
        white-space: pre-wrap;
      }
      .expertName {
        font-size: 14px;
        font-weight: 700;
        color: #000;
        white-space: nowrap;
        margin: 0;
      }
      .emptyFrames {
        font-size: 12px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <header class="header">
      <h1 class="title">GAME PLAN</h1>
      ${logoBlock}
    </header>
    <div class="meta">
      <p><strong>Date:</strong> ${esc(dateLabel)}</p>
      <p><strong>Topic:</strong> ${esc(planTitle)}</p>
      ${meta?.traineeName ? `<p><strong>Name:</strong> ${esc(meta.traineeName)}</p>` : ""}
      ${sessionNotes ? `<p class="sessionNotes">${esc(sessionNotes)}</p>` : ""}
    </div>
    <hr class="rule" />
    <div class="frames">
      ${
        frameBlocks ||
        `<p class="emptyFrames">No screenshots were attached to this plan.</p>`
      }
    </div>
    ${
      expertName || expertAbout
        ? `
    <hr class="rule" />
    <footer class="expertFooter">
      <div class="expertBio">
        <h2>Expert</h2>
        ${expertAbout ? `<p>${esc(expertAbout)}</p>` : ""}
      </div>
      ${expertName ? `<p class="expertName">${esc(expertName)}</p>` : ""}
    </footer>
    `
        : ""
    }
  </body>
</html>
`;

}
