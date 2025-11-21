# @mcp-abap-adt/adt-clients

TypeScript clients for SAP ABAP Development Tools (ADT) with a **Builder and Client API architecture**.

## Features

- ✅ **Builder API** – fluent interface for complex workflows with method chaining (`ClassBuilder`, `ProgramBuilder`, etc.)
- ✅ **Client API** – simplified interface for common operations:
  - `ReadOnlyClient` – read operations for all object types
  - `CrudClient` – full CRUD operations with method chaining and state management
- ✅ **Stateful session management** – maintains `sap-adt-connection-id` across operations
- ✅ **Lock registry** – persistent `.locks/active-locks.json` with CLI tools for recovery
- ✅ **TypeScript-first** – full type safety with comprehensive interfaces

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
| Interfaces (INTF) | ✅ | ✅ | ✅ |
| Programs (PROG) | ✅ | ✅ | ✅ |
| Function Groups (FUGR) | ✅ | ✅ | ✅ |
| Function Modules (FUGR/FF) | ✅ | ✅ | ✅ |
| Domains (DOMA) | ✅ | ✅ | ✅ |
| Data Elements (DTEL) | ✅ | ✅ | ✅ |
| Structures (TABL/DS) | ✅ | ✅ | ✅ |
| Tables (TABL/DT) | ✅ | ✅ | ✅ |
| Views (DDLS) | ✅ | ✅ | ✅ |
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

## API Reference

### CrudClient Methods

**Create Operations:**
- `createProgram(name, description, package, transport?)` → `Promise<this>`
- `createClass(name, description, package, transport?)` → `Promise<this>`
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

### Specialized Clients

- **ManagementClient**: batch activation + check operations
- **LockClient**: explicit lock/unlock with `.locks` registry integration
- **ValidationClient**: name validation mirroring ADT validation endpoint

Refer to the TypeScript typings (`src/index.ts`) for the full API surface.

## Migration Guide

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
- **[Architecture](docs/reference/ARCHITECTURE.md)** – package structure and design decisions
- **[Builder Test Pattern](docs/BUILDER_TEST_PATTERN.md)** – test structure and patterns for contributors
- **[Test Configuration Schema](docs/TEST_CONFIG_SCHEMA.md)** – YAML test configuration reference

## Logging

- `DEBUG_TESTS=true` – verbose step-by-step logging for tests
- `LOG_LOCKS=false` – disable `[LOCK] ...` lines (enabled by default)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for package-specific release notes.

## License

MIT

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>
