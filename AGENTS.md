# AGENTS.md

Notes for AI agents working in `video-wall-player` — a Vue 3 component library
(published to npm as `video-wall-player`) plus its demo site, built together
from one repo.

## Toolchain

- **Node 22** (`.nvmrc` = 22.21.1), **pnpm 10.12.4** (`packageManager`).
  `engines.node` claims `>=16`, but CI uses 22 — use 22.
- Repo is indexed by **CodeGraph** (`.codegraph/`). Prefer `codegraph_explore`
  over grep/Read for locating and understanding code.

## Commands

| Task | Command |
|---|---|
| Dev (demo site, **HTTPS**) | `pnpm dev` |
| Tests (vitest) | `pnpm test` |
| Single test file | `pnpm test src/core/media-math.test.ts` |
| Watch tests | `pnpm test:watch` |
| Build library | `pnpm build` |
| Build demo site | `pnpm demo:build` |
| Release | `pnpm release` (see Release below) |

There is **no `lint` or `typecheck` script**. `pnpm build` emits `.d.ts` via
`vite-plugin-dts` (backed by `@vue/language-core`); for a standalone
type-check run `npx vue-tsc --noEmit -p tsconfig.json`.

## Three Vite configs — don't confuse them

- `vite.config.ts` — **the demo only**. `root: './demo'`, serves over HTTPS
  (`@vitejs/plugin-basic-ssl` + `server.https`), outputs to `dist-pages`,
  `base: '/video-wall-player/'`. Plain `vite` / `pnpm dev` runs this, NOT the
  library.
- `vite.config.lib.ts` — library build → `dist/` (`index.mjs`, `style.css`,
  `dist/types/*.d.ts`), excludes `src/test/**` from dts.
- `vite.config.lib.auto.ts` — the `video-wall-player/auto` entry: same as lib
  but injects CSS via JS (`vite-plugin-css-injected-by-js`),
  `emptyOutDir: false`.
- `pnpm build` chains the **two `.lib.` configs** sequentially. Both write to
  `dist/`; the second intentionally does not wipe it.

`vitest.config.ts` exists **only** to override the demo's `root: './demo'` for
test discovery. Deleting it breaks `pnpm test` (vitest would scan `demo/`).
Keep it.

## Library build externals

In `vite.config.lib*.ts`, `rollupOptions.external` =
`['vue', '@vueuse/core', 'lucide-vue-next']` (consumers supply them).
**`pixi.js` is intentionally bundled** (used only by `CanvasWallPlayer`) — do
not add it to `external`.

## Architecture (see `docs/adr/0001-headless-rebuild.md`)

Layered — lower layers must not import from higher ones:

```
src/core/        headless: hooks + pure math, ZERO Vue component imports
  media-math.ts        pure helpers (normalizeResource, getSegmentStarts, ...)
  types.ts             canonical public types (MediaResource, PlayerState, ...)
  useMediaSync.ts      element-level sync engine (works on ONE <video>)
  useVideoWallState.ts pure wall state + segment math
  useVideoWall.ts      orchestration + hidden <video> pool (CanvasWallPlayer)
  *.contract.test.ts   contract tests pinning headless behavior
src/components/  presentational, build on core
  VideoWallPlayer/     DOM renderer (default, recommended)
  CanvasWallPlayer/    PixiJS/WebGL renderer (features, NOT a perf win — see README)
  PlayerControls/      standalone control bar (usable on a single <video>)
  SegmentNav/          chunk-nav button (PlayerControls affix slot)
src/styles/      CSS-variable themes; Tailwind scoped under .video-wall-player
```

`src/index.ts` is the public entry; `src/auto.ts` re-exports it + imports the
CSS. Anything not exported from `index.ts` is internal. Keep `src/core/` free
of component imports so the headless primitives stay tree-shakeable and usable
without the DOM renderer.

## Tests

- Co-located as `*.test.ts` next to source.
- `*.contract.test.ts` files are the **behavioral contract** for the headless
  primitives — treat them as a spec; don't weaken assertions, update code and
  contract together.

## Styling rules

- Tailwind `important` is scoped to `.video-wall-player` and **preflight is
  disabled** — keep both: the library must not leak resets/utilities into host
  apps.
- Themes are CSS variables in `src/styles/themes.css` (~20 `--vwp-*` tokens).
  Theming = overriding tokens, not new CSS.
- Path alias: `@` → `src`.

## Commit convention (from `.cursorrules`)

- Commit messages **in Chinese**.
- Conventional Commits (`feat:` / `fix:` / `docs:` / `chore:` …).
- ≤ 100 chars.

## Release

`pnpm release` = `pnpm build` → `changelogen` (writes `CHANGELOG.md`) →
`bumpp --all` (bumps version, commits `"chore: release v%s"`, tags `v*`,
pushes).

- Pushing a `v*` tag → `.github/workflows/release.yml` →
  `npm publish --provenance` (needs `NPM_TOKEN` secret).
- Push to `main` → `.github/workflows/pages.yml` → builds lib + demo →
  deploys `dist-pages` to GitHub Pages.
