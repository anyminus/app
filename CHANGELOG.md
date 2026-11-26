# Changelog

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
