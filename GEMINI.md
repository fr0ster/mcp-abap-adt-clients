# GEMINI.md

## Project Overview

`@mcp-abap-adt/adt-clients` is a TypeScript library that provides clients for interacting with SAP ABAP Development Tools (ADT). It is designed to be part of the Model Context Protocol (MCP) ecosystem.

**Key Features:**
*   **AdtClient:** High-level CRUD API for ABAP objects (Classes, Programs, Function Modules, etc.) with automatic operation chains.
*   **AdtRuntimeClient:** Runtime operations (Debugger, Traces, Memory, Logs).
*   **Stateful Sessions:** Maintains `sap-adt-connection-id` across operations.
*   **Lock Management:** Persistent lock registry.
*   **Interface-First:** Strictly decoupled from external dependencies via interfaces.

## Building and Running

### Installation
```bash
npm install
```

### Build
To clean, check code quality, and compile:
```bash
npm run build
```
For a fast build (compile only):
```bash
npm run build:fast
```

### Testing
Run all tests using Jest:
```bash
npm test
```
Run tests sequentially (useful for avoiding race conditions in integration tests):
```bash
npm run test:sequential
```
Run specific long-polling tests:
```bash
npm run test:long-polling-read
```
Type-check tests without running them:
```bash
npm run test:check
```

### Code Quality
Lint the codebase:
```bash
npm run lint
```
Format the codebase:
```bash
npm run format
```

### Tools
Generate ADT discovery documentation:
```bash
npm run discovery:markdown
```
Generate ADT object entities list:
```bash
npm run adt:entities
```

## Architecture & Conventions

### Directory Structure
*   `src/clients/`: Main entry points (`AdtClient`, `AdtRuntimeClient`).
*   `src/core/`: Implementations for specific ABAP object types (e.g., `class`, `program`, `table`).
*   `src/runtime/`: Runtime operation implementations.
*   `src/utils/`: Shared utilities and helpers.
*   `src/__tests__/`: Integration and unit tests.
*   `docs/`: Comprehensive documentation for architecture, usage, and debugging.

### Key Principles
1.  **Interface-Only Communication:** The package interacts with dependencies (like connection handling) *only* through interfaces to ensure loose coupling.
2.  **Factory Pattern:** `AdtClient` uses factory methods (e.g., `client.getClass()`) to return specialized handlers for different object types.
3.  **Long Polling:** Prefer long polling (`withLongPolling: true`) over fixed timeouts for operations that require waiting for server-side readiness.
4.  **Dual Naming:**
    *   **snake_case:** Used for low-level ADT API parameters (matching SAP XML).
    *   **camelCase:** Used for high-level object configuration in TypeScript.

### Debugging
The project uses a granular debug flag system. Set environment variables to enable logs:
*   `DEBUG_ADT_LIBS=true`: Core library logs.
*   `DEBUG_ADT_TESTS=true`: Integration test logs.
*   `DEBUG_CONNECTORS=true`: Connection package logs.

See `docs/usage/DEBUG.md` for more details.
