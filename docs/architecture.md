# Frontend boundaries

Source of truth: anyminus/app. The application includes an explicit demonstration mode with fictional catalog metadata, authored demo lyrics and synthetic audio, plus a configurable API adapter. Verify CORS, session handling and media access before enabling live integration. No server credentials are embedded. Browser demo audio is not a substitute for recorded vocal stems. See [API integration](api-integration.md) for the current interface contract.

Design system: semantic CSS variables for dark/light themes, reusable artwork, mixer, icon button, track row. Storybook catalog is served at /app/storybook/. Hash routing permits deep links without server rewrite. Independent volume preferences use 0–100%; default music 100, artist vocal 15. Shared clock, two gain nodes. The vocal guide is synthesized, not a real artist recording. No audio is uploaded. Production synchronization and device compatibility require further testing.
