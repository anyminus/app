# Changelog

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
