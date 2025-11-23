# Debug Logging

## Environment Variables

The library uses a **granular 5-tier debug flag system** for different code layers:

### 1. Connection Package Logs
```bash
DEBUG_CONNECTORS=true npm test
```
**Scope:** `@mcp-abap-adt/connection` package
**Output:** CSRF tokens, cookies, HTTP requests, session management

### 2. ADT Library Code Logs
```bash
DEBUG_ADT_LIBS=true npm test
```
**Scope:** Builders and core library functions (internal implementation)
**Output:** Builder operations, lock/unlock operations, validation logic, ABAP object manipulation

### 3. Builder Test Logs
```bash
DEBUG_ADT_TESTS=true npm test
```
**Scope:** Builder integration tests (test execution)
**Output:** Test steps, assertions, Builder test workflow

### 4. E2E Test Logs
```bash
DEBUG_ADT_E2E_TESTS=true npm test
```
**Scope:** End-to-end integration tests
**Output:** E2E test execution, complex workflows

### 5. Test Helper Logs
```bash
DEBUG_ADT_HELPER_TESTS=true npm test
```
**Scope:** Test helper functions and utilities
**Output:** Helper function execution, test setup/teardown

### Enable All ADT Scopes
```bash
DEBUG_ADT_TESTS=true npm test
```
When set to `true`, enables **all ADT debug scopes** (libs, tests, e2e, helpers) for backward compatibility.

## Common Combinations

```bash
# Only connection logs (HTTP, sessions)
DEBUG_CONNECTORS=true npm test

# Only library implementation logs (Builders)
DEBUG_ADT_LIBS=true npm test

# Only Builder test execution logs
DEBUG_ADT_TESTS=true npm test

# Connection + Builder tests
DEBUG_CONNECTORS=true DEBUG_ADT_TESTS=true npm test

# All ADT logs (libs + tests + e2e + helpers)
DEBUG_ADT_TESTS=true npm test

# Absolutely everything (connection + all ADT)
DEBUG_CONNECTORS=true DEBUG_ADT_TESTS=true npm test
```

## Recommendations

- **Debug Builder implementation**: `DEBUG_ADT_LIBS=true npm test`
- **Debug Builder tests**: `DEBUG_ADT_TESTS=true npm test`
- **Debug connection problems**: `DEBUG_CONNECTORS=true npm test`
- **Debug E2E tests**: `DEBUG_ADT_E2E_TESTS=true npm test`
- **Full debugging**: `DEBUG_CONNECTORS=true DEBUG_ADT_TESTS=true npm test`

## Usage in Code

### For Builder Tests

```typescript
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';

// Connection logs (from @mcp-abap-adt/connection package)
const connectionLogger = createConnectionLogger(); // Uses DEBUG_CONNECTORS

// Builder library logs (Builder implementation code)
const builderLogger = createBuilderLogger(); // Uses DEBUG_ADT_LIBS

// Test execution logs (Builder test code)
const testsLogger = createTestsLogger(); // Uses DEBUG_ADT_TESTS
```

### For E2E Tests

```typescript
import { createConnectionLogger, createBuilderLogger, createE2ETestsLogger } from '../../helpers/testLogger';

// Connection logs
const connectionLogger = createConnectionLogger(); // Uses DEBUG_CONNECTORS

// Builder library logs
const builderLogger = createBuilderLogger(); // Uses DEBUG_ADT_LIBS

// E2E test execution logs
const e2eLogger = createE2ETestsLogger(); // Uses DEBUG_ADT_E2E_TESTS
```

### For Test Helpers

```typescript
const helperLogger = createTestLogger('helpers'); // Uses DEBUG_ADT_HELPER_TESTS
```

## Logger Interface

All Builders use the unified `IAdtLogger` interface:

```typescript
interface IAdtLogger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}
```

All logger methods are **optional**, allowing for silent operation when logging is disabled.
