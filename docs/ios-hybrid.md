# AnyMinus iOS hybrid — 0.1.1 (SDD)
Branch: ios-audio-lab. Web base 0.5.56. No server or main branch changes.

## Scope and architecture
Capacitor 7.6.11 packages the existing React/Vite build locally, with no remote server.url. The iOS-only button in ready-track VideoKaraoke opens a full-screen SwiftUI/AVFoundation lab. The existing browser player is paused and its AudioContext suspended before handoff. Normal playback resumes only on user request. Browser capture remains available for comparison.
The already decoded instrumental stem (first buffer) becomes PCM16 WAV, transferred in bounded base64 chunks to a local temporary file. Maximum 128 MiB, no network request, cookies, tokens or server media tickets through the bridge. Native recorder gets the original instrumental only, not current mixer, pitch, tempo, lyrics or timeline position. The lab loops from start; this is not production playback. A local file can still be imported manually. Raw MOV and approximate MP4 mix are available via system share. Close stops playback/camera, deactivates audio session and removes transferred WAV. Other lab recordings/imports remain in temporary storage.

## Build
On macOS, Xcode 16+, Node 22:
```sh
npm install
npm run ios:prepare
npx cap open ios
```
The generated ios/ directory is intentionally ignored. prepare-ios.sh runs Capacitor CLI using Swift Package Manager, synchronizes assets and patches native entrypoint, storyboard and permission strings. Repeatable on a generated project; do not store manual changes there. Native sources live in ios-lab/ and ios-hybrid/. CI builds simulator and uploads the app; it does not sign an IPA.
TestFlight: select Apple Developer Team, confirm a unique App ID, marketing/build version, app icon and privacy disclosures, archive with a currently accepted Xcode SDK and upload via Xcode/App Store Connect. No signing credentials in Git. Bundle ID com.anyminus.app is provisional until account confirms it.

## Required device verification
- Open real catalog and search. The native local web origin is capacitor://localhost, not https://anyminus.github.io. Backend allowlist/cookie behavior and media ticket CORS must be verified on device; don't enable native HTTP globally or weaken origin checks. If blocked, explicitly scope backend changes after review. No API change included.
- Open a ready track, use native recording button, compare sound in playback/default/measurement, check input/output routes and microphone permissions, and share both outputs.
- Repeat speaker, headphones, CarPlay while stationary. Check interruption/background behavior, app exit, cancellation and repeated recordings. Compare sync against reference; no claim of sample-accurate synchronization.
- Validate web fallback and no native button in standard browser. Verify production Pages deployment remains main-only.
- Before production: full native dual-stem mixer and shared transport, pitch/time-stretch, lyric overlay, compensation, lifecycle and storage cleanup, localization, signing, App Store review rights/privacy. Native auth including Telegram is not validated.
