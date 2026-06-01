# Mobile CMS (Blinkit / Zepto-style OTA content)

NetQwix can change marketing and legal content **without an app store release**. Signed-in users get **instant** updates via Socket.IO; guests use manifest polling.

## What admins can manage today

| Content | Admin path | Mobile surface | API |
|---------|------------|----------------|-----|
| Home banners (image, multi-CTA) | App content → Banners | Home carousel (guest + signed-in) | `GET /banners` |
| Tips carousel | App content → Tips | Tips for you | `GET /tips` |
| Terms & Privacy (HTML) | App content → Legal | In-app WebView + signup links | `GET /cms/legal/:slug` |
| Blog posts | App content → Blog | Blog list + article | `GET /cms/pages?type=blog` |
| FAQ | App content → FAQ | Settings → FAQ | `GET /cms/faq` |
| Clip library / videos | Clips & video | Locker library (not home hero CMS) | `/admin/library/clips` |

## Real-time refresh

1. Admin publishes banner, tip, legal, blog, or FAQ.
2. Backend calls `notifyCmsUpdated()` → Socket.IO event **`CMS_UPDATED`**.
3. Signed-in app: `SocketQueryInvalidationBridge` invalidates React Query `content/*` keys immediately.
4. Guests: `CmsLiveRefreshBridge` polls `GET /cms/manifest` every **60s** (and on app focus).

## Banner CTAs (multi-button)

Admin banner form supports up to **4** `ctas[]`:

```json
{ "label": "Book now", "url": "netqwix://book-lesson", "variant": "primary" }
```

Deep links: `netqwix://settings`, `netqwix://blogs`, `netqwix://wallet`, or `https://…`.

## FAQ

- Admin: **Import app defaults** seeds from backend bundle; edit sections and **Publish**.
- Mobile uses CMS when `sections.length > 0`, else falls back to bundled `faqContent.ts`.

## Still static in the app (future CMS)

- First-launch intro slides (`assets/intro/`)
- Loader sports tips (`master_data.loader_tips`)

## Deploy checklist

1. Deploy **backend** (`/cms/*`, `CMS_UPDATED` socket, `cms_faq` collection).
2. Deploy **admin** (Banners multi-CTA, Legal, Blog, FAQ).
3. Mobile build with socket + FAQ fetch (existing store builds get OTA content once backend is live).
