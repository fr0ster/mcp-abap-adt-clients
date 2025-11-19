# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **High-level clients**
  - `LockClient` – wraps lock/unlock for all supported object types, logs `[LOCK]` entries, and registers handles inside `.locks/active-locks.json`.
  - `ValidationClient` – shared entry point for ADT name validation (classes, programs, domains, etc.) so handlers no longer import internal modules.
- **Documentation**
  - README rewritten around the Builder-first workflow and the new clients.
  - Linked to the root `STATEFUL_SESSION_GUIDE` for consumers who need to persist `sessionId` + cookies between runs.

### Changed
- **TableBuilder.update()** now calls a refactored `updateTable()` that requires the existing lock handle and session ID. This removes the duplicate LOCK/UNLOCK sequence that previously caused EU510 “currently editing” errors even when the table did not exist.
- **builderTestLogger**: skips no longer increment the global counter twice, so numbered output stays `[1]` for the skipped workflow and `[2]` for the read test.
- README/API reference now describe Builders and clients instead of exposing low-level functions directly.

### Fixed
- Workflow tests for tables now register locks through `onLock` + `LockClient`, ensuring clean unlock/cleanup after each run.
- `updateTable()` no longer spawns a second stateful session; the existing ADT session (and cookies) are reused end-to-end.

