# @mcp-abap-adt/adt-clients

TypeScript clients for SAP ABAP Development Tools (ADT).

## Features

- ✅ **Client API** – simplified interface for common operations:
  - `AdtClient` – high-level CRUD API with automatic operation chains
  - `AdtRuntimeClient` – runtime operations (debugger, traces, memory, logs)
  - `AdtClientsWS` – realtime WebSocket facade for event-driven workflows
- ✅ **ABAP Unit test support** – run and manage ABAP Unit tests (class and CDS view tests)
- ✅ **Stateful session management** – maintains `sap-adt-connection-id` across operations
- ✅ **Lock registry** – persistent `.locks/active-locks.json` with CLI tools for recovery
- ✅ **TypeScript-first** – full type safety with comprehensive interfaces
- ✅ **Response headers are normalized** – ADT response headers can be non-string; normalize before parsing in contributors’ code
- ✅ **Public API is clients + supporting types** – internal builders and low-level utilities are not exported from the package root

## Responsibilities and Design Principles

### Core Development Principle

**Interface-Only Communication**: This package follows a fundamental development principle: **all interactions with external dependencies happen ONLY through interfaces**. The code knows **NOTHING beyond what is defined in the interfaces**.

This means:
- Does not know about concrete implementation classes from other packages
- Does not know about internal data structures or methods not defined in interfaces
- Does not make assumptions about implementation behavior beyond interface contracts
- Does not access properties or methods not explicitly defined in interfaces

This principle ensures:
- **Loose coupling**: Clients are decoupled from concrete implementations in other packages
- **Flexibility**: New implementations can be added without modifying clients
- **Testability**: Easy to mock dependencies for testing
- **Maintainability**: Changes to implementations don't affect clients

### Package Responsibilities

This package is responsible for:

1. **ADT operations**: Provides high-level and low-level client APIs for interacting with SAP ABAP Development Tools (ADT)
2. **Object management**: CRUD operations for ABAP objects (classes, interfaces, programs, etc.)
3. **Session management**: Maintains session state across operations using `sap-adt-connection-id`
4. **Lock management**: Handles object locking with persistent registry

#### What This Package Does

- **Provides ADT clients**: `AdtClient` and specialized clients for ADT operations
- **Manages locks**: Lock registry with persistent storage and CLI tools
- **Handles requests**: Makes HTTP requests to SAP ADT endpoints through connection interface
- **Manages state**: Maintains object state across chained operations

#### What This Package Does NOT Do

- **Does NOT handle authentication**: Authentication is handled by `@mcp-abap-adt/connection`
- **Does NOT manage connections**: Connection management is handled by `@mcp-abap-adt/connection`
- **Does NOT validate headers**: Header validation is handled by `@mcp-abap-adt/header-validator`
- **Does NOT store tokens**: Token storage is handled by `@mcp-abap-adt/auth-stores`
- **Does NOT orchestrate authentication**: Token lifecycle is handled by `@mcp-abap-adt/auth-broker`

### External Dependencies

This package interacts with external packages **ONLY through interfaces**:

- **`@mcp-abap-adt/connection`**: Uses `AbapConnection` interface for HTTP requests - does not know about concrete connection implementation
- **No direct dependencies on other packages**: All interactions happen through well-defined interfaces

## Installation

### As npm Package

```bash
# Install globally for CLI tools
npm install -g @mcp-abap-adt/adt-clients

# Or install in project
npm install @mcp-abap-adt/adt-clients
```

## Architecture

### Public API

1. **AdtClient** (High-level, recommended)
   - Simplified CRUD operations with automatic operation chains
   - Factory pattern: `client.getClass()`, `client.getProgram()`, etc.
   - Automatic error handling and resource cleanup
   - Utility functions via `client.getUtils()`
   - Example: `await client.getClass().create({...}, { activateOnCreate: true })`

2. **AdtRuntimeClient**
   - Runtime operations for debugging, traces, memory analysis, and logs
   - Example: `await runtimeClient.getDebugger(...)`

3. **AdtClientsWS**
   - Realtime request/event facade over `IWebSocketTransport`
   - Includes debugger-session facade: listen, attach, step, stack, variables
   - Example: `await wsClient.request('debugger.listen', { timeoutSeconds: 30 })`

## Supported Object Types

| Object Type | AdtClient |
|------------|-----------|
| Classes (CLAS) | ✅ |
| Behavior Implementations (CLAS) | ✅ |
| Behavior Definitions (BDEF) | ✅ |
| Interfaces (INTF) | ✅ |
| Programs (PROG) | ✅ |
| Function Groups (FUGR) | ✅ |
| Function Modules (FUGR/FF) | ✅ |
| Domains (DOMA) | ✅ |
| Data Elements (DTEL) | ✅ |
| Structures (TABL/DS) | ✅ |
| Tables (TABL/DT) | ✅ |
| Views (DDLS) | ✅ |
| Metadata Extensions (DDLX) | ✅ |
| Packages (DEVC) | ✅ |
| Transports (TRNS) | ✅ |

## Quick Start

### Using AdtClient (Recommended - High-Level CRUD API)

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({
  url: 'https://your-sap-system.example.com',
  client: '100',
  authType: 'basic',
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!
}, console);

const client = new AdtClient(connection, console);

// Simple CRUD operations with automatic operation chains
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
}, { activateOnCreate: true });

// Utility functions
const utils = client.getUtils();
await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });

// Where-used with parsed results (recommended)
const result = await utils.getWhereUsedList({
  object_name: 'ZCL_TEST',
  object_type: 'class',
  enableAllTypes: true  // Eclipse "select all" behavior
});
console.log(`Found ${result.totalReferences} references`);
for (const ref of result.references) {
  console.log(`${ref.name} (${ref.type}) in ${ref.packageName}`);
}

// Where-used with raw XML (legacy)
await utils.getWhereUsed({ object_name: 'ZCL_TEST', object_type: 'class' });
```

### Using AdtClientsWS (Realtime)

```typescript
import { AdtClientsWS } from '@mcp-abap-adt/adt-clients';
import type { IWebSocketTransport } from '@mcp-abap-adt/adt-clients';

const transport: IWebSocketTransport = createYourTransport();
const wsClient = new AdtClientsWS(transport, console, {
  requestTimeoutMs: 30000,
});

await wsClient.connect('wss://your-realtime-endpoint');

const debuggerSession = wsClient.getDebuggerSessionClient();
await debuggerSession.listen({ timeoutSeconds: 60 });
await debuggerSession.step({ action: 'step_over' });
```

**AdtUtils read type safety:**
`readObjectMetadata` and `readObjectSource` accept strict object type unions to prevent invalid inputs like `view:ZOBJ`.

```typescript
import type { AdtObjectType, AdtSourceObjectType } from '@mcp-abap-adt/adt-clients';

await utils.readObjectMetadata('DDLS/DF' satisfies AdtObjectType, 'ZOK_I_CDS_TEST');
await utils.readObjectSource('view' satisfies AdtSourceObjectType, 'ZOK_I_CDS_TEST');
```

**Benefits:**
- ✅ Simplified API - no manual lock/unlock management
- ✅ Automatic operation chains (validate → create → check → lock → update → unlock → activate)
- ✅ Consistent error handling and resource cleanup
- ✅ Separation of CRUD operations and utility functions
- ✅ Long polling support for object readiness

### Using Long Polling for Object Readiness

The `withLongPolling` parameter allows you to wait for objects to become available after create/update/activate operations, replacing fixed timeouts with server-driven waiting:

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

// Create a class
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
});

// Wait for object to be ready using long polling
// The server will hold the connection until the object is available
await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { withLongPolling: true }
);

// Now the object is guaranteed to be ready for subsequent operations
await client.getClass().update({
  className: 'ZCL_TEST'
}, { sourceCode: updatedCode });
```

**Benefits of Long Polling:**
- ✅ **No arbitrary timeouts** - waits for actual object readiness
- ✅ **Faster tests** - no unnecessary delays when object is ready quickly
- ✅ **More reliable** - server-driven waiting ensures object is actually available
- ✅ **Automatic in create/update** - `AdtObject` implementations use long polling internally

**Note:** Long polling is automatically used in `create()` and `update()` methods of all `AdtObject` implementations to ensure objects are ready before proceeding with subsequent operations.

### Creating Behavior Implementation Classes

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

await client.getBehaviorImplementation().create(
  {
    className: 'ZBP_OK_I_CDS_TEST',
    packageName: 'ZOK_TEST_PKG_01',
    behaviorDefinition: 'ZOK_I_CDS_TEST',
    description: 'Behavior Implementation for ZOK_I_CDS_TEST',
    transportRequest: 'E19K900001'
  },
  { activateOnCreate: true }
);
```

## Developer Tools

### ADT Discovery Script

The package includes a tool for generating documentation from the ADT discovery endpoint, which lists all available ADT API endpoints.

**Purpose:** Explore available ADT API endpoints and generate markdown documentation.

**Usage:**
```bash
# Generate discovery documentation (default output: docs/architecture/discovery.md)
npm run discovery:markdown

# Custom output file
npm run discovery:markdown -- --output custom-discovery.md

# Custom SAP system URL
npm run discovery:markdown -- --url https://your-system.com

# Custom .env file
npm run discovery:markdown -- --env /path/to/.env
```

**What it does:**
1. Connects to the SAP system using credentials from `.env` file
2. Fetches the discovery endpoint: `GET /sap/bc/adt/discovery` (via `AdtUtils.discovery()`)
3. Parses the XML response
4. Converts it to readable markdown with endpoint categories, HTTP methods, URLs, content types, and descriptions
5. Saves the pretty-printed discovery XML next to the markdown output

**Output:** 
- Default: `docs/architecture/discovery.md` and `docs/architecture/discovery.xml`
- Custom: Path specified via `--output` option, plus `discovery.xml` in the same directory

**Environment Variables:**
The script uses the same environment variables as the main package:
- `SAP_URL` - SAP system URL (required)
- `SAP_AUTH_TYPE` - Authentication type: `'basic'` or `'jwt'` (default: `'basic'`)
- `SAP_USERNAME` - Username for basic auth
- `SAP_PASSWORD` - Password for basic auth
- `SAP_JWT_TOKEN` - JWT token for JWT auth
- `SAP_CLIENT` - Client number (optional)

**When to use:**
- To explore available ADT API endpoints on your SAP system
- To generate up-to-date documentation for ADT API
- To understand the structure of ADT discovery responses
- To verify endpoint availability on a specific SAP system

See [Tools Documentation](tools/README.md) for complete details and options.

## API Reference

### AdtClient Overview

- Factory accessors for ADT objects: `client.getClass()`, `client.getProgram()`, `client.getView()`, `client.getTable()`, `client.getRequest()`, `client.getUtils()`, etc.
- Each accessor returns an `Adt*` object implementing `IAdtObject` operations.
- See `src/index.ts` for the full type exports and object configs.

### AdtObject Methods (with Long Polling Support)

All `AdtObject` implementations support the `withLongPolling` parameter for read operations:

```typescript
// Read with long polling - waits for object to be ready
await adtObject.read(config, 'active', { withLongPolling: true });

// Read metadata with long polling
await adtObject.readMetadata(config, { withLongPolling: true });

// Read metadata with explicit version
await adtObject.readMetadata(config, { version: 'active' });

// Read transport info with long polling
await adtObject.readTransport(config, { withLongPolling: true });
```

**When to use long polling:**
- After `create()` operations - wait for object to be available
- After `update()` operations - wait for changes to be persisted
- After `activate()` operations - wait for object to be available in active version
- In tests - replace fixed `setTimeout` delays with long polling for better reliability

Operation results are stored on the returned state (`createResult`, `updateResult`, `checkResult`, etc.):

```typescript
const createState = await client.getFunctionModule().create({
  functionGroupName: 'ZFGROUP',
  functionModuleName: 'ZFM_TEST',
  description: 'Test FM',
});

console.log(createState.createResult?.status);
```

### Accept Negotiation (Optional)

Some ADT endpoints return `406` when the `Accept` header does not match the system’s supported media types. The client can
optionally auto-correct `Accept` by retrying with supported values returned in the 406 response.

**Enable globally:**
```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection, console, {
  enableAcceptCorrection: true,
});
```

**Enable via environment:**
```bash
ADT_ACCEPT_CORRECTION=true npm test
```

**Override per read call:**
```typescript
await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { accept: 'text/plain' }
);

await client.getClass().readMetadata(
  { className: 'ZCL_TEST' },
  { accept: 'application/vnd.sap.adt.oo.classes.v4+xml', version: 'active' }
);

// Read source without version (initial post-create state)
await client.getClass().read({ className: 'ZCL_TEST' }, undefined);
```

Notes:
- Disabled by default.
- Correction retries once and caches the supported `Accept` per endpoint.

### Specialized Clients

- **ManagementClient**: batch activation + check operations
- **LockClient**: explicit lock/unlock with `.locks` registry integration
- **ValidationClient**: name validation mirroring ADT validation endpoint

Refer to the TypeScript typings (`src/index.ts`) for the full API surface.

## Type System

### Centralized Type Definitions

All type definitions are centralized in module-specific `types.ts` files:

```typescript
// Import types from module exports
import type {
  IClassConfig,
  IClassState,
  IProgramConfig
} from '@mcp-abap-adt/adt-clients';
```

### Naming Conventions

The package uses **dual naming conventions** to distinguish API layers:

#### Low-Level Parameters (snake_case)

Used by internal ADT API functions.

#### AdtObject Configuration (camelCase)

Used by `AdtClient` and `Adt*` object configs:

```typescript
interface IClassConfig {
  className: string;
  packageName?: string;
  transportRequest?: string;
  description: string;
  sourceCode?: string;
}
```

This dual convention:
- Makes low-level/high-level distinction clear
- Matches SAP ADT XML parameter naming (`class_name` in ADT requests)
- Provides familiar camelCase for JavaScript/TypeScript consumers
- Enables proper type checking at each layer

See [Architecture Documentation](docs/architecture/ARCHITECTURE.md#type-system-organization) for details.

## Migration Guide

### From Timeouts to Long Polling

**Migration from fixed timeouts to long polling:**

The package now uses long polling (`?withLongPolling=true`) instead of fixed timeouts for waiting object readiness. This provides better reliability and faster execution.

```typescript
// ❌ Before - Using fixed timeouts
await client.getClass().create({ className: 'ZCL_TEST', ... });
await new Promise(resolve => setTimeout(resolve, 2000)); // Fixed delay
await client.getClass().update({ className: 'ZCL_TEST' }, { sourceCode });

// ✅ After - Using long polling
await client.getClass().create({ className: 'ZCL_TEST', ... });
// Long polling is automatically used in create/update methods
await client.getClass().update({ className: 'ZCL_TEST' }, { sourceCode });

// Or explicitly use long polling in read operations
await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { withLongPolling: true }
);
```

**Benefits:**
- No arbitrary delays - waits for actual object readiness
- Faster execution when objects are ready quickly
- More reliable - server-driven waiting ensures object is available
- Automatic in `create()` and `update()` methods

### Builderless API

- `CrudClient`, `ReadOnlyClient`, and Builder classes are removed in the builderless API.
- Use `AdtClient` and the `Adt*` objects (`client.getClass()`, `client.getView()`, etc.).

## Documentation

- **[Operation Delays](docs/OPERATION_DELAYS.md)** – configurable delays for SAP operations in tests (sequential execution, timing issues)
- **[Architecture](docs/architecture/ARCHITECTURE.md)** – package structure and design decisions
- **[Test Configuration Schema](docs/TEST_CONFIG_SCHEMA.md)** – YAML test configuration reference

## Logging and Debugging

The library uses a **5-tier granular debug flag system** for different code layers:

### Debug Environment Variables

```bash
# Connection package logs (HTTP, sessions, CSRF tokens)
DEBUG_CONNECTORS=true npm test

# Core library logs
DEBUG_ADT_LIBS=true npm test

# Integration test execution logs
DEBUG_ADT_TESTS=true npm test

# E2E integration test logs
DEBUG_ADT_E2E_TESTS=true npm test

# Test helper function logs
DEBUG_ADT_HELPER_TESTS=true npm test

# Enable ALL ADT scopes at once
DEBUG_ADT_TESTS=true npm test
```

### Logger Interface

All clients accept a unified `ILogger` interface:

```typescript
import type { ILogger } from '@mcp-abap-adt/adt-clients';
import { AdtClient } from '@mcp-abap-adt/adt-clients';

// Custom logger example
const logger: ILogger = {
  debug: (msg, ...args) => console.debug(msg, ...args),
  info: (msg, ...args) => console.info(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

const client = new AdtClient(connection, logger);
```

**Note:** All logger methods are optional. Lock handles are always logged in full (not truncated).

See [docs/DEBUG.md](docs/DEBUG.md) for detailed debugging guide.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for package-specific release notes.
Latest (0.3.14): added `getWhereUsedList()` for parsed where-used results.

## Tests

Integration tests use YAML configuration (`src/__tests__/helpers/test-config.yaml`) and the `BaseTester` pattern.  
Some ADT endpoints are system-specific; 406 is treated as an Accept/header support issue and can be explicitly allowed via `test_settings.allow_406` or per-test `params.allow_406` (e.g., objectstructure/nodestructure).

## License

MIT

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>
