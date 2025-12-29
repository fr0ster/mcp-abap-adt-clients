# Repository Guidelines

## Project Structure & Modules
- TypeScript sources in `src/` with `clients/`, `core/`, and `utils/` as primary modules; compiled output lands in `dist/`.
- Tests live in `src/__tests__` (integration per domain plus examples); Jest roots are scoped to `src/`.
- Reference `docs/` for design and roadmaps, `examples/` for usage snippets, `tools/` for maintenance scripts, and `scripts/` for test helpers.

## Build, Test, and Development Commands
- `npm run build` – clean then compile via `tsconfig.json` to refresh `dist/`.
- `npm run build:fast` – compile without cleaning for quicker loops.
- `npm test` – Jest suite (sequential; includes integration; `pretest` enforces integration type-check).
- `npm run test:check` / `npm run test:type-check` – TypeScript-only validation of tests.
- `npm run test:sequential` – explicit sequential runner (`scripts/run-tests-sequential.js`).
- `npm run test:module` – module-level smoke check; `npm run test:long-polling-read` for the polling scenario via `ts-node`.

## Coding Style & Naming Conventions
- TypeScript, Node >=18, 2-space indentation, semicolons, ES module imports.
- Interface-first design: external interactions only through interfaces; keep `ILogger` injected rather than hardcoding logging.
- Naming: `PascalCase` for types/classes, `camelCase` for functions and vars, `UPPER_SNAKE_CASE` for constants when needed.
- Prefer fluent builders for ADT operations; avoid coupling clients to concrete implementations.

## Testing Guidelines
- Jest with `ts-jest`; tests match `*.test.ts` under `src/__tests__` and run with `maxWorkers=1` to avoid ABAP object contention.
- Integration tests require a reachable SAP ADT system; avoid parallel execution and clean locks if failures occur.
- Place new specs beside the feature (e.g., `src/__tests__/integration/program/Program.test.ts`); keep names descriptive and scenario-focused.
- Coverage targets `src/**/*.ts` excluding tests and index files; keep new code covered with unit or integration cases.

## Commit & Pull Request Guidelines
- Use conventional prefixes from history (`feat:`, `docs:`, `chore:`, etc.); subjects should be imperative and concise.
- PRs should outline scope, include validation commands, and link issues; call out ADT system assumptions and manual cleanup.
- Attach screenshots/logs only when they materially aid review (e.g., lock registry output, test summaries).
- Keep changes minimal per PR to respect sequential test costs.

## Security & Configuration Tips
- Do not commit credentials or SAP endpoints; rely on environment variables for ADT connection when running tests.
- Respect `.locks/active-locks.json`; ensure tests and scripts release locks and document any manual steps.
- When adding scripts, preserve sequential execution to avoid clashing with shared ABAP objects.
- Deliver all repository artifacts (code, docs, scripts) in English, but keep conversational exchanges and contextual notes in Ukrainian.
