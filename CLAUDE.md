# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Requirements

- All repository artifacts (source code, documentation, comments, commit messages) must be written in English
- Direct communication with the user must be in Ukrainian

## Project Overview

**mcp-abap-adt-clients** is a TypeScript library providing ADT (ABAP Development Tools) clients for SAP ABAP systems. It offers both read-only and CRUD operations for SAP ABAP ADT objects through REST API.

## Common Commands

```bash
# Build
npm run build           # Clean, lint check, and compile TypeScript
npm run build:fast      # TypeScript compile only (skip linting)

# Lint & Format
npm run lint            # Lint and auto-fix with Biome
npm run lint:check      # Lint check only (no fixes)
npm run format          # Format code with Biome

# Test (requires .env with SAP credentials and test-config.yaml)
npm test                        # Run all tests sequentially
npm test -- integration/class   # Run tests for specific object type
npm test -- e2e                 # Run end-to-end tests
DEBUG_TESTS=true npm test -- integration/class  # With connection debug logs
DEBUG_ADT_TESTS=true npm test -- integration/view  # With ADT operation logs
```

## Architecture

### Client Classes (Entry Points)

- **AdtClient** (`src/clients/AdtClient.ts`): High-level CRUD operations via factory methods (`getClass()`, `getProgram()`, `getPackage()`, etc.). Each method returns an `IAdtObject<Config, State>` handler.
- **AdtRuntimeClient** (`src/clients/AdtRuntimeClient.ts`): Runtime operations - debugger, memory snapshots, traces, logs.

### Core Modules (`src/core/`)

Each object type (class, program, package, etc.) has a dedicated module following this structure:
- `AdtXxx.ts` - High-level class implementing `IAdtObject<Config, State>`
- `types.ts` - Configuration and state interfaces
- `create.ts`, `read.ts`, `update.ts`, `delete.ts` - Low-level CRUD functions
- `lock.ts`, `unlock.ts` - Session management
- `activation.ts`, `check.ts`, `validation.ts` - Supporting operations

**Shared module** (`src/core/shared/AdtUtils.ts`): Cross-cutting utilities (search, where-used, package hierarchy, SQL queries, etc.).

### Design Patterns

**Factory + Handler Pattern**: `AdtClient` creates object-specific handlers that manage operation chains automatically.

**Operation Chains**: Handlers orchestrate multi-step operations:
- Create: validate → create → check → lock → update → unlock → activate
- Update: lock → check → update → unlock → activate
- Delete: check(deletion) → delete

**Session Management**: Handlers toggle between stateful (during lock) and stateless modes automatically.

**Interface-Only Communication**: All code depends on `IAbapConnection` interface, not concrete implementations. Connection management is external (`@mcp-abap-adt/connection`).

## Code Standards

- All code, comments, error messages in English
- Comments explain "why" not "what"
- Never change `package.json` version without explicit user request
- When updating CHANGELOG, ask user which version to use

## Testing Notes

- All tests are integration tests against real SAP systems (no mocks)
- Tests require `.env` with credentials and `test-config.yaml` with parameters
- Tests are idempotent: CREATE tests delete existing objects first; other tests create missing objects
- Only user-defined objects (Z_/Y_ prefix) can be modified in tests
- Tests run sequentially to avoid conflicts with shared SAP objects
- E2E tests focus on session/lock persistence and crash recovery

## Key Dependencies

- `@mcp-abap-adt/interfaces` - Core interface definitions
- `@mcp-abap-adt/logger` - Logging interface
- `fast-xml-parser` - XML parsing for ADT responses
