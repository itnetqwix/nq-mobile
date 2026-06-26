/** Shared HTML shell for CMS legal documents — matches admin preview styling. */
export function buildLegalDocumentHtml(opts: {
  title: string;
  bodyHtml: string;
  textColor: string;
  mutedColor: string;
  linkColor: string;
  bgColor: string;
  version?: number;
  publishedAt?: string | null;
}): string {
  const {
    title,
    bodyHtml,
    textColor,
    mutedColor,
    linkColor,
    bgColor,
    version,
    publishedAt,
  } = opts;

  const effective =
    publishedAt &&
    !Number.isNaN(new Date(publishedAt).getTime())
      ? new Date(publishedAt).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const metaLine =
    version != null || effective
      ? `<p class="meta">${[
          version != null ? `Version ${version}` : null,
          effective ? `Effective ${effective}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}</p>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *{box-sizing:border-box}
    body{
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      margin:0;padding:20px 20px 32px;
      color:${textColor};background:${bgColor};
      line-height:1.7;font-size:16px;
      -webkit-text-size-adjust:100%;
    }
    .wrap{max-width:680px;margin:0 auto}
    h1{font-size:26px;font-weight:800;margin:0 0 8px;line-height:1.25;letter-spacing:-0.3px}
    .meta{font-size:13px;color:${mutedColor};margin:0 0 24px}
    h2{font-size:19px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(128,128,128,0.2)}
    h3{font-size:16px;font-weight:700;margin:20px 0 8px}
    p{margin:0 0 14px}
    ul,ol{margin:0 0 14px;padding-left:22px}
    li{margin-bottom:8px}
    a{color:${linkColor};text-decoration:underline}
    strong{font-weight:700}
    blockquote{
      margin:0 0 14px;padding:12px 14px;
      border-left:3px solid ${linkColor};
      background:rgba(128,128,128,0.08);
      border-radius:0 8px 8px 0;
    }
    hr{border:none;border-top:1px solid rgba(128,128,128,0.2);margin:24px 0}
    table{width:100%;border-collapse:collapse;margin:0 0 14px;font-size:14px}
    th,td{border:1px solid rgba(128,128,128,0.25);padding:8px 10px;text-align:left}
    th{background:rgba(128,128,128,0.08);font-weight:700}
  </style></head>
  <body><div class="wrap"><h1>${title}</h1>${metaLine}${bodyHtml}</div></body></html>`;
}
