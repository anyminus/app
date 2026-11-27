# API integration — source contract, not live proof

Frontend only. The API origin is fixed at build time, with a public default. No tokens or credentials in Git. GitHub Pages origin is https://anyminus.github.io, not its /app/ path.

The real catalog UI uses GET /demo/catalog (limit=100, cursor), GET /demo/search (2–200 chars, no anonymous bearer), POST /demo/auth (memory-only bearer), GET /demo/karaoke/status, POST /demo/karaoke only on explicit create/retry after checking status, and GET /demo/track-metadata when duration missing. Polling stops on leaving selection. No admin or callback routes. Ready playback requests POST /demo/catalog/playback then validates exact returned media URLs and downloads both stems with credentials; no upstream URLs or tickets persisted. LRC from protected stored lyrics. A single audio clock and two gain nodes, bounded audio downloads. Playback is experimental, not mobile-validated.

Product control adapter is separate: Telegram bootstrap, refresh/logout, search, library CRUD, jobs and media-ticket routes; not enabled in UI because runtime, cookies and CORS are unverified. Favorites and playlists store real track identifiers locally; authenticated synchronization is not wired.

Browser verification is required for credentialed playback across origins. Existing playback keeps credentials included. Tests intercept synthetic responses, never enqueue live jobs.

Main Search uses GET /demo/search with query length 2–200, limit 20, 650ms debounce, and cancellation. No fallback to fictional results.

## 0.4.2 artist continuation and artwork
GET /demo/artists/popular?name=… returns canonical artistId and optional nextCursor. Continue with artistId and cursor (20/40/60/80); 20 entries per page, up to the genuine provider-ranked list (max 100). Preserve order and prior pages on error; no generic-search substitute. Missing cover metadata uses stable /demo/artwork/:id; truly unavailable images retain a placeholder. Live acceptance requires both backend deployments, HTTP 200 and valid image bytes, not just mocked tests.

## 0.4.3 artist identities
New artist hashes use `#/artist/<encoded name>?author_id=<numeric SDK Artist.id>`. ID-qualified popularity requests use `artistId` from page one; share links preserve it. Search/popularity/metadata carry `artistCredits`, and missing legacy ready credits are looked up by track IDs (up to 20 at a time). Same-name artists with different IDs are not merged on ID-qualified routes; unresolved legacy names remain supported. No database schema change. Live acceptance pending.

## 0.4.5 catalog lyrics format
Optional `lyricsFormat: TEXT | LRC` on verified ready catalog and ready artist popularity rows. TEXT maps to “Текст без таймкодов” and the warm theme accent; LRC and unknown keep the previous readiness label. Not inferred from availability flags. Browser cache retains known format for the same ready pair; real loaded lyrics update the cached format. No per-track fetch on list rendering. Backend requires additive 0045 read-only receipt projection. Real acceptance pending.

## 0.4.6 missing lyrics
`lyricsFormat: NONE` explicitly means no current stored/published text (confirmed absent or terminal failed with no registered lyrics object). Ready rows show «Караоке без текста» in pale red. Pending, unknown, or transport failure is not NONE. Verified TEXT or LRC replaces NONE when available. No playback or retry behavior changed. Backend additive 0046. The absence sentinel is not a claim about permanent provider availability.

## 0.4.7 song detail
The ready label is shared between list rows and the song/player heading. A new request shows normal audio creation progress plus neutral lyrics-format checking; a verified ready status from the create/poll API supplies `lyricsFormat` and the player immediately shows the corresponding color/label. Actual stored lyrics may refine it, temporary HTTP failures never switch to NONE. No additional provider query, enqueue or playback changes. Unknown ready format keeps generic readiness.
