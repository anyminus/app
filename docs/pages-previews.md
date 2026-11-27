# GitHub Pages: production + branch previews

Production: https://anyminus.github.io/app/ — always built from main.
Preview: https://anyminus.github.io/app/prototype/face-masks/ — built from prototype/face-masks.

Pages publishes a single combined artifact. Main's normal build and Storybook occupy the root. Each branch in pages-previews.json is built independently with read-only permissions and copied under its exact branch path (prototype/<name>). The final assembly rejects a collision with the production prototype directory. Only the main workflow can deploy. Preview branch pushes run CI but do not deploy. After successful preview CI, manually run the workflow from main to rebuild the combined site. Main pushes also rebuild it. A failed build does not replace the last successful deployment. Adding another preview: create prototype/<slug> from main, then add that branch to pages-previews.json in main; remove the entry to unpublish it on next deployment. Deleting a listed branch without removing it first will fail the combined build.

Settings: Pages → Build and deployment → Source: GitHub Actions. Environments → github-pages → allowed branch main only. Do not grant prototype branches Pages deployment permission. Manual deployment: Actions → Prototype CI and Pages → Run workflow → main. The same origin shares browser storage and Telegram OAuth callback still points to production; preview is not an isolated backend/account environment. Use guests/test data for experiments.

The production application source, backend, and audio pipeline are unchanged by this workflow change. Acceptance: check root and preview URLs, check root continues to serve main after preview pushes, confirm preview assets and version.json resolve relative to the preview path, verify guest video recording on device.
