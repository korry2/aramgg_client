# aramgg_client

Language: [Chinese](./README.md) | English

A League of Legends ARAM assistant built with Electron, Vue 3, and electron-vite. The current feature set focuses on:

- Reading champion select and gameflow state through read-only LCU APIs and the `OnJsonApiEvent` WebSocket.
- Showing read-only recommendations for the current champion and bench champions at the top of the champion detail window during ARAM champion select.
- Automatically taking screenshots during the in-game `InProgress` stage and recognizing Augments by card position.
- Displaying champion, Augment, item, win-rate, and recommendation data through the champion detail view, the top Augment overlay, and the right-side in-game recommendation list.

This project only assists with analysis and display. It does not automatically pick champions, swap bench champions, lock in, or accept trades.

The application UI is Simplified Chinese by default. This English README is provided for contributors and users who prefer English project documentation.

## Project Structure

- `src/main/`: Electron main process code for windows, IPC, LCU integration, screenshots, OCR, and data loading.
- `src/preload/`: sandboxed preload bridge exposing the minimal `window.electronAPI` surface.
- `src/renderer/`: Vue renderer app, pages, components, services, and styles.
- `src/shared/`: IPC contracts shared across the main, preload, and renderer type boundaries.
- `tests/unit/`: focused Vitest coverage for pure utilities and state transitions.
- `tests/electron/`: Electron/Node-side test scripts.
- `docs/`: current feature guides, troubleshooting notes, architecture progress, and archived documentation.
- `legacy/`: archived material only. Do not add new source code here.

`dist/`, `dist-electron/`, and `build/` are generated build outputs and should not be committed.

## Common Commands

```bash
npm install
npm run dev
npm run test:unit
npm run test:augment-ocr
npm run lint
npm run type-check
npm run build
npm run pack
```

Targeted scripts:

```bash
node tests/electron/test-aram-bench-recommendation.js
node tests/electron/test-winrate-query.js
node tests/electron/test-screenshot-analysis.js
node tests/electron/test-augment-ocr-fixtures.js
```

## Release Flow

GitHub Actions runs lint, type-check, unit tests, and `npm run pack` on a Windows runner.

- Push to `master`: creates an Actions artifact for installer inspection.
- Push a `v*` tag: creates a GitHub Release and uploads the installer, `.blockmap`, and `latest.yml`.
- Manually trigger `Build Windows Release`: creates an Actions artifact only, without publishing a GitHub Release.

The release workflow uses Node `22.18.0` and npm 10, and installs dependencies with `npm ci --ignore-scripts`. After dependency or `package-lock.json` changes, validate the lockfile with npm 10 before publishing:

```bash
npx -p npm@10 npm ci --ignore-scripts
```

Use `npm version` for official releases. It updates `package.json` and `package-lock.json`, creates the version commit, and creates a `v*` tag. Choose the command that matches the release scope:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

Then push the version commit and tag:

```bash
npm run release:push
```

After publishing the installer, update the remote client config at `/api/client/v1/config` so older clients can see the new version and release notes:

- `client.latestVersion`: the new version number.
- `client.downloadUrl`: the new installer or latest download page.
- `client.autoUpdateEnabled`: the global auto-download/install switch. Keep it `false`, or omit it, until the full updater feed has been tested.
- `client.updateFeedUrl`: the auto-update feed directory. It is used only when `client.autoUpdateEnabled: true`.
- `client.changelog` / `client.releaseNotes`: release notes for the new version.

The auto-update feed directory must contain `latest.yml`, `aramgg_client Setup <version>.exe`, and the matching `.exe.blockmap`. For now, prefer updating `latestVersion`, `downloadUrl`, and release notes so older clients use manual downloads. Enable `autoUpdateEnabled` only after the full auto-update path has been verified.

Example: from `0.1.0`, running `npm run release:patch` creates the `0.1.1` version commit and `v0.1.1` tag. After pushing, GitHub Actions verifies that the tag matches the `package.json` version before publishing the Release.

Do not create lightweight tags manually instead of using the release scripts. If a bad release tag must be cleaned up, first confirm the exact local and remote tag to delete, then recreate only the confirmed annotated version tag.

## Development Conventions

- Prefer TypeScript for new source files, services, utilities, IPC contracts, and tests. Add `.js` only when extending an existing JavaScript module or when a dependency/tooling boundary makes TypeScript impractical.
- Keep Vue UI in single-file components. Move business logic into services or utilities where possible.
- When adding or changing an Electron API, update `src/shared/ipc-contract.ts` first, then keep the main handler, preload bridge, and renderer callers in sync.
- TypeScript migration and troubleshooting details are documented in [TypeScript Integration Summary](./docs/TYPESCRIPT_INTEGRATION.md).

## Data API

Client data APIs, API key application, and integration notes are available on the [ARAMGG Data API developer page](https://data.dtodo.cn/developer.html).

This repository does not commit real API keys. For local configuration, copy `.env.local.example` to `.env.local`, then fill in your own `ARAMGG_DATA_API_KEY`.

Client display data uses a locale-isolated, local-first strategy. Default Chinese keeps the compatible `current.json` / `versions/<dataVersion>/` layout; English and Traditional Chinese use `current.<locale>.json` / `versions/<locale>/<dataVersion>/`. Bundled and runtime data render champion details, Augment popups, and recommendation lists before remote checks run. Background updates may activate only complete data for the same locale; non-default config and manifest responses must explicitly declare the requested locale.

## Key Documents

- [Complete Architecture](./COMPLETE_ARCHITECTURE.md)
- [ARAM LCU Read-only Recommendation Progress](./docs/ARAM_LCU_READONLY_RECOMMENDATION_PROGRESS.md)
- [Gameflow Detection Guide](./docs/GAMEFLOW_DETECTION_GUIDE.md)
- [LCU Troubleshooting Guide](./docs/LCU_TROUBLESHOOTING.md)
- [Auto Augment Detection User Guide](./docs/USER_GUIDE_AUTO_AUGMENT.md)
- [Client Data API Distribution Strategy](./docs/client-api-strategy.md)
- [Localized Client Data Review](./docs/LOCALIZED_CLIENT_DATA_REVIEW_2026-07-10.md)
- [Electron Client Update Strategy](./docs/ELECTRON_APP_UPDATE_STRATEGY.md)
- [Electron / electron-vite Architecture Migration Progress](./docs/ELECTRON_VITE_MIGRATION_PROGRESS.md)
- [TypeScript Development Conventions](./docs/TYPESCRIPT_INTEGRATION.md)
- [Project Recommendations and Implementation Progress](./docs/PROJECT_RECOMMENDATIONS_2026-07-10.md)
- [Requirements](./docs/requirements.md)

Older implementation summaries, plans, and completion reports have been archived under [docs/archive/2026-01-legacy](./docs/archive/2026-01-legacy/). They are kept only for historical context. The documents listed above and the current source code are the source of truth.

## UI, Installation, and Runtime Data

- UI copy defaults to Simplified Chinese. New UI strings should continue to include Simplified Chinese first.
- The main window can select `zh-CN`, `en-US`, or `zh-TW` display data. A switch succeeds only when a complete, exactly matching locale dataset is available locally or from the data API.
- The main window is shown on the right side of the primary display work area by default. The champion detail window, top Augment overlay, and right-side recommendation list are still positioned by the main process.
- The main window's window preference controls can decide whether to close the champion detail page when entering a match, whether to show the top Augment overlay, and whether to show the right-side Augment recommendation list.
- LCU credentials are discovered automatically from the running League Client process by default. The main window's game directory setting is an advanced fallback for reading the LCU lockfile and logs only when automatic discovery fails.
- The Windows installer uses an NSIS assisted install flow and allows the installation directory to be selected. The installer normalizes the selected parent directory to an `...\aramgg_client` application subdirectory.
- Mutable runtime data is managed through `src/main/modules/app-paths.ts`. Installed builds prefer writing to `aramgg_client-data/` next to the installation directory, and fall back to Electron `userData` when that location is not writable.
- Subdirectory conventions: `config/` stores electron-store configuration, `logs/` stores application logs, `data/` stores versioned client data caches, and `ocr-partial-screenshots/` stores OCR debug screenshots.

## Security Boundaries

The renderer has no Node access and can call the main process only through the `electronAPI` exposed by the preload bridge. Electron windows keep `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`.

LCU recommendation flows may only read state and statistics. Do not connect mutating APIs such as `pickOrBan`, `benchSwap`, `action`, `acceptTrade`, or `declineTrade` to recommendation modules.
