# ANYMINUS 0.4.4 — Karaoke lyric motion

Status: visual direction approved by the owner on 2026-11-27; implementation committed in [57e565e](https://github.com/anyminus/app/commit/57e565e971dcfa8ddd1e3bfd43979479783d4060). Physical-device acceptance is not recorded. CI snapshot before this documentation commit: Build: success; deployment: in_progress. [Run 45972222974](https://github.com/anyminus/app/actions/runs/45972222974).

## Specification
- Active timed line: 100% of user-selected text scale; past and future lines: 75%. Scale is relative to the existing responsive font-size, not a separate font preference.
- Scale transition 480ms; scroll centering 480ms; color and opacity transition 420ms. Left-center transform origin. Existing past/future opacity and active accent remain.
- Keep original line wrapping and outer row geometry; only transform the inner span. Do not resize the player dock, mixer or page.
- Spring-like monotone normalized easing with no bounce or overshoot. Rapid line changes cancel and retarget from actual scrollTop. Resize/focus/font changes center immediately. Wheel/touch cancel current scroll. Auto-follow disabled means no automatic centering. Reduced-motion preference disables visual transition and smooth scroll.
- LRC timing, audio clock, click-to-seek, plain text and playback API are unchanged. No new library, server change, storage format or migration.

## Code map and regression gates
| Area | Location | Check |
| --- | --- | --- |
| Motion curve | src/lyrics.mjs | npm test: monotonicity, bounded values, exact endpoints |
| Scroll lifecycle | src/LiveCatalog.tsx | Playwright player-layout: center within lyrics viewport, no document scroll |
| Scale and color | src/styles.css | Playwright: active 1.0, inactive 0.75, transition and reduced-motion |
| Release | package.json, src/App.tsx, CHANGELOG.md | npm run build, npm run test:e2e, Pages deploy |

## Manual acceptance (pending)
- Open a real ready track with LRC on mobile and desktop; confirm natural line transitions during playback, both normal and text-only layouts.
- Confirm long lines remain readable and do not overlap, seek forward/back and rapid line changes settle without jitter, manual scroll/disabled auto-follow and reduced motion behave as specified.
- Confirm mixer, playback controls and audio synchronization remain unchanged. Owner approval of the preview does not substitute for live-device testing.

## Existing integration boundaries
Artist IDs and popularity pagination belong to 0.4.2–0.4.3; provider list length controls availability of the load-more button. Earlier public artwork failures require a fresh live image check after backend transport deployment; CI mocks are not proof. Telegram login remains optional under the DEV guest policy. Do not interpret this documentation-only update as a server change or as resolution of those separate issues.
