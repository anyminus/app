# API integration — source contract, not live proof

Frontend only. The API origin must be explicitly supplied; no private infrastructure names, tokens, tracks, lyrics or credentials in Git. GitHub Pages origin is https://anyminus.github.io, not its /app/ path.

The real catalog UI uses GET /demo/catalog (limit=100, cursor), GET /demo/search (2–200 chars, no anonymous bearer), POST /demo/auth (memory-only bearer), GET /demo/karaoke/status, POST /demo/karaoke only on explicit create/retry after checking status, and GET /demo/track-metadata when duration missing. Polling stops on leaving selection. No admin or callback routes. Ready playback requests POST /demo/catalog/playback then validates exact returned media URLs and downloads both stems with credentials; no upstream URLs or tickets persisted. LRC from protected stored lyrics. A single audio clock and two gain nodes, bounded audio downloads. Playback is experimental, not mobile-validated.

Product control adapter is separate: Telegram bootstrap, refresh/logout, search, library CRUD, jobs and media-ticket routes; not enabled in UI because runtime, cookies and CORS are unverified. Favorites/playlists from prototype remain local and currently separate from live catalog.

BLOCKER: handoff reports demo OPTIONS/preflight missing and no credentialed CORS; Strict media cookies cannot work cross-site as-is. Control API needs exact origin, DELETE, Idempotency-Key preflight and compatible cookie policy. A supported same-origin deployment or separately approved CORS/media/auth changes are required. No backend modifications made. Tests use synthetic intercepted responses, never enqueue live jobs.

Main Search tab defaults to GET /demo/search with query length 2–200, limit 20, 650ms debounce, abort of obsolete requests, and explicit retry; no anonymous bearer on search. When no approved origin is configured the user sees a connection form, not a fabricated API result. Demo search is an explicit alternate mode.
