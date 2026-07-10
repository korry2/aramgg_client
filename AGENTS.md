# Repository Guidelines

## Project Structure & Module Organization

This is an Electron + Vue app built with `electron-vite`. Source code lives under `src/`:

- `src/main/`: Electron main process, window management, IPC handlers, data loading, screenshots, OCR, and LCU services.
- `src/preload/`: sandboxed preload bridge exposing `window.electronAPI`.
- `src/renderer/`: Vue renderer app, routes, services, shared utilities, UI components, styles, and assets.
- `src/shared/`: contracts shared across the main, preload, and renderer type boundaries.
- `public/`: static assets copied to the renderer build.
- `tests/unit/`: focused Vitest coverage for pure utilities and state transitions.
- `tests/electron/`: Node/Electron integration-style test scripts.
- `legacy/`: reserved for archived legacy material only; do not add new source code there.

Build output directories such as `dist/`, `dist-electron/`, and `build/` are generated artifacts and should not be committed.

## Build, Test, and Development Commands

- `npm run dev`: start the Electron app through `electron-vite dev`.
- `npm run prepare:client-data`: download and validate bundled data for all supported locales.
- `npm run build`: build main, preload, and renderer bundles.
- `npm run pack`: build and package with `electron-builder`.
- `npm run lint`: run ESLint on JavaScript, TypeScript, and Vue files under `src/`.
- `npm run type-check`: run Vue and Electron TypeScript checks.
- `npm run test:unit`: run Vitest unit tests for focused shared/main utilities.
- `npm run test:augment-ocr`: run committed PaddleOCR augment screenshot fixtures.
- `npm run test:screenshots`: run screenshot/OCR analysis test script.

`ARAMGG_CLIENT_DATA_PROGRESS_INTERVAL_MS` only changes the incomplete-download heartbeat interval for client-data preparation; it must not affect validation or activation behavior.

Use targeted test scripts in `tests/electron/` directly when debugging a feature, for example `node tests/electron/test-winrate-query.js`.

## Coding Style & Naming Conventions

Use Vue single-file components for renderer UI. Keep business logic in services where possible, not inside templates. Prefer existing UI primitives in `src/renderer/components/ui/`, Tailwind utility classes, and project design tokens in `src/renderer/styles/index.css`. Add scoped CSS only when Tailwind and existing tokens are not a good fit.

Use JavaScript/TypeScript ES modules. Prefer TypeScript by default for new source files, services, utilities, IPC contracts, and tests; add `.js` only when extending an existing JavaScript module or when a dependency/tooling boundary makes TypeScript impractical. Component files use `PascalCase.vue`; services and utilities use lowercase or kebab-case names. Keep comments short and only where they clarify non-obvious behavior.

## Testing Guidelines

There is a focused Vitest unit suite, but not broad end-to-end coverage. Before submitting changes, run `npm run test:unit`, `npm run lint`, `npm run type-check`, and `npm run build`. For data, screenshot, OCR, or augment logic, also run the closest script under `tests/electron/`.

Name new test scripts with the existing pattern: `tests/electron/test-<feature>.js`.

## Commit & Pull Request Guidelines

Follow the repository’s conventional commit style: `feat:`, `fix:`, `chore:`, `docs:`, or `style:`. Examples: `fix: load sandbox preload in dev`, `style: refine app ui system`.

Pull requests should include a short summary, test results, screenshots or screen recordings for UI changes, and notes about Electron/main/preload security impact when relevant.

## Release Guidelines

The GitHub release workflow runs on Node `22.18.0` with npm 10, installs with `npm ci --ignore-scripts`, and validates that a `v*` tag matches `package.json` version.

After dependency or lockfile changes, verify the lockfile with `npx -p npm@10 npm ci --ignore-scripts` before publishing. Use the existing `npm run release:*` scripts so `npm version` creates the version commit and annotated tag; avoid ad hoc lightweight release tags. If a bad release tag must be cleaned up, delete the intended local and remote tags explicitly and recreate only the confirmed version tag.

Older clients see future app release notes through the remote `/api/client/v1/config` response. After publishing a new installer, update `client.latestVersion`, `client.downloadUrl`, and `client.changelog` or `client.releaseNotes`; keep `client.autoUpdateEnabled` false unless the `electron-updater` feed has been fully tested. Do not rely on the packaged local changelog fallback for future versions.

## Security & Configuration Tips

Renderer code must not assume Node access. Use the preload bridge and IPC APIs. Keep `contextIsolation`, `sandbox`, and `webSecurity` enabled unless a change explicitly justifies otherwise.

Define new preload methods and pushed events in `src/shared/ipc-contract.ts` first, then implement the typed preload bridge and main-process handler. Renderer-writable electron-store keys must remain allowlisted in `src/main/ipc/preferences-handlers.ts`.

ARAM champ-select recommendation code must remain read-only. Do not connect `pickOrBan`, `benchSwap`, `action`, `acceptTrade`, or `declineTrade` to recommendation flows; keep executable LCU writes isolated to their existing feature areas such as rune pages.

Keep ARAM champ-select recommendations in the hero detail window, not on the main renderer screen. The recommendation area should show all available candidates and remain a read-only recommendation surface.

LCU auth discovery should remain process-first. The `lolPath` / main-window `游戏目录` setting is an advanced fallback only; do not make manual path mandatory or couple recommendations to it.

Mutable runtime data, including electron-store config, logs, remote-data cache, and OCR debug screenshots, must go through `src/main/modules/app-paths.ts`. Do not hardcode `~/.aramgg_client` or write mutable state into packaged resources, `dist/`, `dist-electron/`, or `build/`.

Client data loading must stay local-first for foreground views. Complete cached or bundled data should render hero detail and augment popup surfaces immediately; remote `dataVersion` checks and downloads should run in the background and only activate a new version after required files are complete.

When both user-cache and bundled pointers are complete for one locale, select the newest compatible dataVersion rather than always preferring the writable cache. Keep foreground and OCR fixture tests isolated from real user data, LCU discovery, and live seasonal datasets. `ARAMGG_OCR_LOCALE` is a test/debug override only; production language detection remains LCU-driven.

Client data must remain isolated by locale. Keep the legacy flat pointer and version path for default `zh-CN`; use locale-scoped pointers and version directories for non-default locales. Non-default config and manifest responses must explicitly match the requested locale, and packaging/CI must fail instead of relabeling default Chinese data.

Augment OCR runs through the PaddleOCR Node backend and packaged `resources/paddleocr` ONNX models. Preserve left/center/right title-region ordering, transient-miss retention during reroll animations, and the title-region fast path/cache. Do not fill missing title slots with broad OCR fallbacks; keep unread slots empty so game order cannot be reshuffled by fallback text regions.

Augment OCR locale hydration must use the minimal manifest plus `augments.json` path. Load the current/default locale for the foreground frame, hydrate other supported locales in the background with retryable failures, and do not make OCR trigger full champion datasets.
