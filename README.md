# @mcp-abap-adt/adt-clients

TypeScript clients for SAP ABAP Development Tools (ADT) with a **Builder and Client API architecture**.

## Features

- ✅ **Builder API** – fluent interface for complex workflows with method chaining (`ClassBuilder`, `BehaviorImplementationBuilder`, `ProgramBuilder`, `UnitTestBuilder`, etc.)
- ✅ **Client API** – simplified interface for common operations:
  - `ReadOnlyClient` – read operations for all object types
  - `CrudClient` – full CRUD operations with method chaining and state management
- ✅ **ABAP Unit test support** – `UnitTestBuilder` for running and managing ABAP Unit tests (class and CDS view tests)
- ✅ **Stateful session management** – maintains `sap-adt-connection-id` across operations
- ✅ **Lock registry** – persistent `.locks/active-locks.json` with CLI tools for recovery
- ✅ **TypeScript-first** – full type safety with comprehensive interfaces

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

1. **ADT operations**: Provides high-level and low-level APIs for interacting with SAP ABAP Development Tools (ADT)
2. **Object management**: CRUD operations for ABAP objects (classes, interfaces, programs, etc.)
3. **Builder pattern**: Fluent interface for complex workflows with method chaining
4. **Session management**: Maintains session state across operations using `sap-adt-connection-id`
5. **Lock management**: Handles object locking with persistent registry

#### What This Package Does

- **Provides ADT clients**: `ReadOnlyClient`, `CrudClient`, and specialized clients for ADT operations
- **Implements builders**: Builder classes for different ABAP object types with method chaining
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

### CLI Tools

After global installation, you get 5 CLI commands:

- `adt-lock-object` - Lock an object and save session
- `adt-unlock-object` - Unlock using saved session
- `adt-manage-locks` - View/manage lock registry
- `adt-manage-sessions` - View/manage session files
- `adt-unlock-objects` - Cleanup test objects

See [CLI Tools documentation](./bin/README.md) for details.

## Architecture

### Three-Layer API

1. **Builders** (Low-level, flexible)
   - Direct access to all ADT operations
   - Method chaining with Promise support
   - Fine-grained control over workflow
   - Example: `ProgramBuilder`, `ClassBuilder`, `InterfaceBuilder`

2. **Clients** (High-level, convenient)
   - **ReadOnlyClient** – simple read operations
   - **CrudClient** – unified CRUD operations with chaining
   - State management with getters
   - Example: `client.createProgram(...).lockProgram(...).updateProgram(...)`

3. **Specialized Clients**
   - `ManagementClient` – activation, syntax checking
   - `LockClient` – lock/unlock with registry
   - `ValidationClient` – object name validation

## Supported Object Types

| Object Type | Builder | CrudClient | ReadOnlyClient |
|------------|---------|------------|----------------|
| Classes (CLAS) | ✅ | ✅ | ✅ |
| Behavior Implementations (CLAS) | ✅ | ✅ | ✅ |
| Behavior Definitions (BDEF) | ✅ | ✅ | ✅ |
| Interfaces (INTF) | ✅ | ✅ | ✅ |
| Programs (PROG) | ✅ | ✅ | ✅ |
| Function Groups (FUGR) | ✅ | ✅ | ✅ |
| Function Modules (FUGR/FF) | ✅ | ✅ | ✅ |
| Domains (DOMA) | ✅ | ✅ | ✅ |
| Data Elements (DTEL) | ✅ | ✅ | ✅ |
| Structures (TABL/DS) | ✅ | ✅ | ✅ |
| Tables (TABL/DT) | ✅ | ✅ | ✅ |
| Views (DDLS) | ✅ | ✅ | ✅ |
| Metadata Extensions (DDLX) | ✅ | ✅ | ✅ |
| Packages (DEVC) | ✅ | ✅ | ✅ |
| Transports (TRNS) | ✅ | ✅ | ✅ |

## Quick Start

### Using CrudClient (Recommended for most cases)

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { CrudClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({
  url: 'https://your-sap-system.example.com',
  client: '100',
  authType: 'basic',
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!
}, console);

const client = new CrudClient(connection);

// Method chaining with state management
await client
  .createInterface('ZIF_TEST', 'Test Interface', 'ZPACKAGE', 'TREQ123')
  .lockInterface('ZIF_TEST')
  .updateInterface('ZIF_TEST', sourceCode)
  .unlockInterface('ZIF_TEST')
  .activateInterface('ZIF_TEST');

// Access results via getters
const createResult = client.getCreateResult();
const lockHandle = client.getLockHandle();
const activateResult = client.getActivateResult();
```

### Using ReadOnlyClient

```typescript
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';

const client = new ReadOnlyClient(connection);

// Simple read operations
const programSource = await client.readProgram('ZTEST_PROGRAM');
const classDefinition = await client.readClass('ZCL_TEST_CLASS');
const interfaceCode = await client.readInterface('ZIF_TEST_INTERFACE');
```

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

### Using Builders (Advanced workflows)

```typescript
import { ClassBuilder } from '@mcp-abap-adt/adt-clients/core';

const builder = new ClassBuilder(connection, console, {
  className: 'ZCL_MY_CLASS',
  packageName: 'ZADT_BLD_PKG01',
  description: 'Demo builder class',
  transportRequest: 'E19K900001'
});

await builder
  .setCode(`CLASS zcl_my_class DEFINITION PUBLIC.
  PUBLIC SECTION.
    METHODS: hello.
ENDCLASS.

CLASS zcl_my_class IMPLEMENTATION.
  METHOD hello.
    WRITE: 'Hello from builder'.
  ENDMETHOD.
ENDCLASS.`)
  .validate()
  .then(b => b.create())
  .then(b => b.lock())
  .then(b => b.update())
  .then(b => b.unlock())
  .then(b => b.activate());
```

### Creating Behavior Implementation Classes

```typescript
import { CrudClient } from '@mcp-abap-adt/adt-clients';

const client = new CrudClient(connection);

// Full workflow: create, lock, update main source, update implementations, unlock, activate
await client.createBehaviorImplementation({
  className: 'ZBP_OK_I_CDS_TEST',
  packageName: 'ZOK_TEST_PKG_01',
  behaviorDefinition: 'ZOK_I_CDS_TEST',
  description: 'Behavior Implementation for ZOK_I_CDS_TEST',
  transportRequest: 'E19K900001'
});

// Or use builder directly for more control
const builder = client.getBehaviorImplementationBuilderInstance({
  className: 'ZBP_OK_I_CDS_TEST',
  behaviorDefinition: 'ZOK_I_CDS_TEST'
});

await builder
  .createBehaviorImplementation()  // Full workflow
  .then(b => b.read())              // Read class source
  .then(b => b.lock())              // Lock for modification
  .then(b => b.updateMainSource())  // Update main source
  .then(b => b.updateImplementations()) // Update implementations include
  .then(b => b.unlock())            // Unlock
  .then(b => b.activate());        // Activate
```

## CLI Tools

After installation, the following commands are available:

### Manage Locks

```bash
# List all active locks
adt-manage-locks list

# Clean up stale locks
adt-manage-locks cleanup

# Unlock specific object
adt-manage-locks unlock class ZCL_TEST
```

### Manage Sessions

```bash
# List all sessions
adt-manage-sessions list

# Show session details
adt-manage-sessions info <sessionId>

# Clean up stale sessions
adt-manage-sessions cleanup
```

See [bin/README.md](bin/README.md) for details.

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
2. Fetches the discovery endpoint: `GET /sap/bc/adt/discovery`
3. Parses the XML response
4. Converts it to readable markdown with endpoint categories, HTTP methods, URLs, content types, and descriptions

**Output:** 
- Default: `docs/architecture/discovery.md`
- Custom: Path specified via `--output` option

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

### CrudClient Methods

**Create Operations:**
- `createProgram(name, description, package, transport?)` → `Promise<this>`
- `createClass(name, description, package, transport?)` → `Promise<this>`
- `createBehaviorImplementation(config)` → `Promise<this>` – creates behavior implementation class with full workflow (create, lock, update main source, update implementations, unlock, activate)
- `createInterface(name, description, package, transport?)` → `Promise<this>`
- And more for all object types...

**Lock Operations:**
- `lockProgram(name)` → `Promise<this>` (stores lockHandle in state)
- `unlockProgram(name, lockHandle?)` → `Promise<this>`
- Similar for all object types...

**Update Operations:**
- `updateProgram(name, sourceCode, lockHandle?)` → `Promise<this>`
- `updateClass(name, sourceCode, lockHandle?)` → `Promise<this>`
- And more...

**Activation:**
- `activateProgram(name)` → `Promise<this>`
- `activateClass(name)` → `Promise<this>`
- And more...

**State Getters:**
- `getCreateResult()` → `AxiosResponse | undefined`
- `getLockHandle()` → `string | undefined`
- `getUnlockResult()` → `AxiosResponse | undefined`
- `getUpdateResult()` → `AxiosResponse | undefined`
- `getActivateResult()` → `AxiosResponse | undefined`
- `getCheckResult()` → `AxiosResponse | undefined`
- `getValidationResult()` → `any | undefined`

### ReadOnlyClient Methods

- `readProgram(name)` → `Promise<AxiosResponse>`
- `readClass(name)` → `Promise<AxiosResponse>`
- `readInterface(name)` → `Promise<AxiosResponse>`
- `readDataElement(name)` → `Promise<AxiosResponse>`
- `readDomain(name)` → `Promise<AxiosResponse>`
- `readStructure(name)` → `Promise<AxiosResponse>`
- `readTable(name)` → `Promise<AxiosResponse>`
- `readView(name)` → `Promise<AxiosResponse>`
- `readFunctionGroup(name)` → `Promise<AxiosResponse>`
- `readFunctionModule(name, functionGroup)` → `Promise<AxiosResponse>`
- `readPackage(name)` → `Promise<AxiosResponse>`
- `readTransport(transportRequest)` → `Promise<AxiosResponse>`

### AdtObject Methods (with Long Polling Support)

All `AdtObject` implementations support the `withLongPolling` parameter for read operations:

```typescript
// Read with long polling - waits for object to be ready
await adtObject.read(config, 'active', { withLongPolling: true });

// Read metadata with long polling
await adtObject.readMetadata(config, { withLongPolling: true });

// Read transport info with long polling
await adtObject.readTransport(config, { withLongPolling: true });
```

**When to use long polling:**
- After `create()` operations - wait for object to be available
- After `update()` operations - wait for changes to be persisted
- After `activate()` operations - wait for object to be available in active version
- In tests - replace fixed `setTimeout` delays with long polling for better reliability

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
import { 
  CreateClassParams,      // Low-level function parameters
  ClassBuilderConfig,     // Builder configuration
  ClassBuilderState,      // Builder state
  ClassBuilder            // Builder class
} from '@mcp-abap-adt/adt-clients';
```

### Naming Conventions

The package uses **dual naming conventions** to distinguish API layers:

#### Low-Level Parameters (snake_case)

Used by internal ADT API functions:

```typescript
interface CreateClassParams {
  class_name: string;
  package_name: string;
  transport_request?: string;
  description?: string;
}
```

#### Builder Configuration (camelCase)

Used by Builder classes providing fluent API:

```typescript
interface ClassBuilderConfig {
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

### From v0.1.0 to v0.2.0

**Breaking Changes:**

1. **Low-level functions removed from exports**
   ```typescript
   // ❌ Before
   import { createProgram } from '@mcp-abap-adt/adt-clients/core/program';
   
   // ✅ After - Use Builder
   import { ProgramBuilder } from '@mcp-abap-adt/adt-clients/core';
   
   // ✅ Or use CrudClient
   import { CrudClient } from '@mcp-abap-adt/adt-clients';
   const client = new CrudClient(connection);
   await client.createProgram(...);
   ```

2. **Client classes removed**
   ```typescript
   // ❌ Before
   import { InterfaceClient } from '@mcp-abap-adt/adt-clients';
   
   // ✅ After
   import { CrudClient } from '@mcp-abap-adt/adt-clients';
   const client = new CrudClient(connection);
   ```

**Non-breaking:**
- Builders continue to work as before
- Specialized clients (ManagementClient, LockClient, ValidationClient) unchanged

## Documentation

- **[Stateful Session Guide](docs/STATEFUL_SESSION_GUIDE.md)** – how Builders and clients manage `sessionId`, `lockHandle`, and the lock registry
- **[Operation Delays](docs/OPERATION_DELAYS.md)** – configurable delays for SAP operations in tests (sequential execution, timing issues)
- **[Architecture](docs/reference/ARCHITECTURE.md)** – package structure and design decisions
- **[Builder Test Pattern](docs/BUILDER_TEST_PATTERN.md)** – test structure and patterns for contributors
- **[Test Configuration Schema](docs/TEST_CONFIG_SCHEMA.md)** – YAML test configuration reference

## Logging and Debugging

The library uses a **5-tier granular debug flag system** for different code layers:

### Debug Environment Variables

```bash
# Connection package logs (HTTP, sessions, CSRF tokens)
DEBUG_CONNECTORS=true npm test

# Builder implementation and core library logs
DEBUG_ADT_LIBS=true npm test

# Builder test execution logs
DEBUG_ADT_TESTS=true npm test

# E2E integration test logs
DEBUG_ADT_E2E_TESTS=true npm test

# Test helper function logs
DEBUG_ADT_HELPER_TESTS=true npm test

# Enable ALL ADT scopes at once
DEBUG_ADT_TESTS=true npm test
```

### Logger Interface

All Builders use a unified `IAdtLogger` interface:

```typescript
import { IAdtLogger, emptyLogger } from '@mcp-abap-adt/adt-clients';

// Custom logger example
const logger: IAdtLogger = {
  debug: (msg, ...args) => console.debug(msg, ...args),
  info: (msg, ...args) => console.info(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

// Use with Builders
const builder = new ClassBuilder(connection, config, logger);

// Or use emptyLogger for silent operation
const silentBuilder = new ClassBuilder(connection, config, emptyLogger);
```

**Note:** All logger methods are optional. Lock handles are always logged in full (not truncated).

See [docs/DEBUG.md](docs/DEBUG.md) for detailed debugging guide.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for package-specific release notes.

## License

MIT

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>
