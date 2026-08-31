# AGENTS.md — FGO Chronicle Reader

## Project

Unofficial FGO (Fate/Grand Order) visual-novel story reader. React 19 + TypeScript + Vite 8 frontend, Express 5 server for translation proxying and static serving. Three deployment targets: web (dev/prod server), Windows portable (Electron), Android (Capacitor).

Chinese-language UI and docs. Data comes from the Atlas Academy API.

## Commands

| Task | Command |
|---|---|
| Dev server (Vite + translation middleware) | `npm run dev` |
| Production build (tsc + vite) | `npm run build` |
| Unit tests (Vitest) | `npm test` |
| Production server (serves `dist/`) | `npm start` |
| Windows portable EXE | `npm run package:exe` |
| Android APK (needs JDK 21 + Android SDK) | `npm run package:apk` |
| Both platforms | `npm run package:all` |
| Sync Capacitor after build | `npm run android:sync` |

`npm run build` is `tsc -b && vite build` — it type-checks via project references first. There is no separate lint, format, or typecheck script; `tsc -b` during build is the only static analysis gate.

## Architecture

```
src/              React frontend (TypeScript)
  adv/            ADV script compiler & executor (core engine)
  components/     LibraryView.tsx, ReaderView.tsx (only two top-level views)
  lib/            Business logic: scriptParser, translation, storyPreparation, etc.
  hooks/          React hooks: BGM, asset URLs, translations
  data/           Atlas Academy API client
  platform/       Runtime detection (web / Electron / Capacitor)
server/           Node server (plain .mjs, NOT TypeScript)
  reader-app.mjs  Express app: CSP headers, Atlas API proxy, static file serving
  translation-api.mjs  Translation proxy endpoints (DeepL, OpenAI-compat, Bing)
  local-env-config.mjs  Reads/writes .env.local for client-facing translation config
shared/           Code shared between server and client (.mjs + .d.mts declarations)
desktop/          Electron main process entry (main.mjs)
third_party/      Vendored deps — fgogotran glossary, atlasacademy license stubs
scripts/          Build/packaging helper scripts
tests/            E2E tests (Python + Playwright, NOT Vitest)
docs/             FGO script format spec, custom ZIP script spec
```

Entry points:
- Web: `index.html` → `src/main.tsx` → `src/App.tsx`
- Production server: `server.mjs` → `server/reader-app.mjs`
- Electron: `desktop/main.mjs` (embeds the server + BrowserWindow)
- Vite config: `vite.config.ts` injects translation API middleware into dev server

## Testing

- **Unit tests**: Vitest, colocated as `*.test.ts` next to source in `src/`. Run with `npm test`.
- **Server/shared tests**: Vitest, `*.test.mjs` in `server/` and `shared/`. Included in `npm test`.
- **E2E tests**: Python Playwright scripts in `tests/`. Require a running server (default `http://127.0.0.1:5187`, override via `FGO_E2E_URL`). Mock Atlas CDN with deterministic placeholders. Run individually: `python tests/e2e_reader.py`.
- No snapshot testing. No test coverage tool configured.
- To run a single unit test file: `npx vitest run src/lib/scriptParser.test.ts`

## Key conventions

- Server and shared files are `.mjs` (not `.ts`), with hand-written `.d.mts` type declarations. Do not convert them to TypeScript without coordinating all consumers.
- The ADV script parser (`src/adv/`) uses FGO-specific syntax: `＄` scene markers, `[command args]` bracket instructions. Tests exercise this by passing raw script text through `compileFgoScript` / `ScriptExecutor`.
- `Region` type: `"CN" | "JP" | "NA" | "TW" | "KR"`. Many functions accept a `region` option.
- `masterName` (御主, default `"御主"`) is threaded through compiler, executor, and translation. Tests explicitly set it.
- Translation is a core feature with multiple backends. The `shared/translation-core.mjs` engine is used by both server (proxy) and client (direct). `shared/translation-quality.mjs` contains the FGO glossary and prompt engineering.
- CSP headers in `server/reader-app.mjs` are strict — images/media only from `*.atlasacademy.io`. If adding new external resources, update the CSP.
- The Vite dev server proxies `/atlas-api` to `https://api.atlasacademy.io` and mounts `/translation-api` as Express middleware. Production server (`server/reader-app.mjs`) handles both directly.

## Environment

Copy `.env.example` to `.env.local` (gitignored). Key variables:

- `PORT` — server port (default 4173)
- `VITE_COORDINATE_DEBUG` — enables coordinate offset debug UI (requires rebuild)
- `DEEPL_AUTH_KEY`, `DEEPL_SERVER_URL` — DeepL translation
- `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL` — OpenAI-compatible translation
- `OPENAI_COMPAT_ALLOW_NO_AUTH` — allow unauthenticated local translation service
- `TRANSLATION_ALLOW_CLIENT_CONFIG`, `TRANSLATION_TIMEOUT_MS` — server translation settings

The Vite config merges `process.env` and `loadEnv()` so both shell env and `.env.local` are available at dev time.

## Docs worth reading

- `docs/FGO_Script_Format_Spec.md` — full FGO script command reference
- `docs/FGO_Story_Reader_Standard.md` — reader behavior standard
- `docs/custom-scripts.md` — custom ZIP script package format
- `build.md` — packaging details for both platforms
