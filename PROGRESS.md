# PROGRESS.md

Last updated: 2026-06-25

## Current State

The project is a Linux Electron desktop wrapper for the official ChatGPT web
app. The current app version is `0.3.3`.

The repository now includes:

- `AGENTS.md` with agent-facing maintenance, security, dependency, and
  packaging guidance.
- Updated npm dependencies and lockfile.
- Linux packaging verified for the current dependency set.

## Dependency Snapshot

Explicit dependency versions after the 2026-06-25 refresh:

- `@ghostery/adblocker-electron`: `^2.18.0`
- `@types/node`: `^26.0.1`
- `electron`: `^42.5.0`
- `electron-builder`: `^26.15.3`
- `esbuild`: `^0.28.1`
- `typescript`: `^6.0.3`
- `vite`: `^8.1.0`

Packaging config is aligned with Electron:

- `electron-builder.config.cjs` uses `electronVersion: '42.5.0'`.

`npm outdated` produced no output after the refresh.
`npm audit --omit=optional` reported `found 0 vulnerabilities`.

## Verification Run

Commands run after the dependency refresh:

```bash
npm test
npm run typecheck
npm audit --omit=optional
npm run build
npm run package:linux
```

Observed results:

- `npm test`: 56 tests passed, 0 failed.
- `npm run typecheck`: passed.
- `npm audit --omit=optional`: found 0 vulnerabilities.
- `npm run build`: passed and rebuilt `dist/`.
- `npm run package:linux`: passed and rebuilt Linux release artifacts.

## Current Local Artifacts

Generated artifacts from the latest package run:

- `release/ChatGPT WebApp-0.3.3.AppImage`
  - Size: `127580566` bytes
  - SHA-256:
    `8ae6b736dba7a6c9ddc2f37584b6b3e7079050e8b0bb2b9807660afbcb2c92c9`
- `release/chatgpt-webapp-linux_0.3.3_amd64.deb`
  - Size: `99246564` bytes
  - SHA-256:
    `6f55099bcd8ed05ed8d4ad6211474160b691bc1d3ccc3a5366b05f5058107516`

These files are generated output under `release/` and remain ignored by git.

## Known Notes

- electron-builder still warns that `desktopName` is not set. This is
  non-blocking for packaging, but may affect window-to-desktop-file association
  in some Linux desktop environments.
- `release/`, `dist/`, `.build/`, and `node_modules/` should stay untracked.
- When Electron changes, keep `package.json`, `package-lock.json`, and
  `electron-builder.config.cjs` in sync.

## Suggested Next Work

- Consider adding `desktopName` and `linux.syncDesktopName` to improve Linux
  desktop window association.
- If the public release version should change after dependency refreshes, bump
  `package.json` version before packaging.
- Keep tests focused on security boundaries, URL policy, permissions, blocker
  behavior, runtime dependency staging, and packaging assumptions.
