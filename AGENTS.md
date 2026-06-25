# AGENTS.md

Guidance for coding agents working in this repository.

## Project Summary

This project is a privacy-isolated Linux desktop wrapper for ChatGPT. It is an
Electron app that loads the official `https://chatgpt.com` site in the main
window and uses a separate persistent session partition for ChatGPT data.

Primary stack:

- Node.js 22 runtime assumptions.
- npm with `package-lock.json`.
- TypeScript source under `src/`.
- Electron main/preload processes.
- Vite renderer build for the local privacy/settings panel.
- esbuild for main and preload bundles.
- electron-builder for Linux AppImage and deb packaging.
- `@ghostery/adblocker-electron` for network-level tracker blocking.

## Repository Layout

- `src/main/`: Electron main-process services and app orchestration.
- `src/preload/`: sandboxed preload scripts for narrow renderer bridges.
- `src/renderer/`: local privacy/settings panel UI.
- `src/shared/`: shared pure logic, especially URL policy.
- `tests/`: Node test runner coverage for security, runtime, policies, export,
  blocker, startup, window state, and Vite config behavior.
- `scripts/build.mjs`: typecheck plus esbuild and Vite production build.
- `scripts/package-linux.mjs`: stages runtime dependencies and invokes
  electron-builder for AppImage and deb output.
- `electron-builder.config.cjs`: Linux packaging configuration.
- `assets/`: app assets and generated icons.
- `dist/`, `release/`, `.build/`: generated outputs; do not commit them unless
  explicitly requested.

## Required Commands

Use these commands from the repository root:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run package:linux
```

Before committing code or dependency changes, run at least:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

For packaging changes or Electron updates, also run:

```bash
npm run package:linux
```

## Security and Privacy Boundaries

Preserve these boundaries unless the user explicitly asks for a reviewed
security design change:

- The main ChatGPT window loads `https://chatgpt.com`.
- ChatGPT state lives in `persist:chatgpt-private`; do not share system browser
  profile data.
- Remote ChatGPT content must not receive Node.js integration.
- Keep `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, and
  `allowRunningInsecureContent: false`.
- Keep permissions routed through `src/main/permission-policy.ts`.
- Keep URL routing centralized in `src/shared/url-policy.ts`; ChatGPT/OpenAI
  core login and content hosts stay internal, unrelated external links open in
  the system browser.
- Keep downloads user-mediated through a save dialog.
- Do not store OpenAI credentials or chat content in app settings.
- This is an unofficial wrapper; do not add official OpenAI branding assets.

## Dependency and Packaging Rules

- Use npm, not yarn/pnpm/bun.
- Update both `package.json` and `package-lock.json`.
- When updating Electron, keep `electron-builder.config.cjs` `electronVersion`
  aligned with `package.json`.
- `npm outdated` is the quickest way to inspect current/wanted/latest package
  state.
- `npm install <pkg>@latest` and `npm install --save-dev <pkg>@latest` are the
  expected explicit-dependency update paths.
- `release/` artifacts are local packaging output and are ignored by git.
- If electron-builder download failures occur, first verify whether the failure
  is in the Electron/tool download path. Prefer a checksum-verified cache
  prefill over weakening TLS validation in repository config.

## Change Guidelines

- Keep changes small and scoped to the requested behavior.
- Prefer pure helpers in `src/shared/` or focused main-process services over
  expanding `src/main/main.ts`.
- Add or update tests when changing URL classification, permissions, security
  preferences, blocker behavior, runtime dependency staging, exports, startup,
  or packaging assumptions.
- Avoid broad refactors during maintenance updates.
- Do not commit generated output from `dist/`, `release/`, `.build/`, or
  `node_modules/`.

## High-Risk Areas

- `src/main/security-config.ts`: window sandbox and session isolation.
- `src/shared/url-policy.ts`: internal/external navigation classification.
- `src/main/permission-policy.ts`: device and browser permission grants.
- `src/main/blocker-controller.ts`: tracker blocking rules and cache behavior.
- `scripts/package-linux.mjs`: runtime dependency closure and staged app
  package metadata.
- `electron-builder.config.cjs`: Electron runtime version and Linux target
  configuration.

## Useful Verification Checks

- `npm test` should report all test files passing.
- `npm run typecheck` should produce no TypeScript errors.
- `npm run build` should recreate `dist/`.
- `npm run package:linux` should produce:
  - `release/ChatGPT WebApp-<version>.AppImage`
  - `release/chatgpt-webapp-linux_<version>_amd64.deb`
- After pushing, `git rev-parse HEAD @{u}` should return matching SHAs.
