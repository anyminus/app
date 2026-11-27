# Changelog

## 0.5.51
- Correct autoplay regression fixture to use distinct immutable media pair IDs per song; verify separate downloads for distinct pairs and cache reuse on reopening the first song. No audio runtime changes.

## 0.5.50
- Add bounded IndexedDB stem cache, persist partial checkpoints and completed stems across reloads, retain fresh playback authorization, show cached bytes and profile cache clearing.

## 0.5.49
- Add persistent experimental audio output modes in Profile: Auto (alternate latency hint after a detected failure on explicit Play), Standard, and CarPlay compatibility (play-and-record session without media capture). Preserve original audio and recording routing.

## 0.5.48
- Fix nullable stored language preference TypeScript build error.

## 0.5.47
- Allow the exact fast Yandex artwork CDN host in the client; correct the localization compile syntax in SortableTrackList.

## 0.5.46
- Localize interface in Russian, English, German and Spanish; detect device language automatically and persist explicit selection in Profile. Keep song titles, artists and lyrics unchanged.

## 0.5.45
- Show exact artist matches above search songs, deduplicated by verified artist ID, with case-insensitive matching and direct artist navigation.

## 0.5.44
- Show real byte progress for both stems and combined download; resume interrupted downloads with verified HTTP ranges, refresh media permissions, pause downloads in background/offline and continue on return.

## 0.5.43
- Compact recording sound settings: closely spaced level sliders, compensation directly underneath, current delay beside its label, optional collapsed device diagnostics, taller responsive panel and accurate range progress fills.

## 0.5.42
- Open recorded video in a large inline modal with an explicit View button; add persistent independent recording music and microphone sliders, including live adjustment and default microphone level 100%.

## 0.5.41
- Fall back to the stable public artwork proxy if a validated provider cover fails; show closed diagnostic stage/detail in CI smoke. Fix original-player media test fixture to serve byte ranges like the production endpoint.

## 0.5.40
- Persistent original-song mini player above bottom navigation, playable from uncreated track covers and detail screen; independent of route, with play/pause, seeking, close and exclusive karaoke playback.

## 0.5.39
- Make the immediate canvas seek regression explicitly use compensation Off; add deterministic delayed-clock seek boundary and automatic compensation tests. Keep recording settings and runtime unchanged.

## 0.5.38
- Add local video audio diagnostics and Auto/Manual/Off latency compensation settings; delay only the recorded accompaniment and corresponding canvas clock, preserve live playback and flush the delayed tail on normal stop.

## 0.5.37
- Verify microphone processing preferences and retry exact disabling if reported active; isolate camera preview from microphone audio, keep playback gain at unity and restore Apple playback session after capture cancellation. Correct system seek boundary regression assertion.

## 0.5.36
- Register system previous/next actions as ten-second seeks in the current karaoke track; retain absolute and relative seek handlers, refresh native playback position on visibility changes and page restoration.

## 0.5.35
- Reduce normal canvas lyric center spacing by 40% while maintaining safe clearance for wrapped lines and preserving the fading drum, lower anchor, font sizes and watermark.

## 0.5.34
- Show a numeric countdown in the lyric list during verified instrumental gaps strictly longer than ten seconds; use active lyric typography and current playback tempo.

## 0.5.33
- Match the compact camera preview and saved-video thumbnail to the actual video aspect ratio instead of a fixed landscape box; update on metadata and orientation changes, without cropping.

## 0.5.32
- Target 30 FPS on iPhone, select Android/other capture profiles using camera settings and device resource hints; correct frame pacing and cache text measurements.
- Introduce a stable, fading lyric drum and safer vertical title/lyric placement for messenger playback; preserve watermark and font sizes.

## 0.5.31
- Recover the iOS audio output for subsequent recording takes; stop stale playback promises and bound recorder finalization to five seconds, with manual recovery and partial-file fallback.

## 0.5.30
- Request unprocessed microphone audio for video karaoke and separate accompaniment and vocal peak protection to prevent singing from ducking recorded music. Preserve raw-audio preferences during camera constraint fallback.

## 0.5.29
- Restore pitch and tempo controls in video preview and recording. Route the processed accompaniment through a stable shared output bus to both playback and recording, retain the microphone signal and prevent asynchronous tempo changes from restarting stopped playback.

## 0.5.28
- Make the lyric wrapping regression deterministic across CI fonts; assert actual 75% and 100% font sizes and real line wrapping. Retain all 0.5.27 video and mixer features unchanged.

## 0.5.27
- Increase all composited video text sizes by 20% except the watermark; animate sequential lyric changes with upward movement, size and color interpolation and fading. Explicit seeks snap immediately.
- Avoid the unrelated Microsoft apt repository during Playwright dependency installation after runner HTTP 403.

## 0.5.26
- Restore the mixer button in video mode. Adjust or mute both accompaniment stems during preview and active recording without restarting capture.

## 0.5.25
- Fix premature line wrapping: inactive karaoke lyrics use actual 75% font size instead of transform scaling; active lyrics stay at 100% with smooth recentering as row heights change.

## 0.5.24
- Require MP4 recording on native iPhone/iPad; prefer H.264/AAC and prohibit WebM or unspecified-format fallback. Disable unsupported recording while preserving normal karaoke and explicit raw-camera MP4 retry.

## 0.5.23
- Prefer MP4 on native iPhone/iPad for composited and raw capture; normalize the actual recorded MIME type, simplify native file sharing, prevent duplicate share attempts and preserve manual download fallback.

## 0.5.22
- Add song title, artist and AnyMinus watermark to composited video using a versioned declarative style template.
- Handle timeline Home/End explicitly during playback and recording; retain seek regression coverage.

## 0.5.21
- Gate video karaoke by actual browser capabilities; prefer WebM on Android, fall back to basic camera constraints and allow raw recording when lyric composition is unavailable.

## 0.5.20
- Harden composited video startup: keep the camera attached, wait for the first frame, select a compatible encoder and expose specific capture errors.

## 0.5.19
- Preserve the exact song position when opening the camera; recording starts from that position or a subsequently selected lyric/timeline position.
- Fix TypeScript null narrowing in the lyric compositor that blocked the 0.5.18 build.

## 0.5.18
- Optional timed lyric overlay in video karaoke: current and upcoming lines rendered into the camera preview and saved video itself; retain raw-camera recording when switched off or unsupported.

## 0.5.17
- Allow timeline, ±10-second controls and timed lyric jumps before and during video recording; retain the same recording stream across seeks and protect against playback restarting after stop.

## 0.5.16
- Restore the main Play/Pause action in camera mode; recover an interrupted or previously failed Web Audio context before connecting the microphone, retaining loaded stems and playback settings.

## 0.5.15
- Experimental local video karaoke: compact camera preview above lyrics, microphone and live player mix, save/share recording on device.

## 0.5.14
- Add a global search button below artist links at the end of the song.

## 0.5.13
- Stop labeling unverified lyrics as synchronized; honor explicit server unknown and preserve confirmed plain or absent labels.

## 0.5.12
- Label unprepared songs with timed lyrics as «Создать караоке» in track lists.

## 0.5.11
- Optionally share the current song timestamp, independently of mixer, pitch and playback speed.

## 0.5.10
- Explain that users can leave a preparing song and receive a readiness notice in the open app; register a local watcher when reopening a pending track.

## 0.5.9
- Move the favorite button beside Share in the karaoke transport, keeping Play centered.
- Snap the last slider step to the actual track duration to show the end screen.

## 0.5.8
- Show up to two short release highlights in update notifications using version-matched deployment notes.

## 0.5.7
- Extend playback speed to 2.0× and offer artist navigation at the end of a song.

## 0.5.6
- Clarify the optional playback share description: volume of audio tracks, pitch and speed.

## 0.5.5
- Optionally share the current mixer, mute, pitch and tempo settings with a song link; apply the preset only to that song without changing personal preferences.

## 0.5.4
- Add speed +/- control alongside pitch, independent pitch compensation, synchronized media position and intro countdown.

## 0.5.3
- Add a permanent, compact tap-to-seek hint above timed lyrics, including focus mode and long-intro countdown.

## 0.5.2
- Notify all open app instances when a newer successfully published Pages version is detected; manual refresh or dismiss, without stopping playback.
- Serve the upstream pitch AudioWorklet as an unbundled same-origin asset to avoid serialized/minified function startup failures.

## 0.5.1
- Add a shared +/- semitone control to the right of the mixer using Signalsmith Stretch Web Audio/WASM, preserving original tempo and synchronized lyrics.

## 0.5.0
- Receive karaoke-ready hints via one hibernating Cloudflare WebSocket per waiting tab, confirm through the existing status API, reconnect automatically and keep polling fallback.

## 0.4.18
- Notify users inside the open app when a requested karaoke becomes playable, with direct open action and a persistent list in Profile.
- Use numeric tolerance for decoded audio duration in the intro regression.

## 0.4.17
- Exercise intro countdown seeking through real skip buttons, range keyboard input and timed-line clicks; assert the playback position as well as the countdown. No runtime changes.

## 0.4.16
- Repair Node ESM test loading of the package version and make the stalled-audio regression freeze every context created before explicit recovery; keep all assertions and the intro countdown.

## 0.4.15
- Show a media-synchronized countdown to the first timed lyric for intros longer than 10 seconds; preserve pause, seeking and smooth lyric centering.

## 0.4.14
- Show the actual application version beside the ANYMINUS logo on the home screen and use package.json as the single source for the profile version.

## 0.4.13
- Detect frozen Web Audio clocks at startup and during playback, show a truthful Play state, and rebuild the audio output on explicit retry without downloading stems again.

## 0.4.12
- Shuffle the entire ready catalog on the home page on each reload using the existing server-side seeded order; reuse the seed across pagination and prevent duplicate results.

## 0.4.11
- Use one status per ready karaoke row; keep only «Караоке готово» for timed tracks and preserve plain/missing labels. Provider-format labels remain on uncreated songs.

## 0.4.10
- Show only «Караоке без текста» on verified ready karaoke without lyrics; remove duplicate red availability line in popular/search lists.

## 0.4.9
- Keep collaborating artists on one line in the karaoke header, with separate artist ID links and truncation for long names.
- Avoid redundant provider metadata preview on already-ready tracks; preserve pre-create text checking.

## 0.4.8
- Display lyrics availability for every popular/search result and on the song page before Create; use neutral unknown and prefer verified stored format for ready songs. Unknown capability triggers a bounded metadata check; absence never inferred from a failed request.

## 0.4.7
- Show the same three colored lyrics availability labels on the song/player page after create and ready polling, with neutral lyrics checking during creation.

## 0.4.6
- Ready karaoke without stored text gets the pale-red «Караоке без текста» status; distinguish terminal missing text from pending/unknown. Preserve playback and upgrade status when lyrics arrive.

## 0.4.5
- Mark ready songs with confirmed unsynchronized lyrics as «Текст без таймкодов» in a muted orange theme accent; timed/unknown retain the ready label. Propagate optional stored format from catalog and popularity, refresh it when actual lyrics load.

## 0.4.4
- Smooth timed karaoke lyric transitions with 75% inactive and 100% active text, left-anchored scale, damped spring-like scrolling and reduced-motion support.
- Fix strict Playwright selector in the artist ID regression test (prior build blocked publication).

## 0.4.3
- Artist deep links carry the verified Yandex `author_id` alongside the display name. Each credited artist has its own link; legacy catalog tracks resolve IDs lazily. ID-qualified ready lists require provider-verified membership; name-only legacy routes remain compatible.

## 0.4.2
- Fix TypeScript inference for optional artist ID and cursor parameters (CI TS2345); retain the unpublished release version.
- Add explicit continuation to provider-ranked artist songs; 20 per page, preserve order, deduplicate, retry failed pages without clearing earlier tracks. No general-search substitution.
- Retry stable public artwork for tracks with missing cover metadata, including old favorites and shared tracks. Accept only known Yandex music cover origins. Server deployment and real image acceptance required.

## 0.4.1
- Temporarily restore explicit guest karaoke creation using the signed anonymous demo session, while preserving optional Telegram login. Updated guest admission tests. Re-enable mandatory login only after live acceptance and owner approval.

## 0.4.0
- Add Telegram browser OIDC authorization-code/PKCE login, retaining signed Mini App authentication. Restore the selected song/profile after redirect, reject mismatched state, keep access tokens in memory. Server configuration and live deployment required.

## 0.3.2
- Replace artist overview with two distinct tabs: ready karaoke strictly from the public catalog and popular songs from a dedicated SDK-backed API contract (`GET /demo/artists/popular?name=...`, pending server support). Preserve provider ordering and never substitute general search results. Fix mobile artist header overflow.

## 0.3.1
- Remove the redundant track-count label from the mixer.

## 0.3.0
- Add Telegram Mini App authentication using signed initData verified by the API; keep bearer tokens in memory, handle expiry and logout. Guests retain ready playback and read-only discovery; creation requires a verified Telegram session in the UI and request handler. Configure the public Mini App launch URL with VITE_TELEGRAM_MINI_APP_URL. Server-side guest enqueue rejection and external browser login require API support.

## 0.2.20
- Distinguish confirmed missing/pending lyrics from generic API failures. Allow local lyrics subscriptions, persist them in the browser, and notify in the app when text becomes available through the protected read endpoint. Foreground-only checks are bounded and never enqueue generation. Show subscriptions in the profile; no background push delivery is claimed.

## 0.2.19
- Automatically follow all ready catalog pages for an artist, display every matching track as pages arrive, deduplicate IDs and remove manual load-more and five-track preview limits on artist screens. Preserve normal home catalog pagination and abort on navigation.

## 0.2.18
- Artist overview combines confirmed ready karaoke from the public catalog and actual artist-matched provider search results. Add overview, karaoke and songs tabs, a direct sing action, sharing and separate loading/error states. The existing provider search is limited to 20 results; do not mislabel them as popularity-ranked or a complete discography.

## 0.2.17
- Artist pages list verified ready songs from the paginated public catalog, including exact individual credits in collaborations, rather than relying on the provider's first 20 search results. Bound each catalog scan to eight pages and expose continuation; allow searching for other songs separately.

## 0.2.16
- Consume per-result karaokeStatus in search; only valid ready pairs enable immediate playback, preserving the previous fallback for missing or unknown readiness. No batch/status request for a confirmed ready result. Use validated API coverUrl directly, preserve legacy artwork lookup for omitted fields, and show placeholders for explicit missing or failed covers. Do not enqueue lyric generation.

## 0.2.15
- Fix artwork helper type inference and add a bounded read-only live artwork diagnostic for the public catalog. External API availability is reported separately from deterministic application tests.

## 0.2.14
- Preserve API artwork metadata, use stable public track artwork URLs and standard lazy image embedding with browser caching. Add a compact cover in the karaoke header; retain placeholders for unavailable images. Cover search, favorites, sharing and playback with browser tests. Correct the system-media duration test to allow sub-millisecond decoded sample rounding.

## 0.2.13
- Publish real track title, artist, artwork, playback state and timeline to the system Media Session. Wire play, pause, stop, relative skip and absolute seeking to the synchronized two-stem player; release system handlers when leaving playback. Support optional browser features without requiring them.

## 0.2.12
- Use one viewport observer for artwork; once visible, load immediately with an explicit anonymous CORS request and ordinary HTTP caching. Recognize already-decoded cached images and test actual image decoding, visibility and unavailable-image fallback. The existing artwork API must supply valid image bytes.

## 0.2.11
- Resolve shared ready tracks across up to eight catalog pages before calling auth or provider metadata; retry transient auth gateway failures once, and restore missing display metadata while audio continues. Show a neutral temporary header rather than a raw track ID and identify the failing API route on lookup errors.

## 0.2.10
- Resolve shared ready tracks from the first public catalog page before requesting anonymous auth or provider metadata. Share a single in-memory anonymous session and deduplicate concurrent auth requests. Respect HTTP 429 Retry-After (30-second fallback) without sending repeated requests during the cooldown. Defer initial link lookup to avoid duplicate StrictMode requests.

## 0.2.9
- Retry transient metadata failures when opening shared track links. If metadata remains unavailable, resolve verified ready karaoke via status and recover metadata from the public catalog; allow playback even when provider metadata is temporarily unavailable. Do not create karaoke during link resolution.

## 0.2.8
- Remove redundant play button from track rows; title and artwork retain direct karaoke launch, with more room for track metadata.

## 0.2.7
- Compact bottom navigation to 49 CSS pixels plus device safe area; retain at least 44-pixel touch targets and reduce reserved content padding.

## 0.2.6
- Automatically open and load the player whenever karaoke is ready, including after queued creation and on direct track links. Keep the audio context prepared while a job is processing; never require an intermediate open-karaoke button. Offer a retry only after a real loading failure.

## 0.2.5
- Resolve readiness automatically on track selection and direct links; show a loading state before the API confirms whether creation is needed. Remove the manual status step. Mark known ready results in lists and offer retry only on errors.

## 0.2.4
- Start ready karaoke directly from track selection, warming the audio context during the original click. Open the player while loading both stems, then play automatically; retain a manual play fallback if the browser blocks playback. Unknown search results are checked for readiness without creating jobs.

## 0.2.3
- Prepare Web Audio in the initial user gesture, request media playback audio session on supported Safari versions, use hardware-native sample rate, detect interrupted audio contexts, and warn when both stems are muted. Fix intrinsic grid overflow in landscape karaoke layout.

## 0.2.2
- Dedicated viewport-sized karaoke player with a fixed transport dock, independent lyric scrolling, safe-area padding, compact focus mode and landscape layout. Keep play/pause and seek visible in both modes.

## 0.2.1
- Load artwork through the existing public track artwork endpoint. Request only visible covers via IntersectionObserver and native lazy loading; reuse stable URLs and HTTP cache. Preserve the placeholder if a cover is unavailable.

## 0.2.0
- Always-on API catalog and search; remove fictional songs, sample lyrics and synthesized audio from the application. Real IDs for favorites, playlists, history and shared links; preserve local user preferences.

## 0.1.7
- Handle stored timed and plain lyrics, distinguish absent and temporary errors, and retry temporary failures with a bounded schedule. Use the playback cookie without an unnecessary bearer; keep credentialed media requests.

## 0.1.6
- Save and unsave whole playlists independently of songs; heart actions on home collection cards and collection details. Favorites includes separate Songs and Playlists tabs with persistent independent ordering; deleted playlists removed from favorites.

## 0.1.5
- Main Search tab uses real `/demo/search` by default; configured origin automatically reused. Explicit demo toggle, request debounce, retry, and rate-limit message.

## 0.1.4
- Add opt-in real API catalog/search, anonymous session, enqueue/status, protected playback and timed lyrics UI; explicit origin configuration, no silent demo fallback.
- Separate product API adapter; no production cookie/auth assumptions.
- Fix keyboard reordering with direct arrow-key movement.

## 0.1.3
- Reorder favorite songs by dragging the dedicated handle (mouse, touch and keyboard); persist the new order.

## 0.1.2
- Independent mute by tapping music or vocal icons; disabled sliders while muted, restore previous volume on unmute.
- Persist mute preferences across player and settings; improve automated test reliability.

## 0.1.1
- Improved home collections and local persistence.

## 0.1.0
- Mobile-first prototype with search, home, favorites, artist and track pages, history, profile, settings, sharing and mock preparation.
- Bottom karaoke dock, synchronized synthetic test signals and independent volume controls.
- Storybook and automated checks; GitHub Pages workflow.
