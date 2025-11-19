# @mcp-abap-adt/adt-clients

ADT (ABAP Development Tools) clients for SAP ABAP systems with a **Builder-first API**.  
Low-level helpers stay internal; consumers interact via Builders and high-level clients (Management, Lock, Validation).

## Features

- ✅ **Builder-first workflow** – every supported object type exposes a fluent Builder (`ClassBuilder`, `TableBuilder`, …) that wraps validate/create/lock/update/activate in one chain.
- ✅ **High-level clients** – `ManagementClient`, `LockClient`, `ValidationClient` cover cross-object tasks (activation, ad-hoc locking, name validation) without touching internal modules.
- ✅ **Stateful session propagation** – builders and clients keep the same `sap-adt-connection-id` across lock/update/unlock; session state can be exported/imported via the connection package.
- ✅ **Lock registry + CLI** – persistent `.locks/active-locks.json` plus `adt-manage-locks` / `adt-unlock-objects` scripts to recover from crashes.
- ✅ **Test-friendly logging** – `DEBUG_TESTS=true` for per-step output, `LOG_LOCKS=false` to silence `[LOCK] ...` lines.

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

## Supported Object Types

- **Classes** (CLAS/OC) - Full CRUD + run (if_oo_adt_classrun)
- **Interfaces** (INTF/OI) - Full CRUD
- **Programs** (PROG/P) - Full CRUD
- **Function Groups** (FUGR/F) - Full CRUD
- **Function Modules** (FUGR/FF) - Full CRUD
- **Domains** (DOMA/DD) - Full CRUD
- **Data Elements** (DTEL/DE) - Full CRUD
- **CDS Views** (DDLS/DL) - Full CRUD
- **Tables** (TABL/DT) - Read operations
- **Structures** (TABL/DS) - Read operations
- **Packages** (DEVC/K) - Create, read
- **Transports** (TRNS/R3TR) - Create

## Quick Start

```typescript
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { ClassBuilder, LockClient, ManagementClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({
  url: 'https://your-sap-system.example.com',
  client: '100',
  authType: 'basic',
  username: process.env.SAP_USERNAME!,
  password: process.env.SAP_PASSWORD!
}, console);

// Full builder workflow
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
  .then(b => b.check('inactive'))
  .then(b => b.lock())
  .then(b => {
    b.setCode(b.getState().sourceCode!.replace('builder', 'builder v2'));
    return b.update();
  })
  .then(b => b.check('inactive'))
  .then(b => b.unlock())
  .then(b => b.activate())
  .then(b => b.check('active'));

// Ad-hoc management helpers
const lockClient = new LockClient(connection);
const mgmtClient = new ManagementClient(connection);

const { lockHandle, sessionId } = await lockClient.lock({
  objectType: 'class',
  objectName: 'ZCL_MY_CLASS'
});

await mgmtClient.activateObjectsGroup([{ name: 'ZCL_MY_CLASS', uri: '/sap/bc/adt/oo/classes/zcl_my_class' }]);

await lockClient.unlock({
  objectType: 'class',
  objectName: 'ZCL_MY_CLASS',
  lockHandle,
  sessionId
});
```

> ℹ️ Need to persist the `sessionId` / cookies between processes? See [doc/STATEFUL_SESSION_GUIDE.md](../../doc/STATEFUL_SESSION_GUIDE.md) and the `@mcp-abap-adt/connection` README for details.

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

## Builders & Clients

- **Builders**: classes, interfaces, programs, domains, data elements, tables, structures, views, packages, transports, function groups, function modules.  
  Each builder exposes `.validate()`, `.create()`, `.lock()`, `.update()`, `.activate()`, `.check()`, `.read()`, `.forceUnlock()`.
- **ManagementClient**: batch activation + check operations.
- **LockClient**: explicit lock/unlock helpers that integrate with the `.locks` registry (used by tests and CLI tools).
- **ValidationClient**: name validation helper mirroring ADT validation endpoint.

Refer to the TypeScript typings (`src/index.ts`) or the generated docs in `docs/reference` for the full surface area.

## Documentation

- [Lock State Management](docs/archive/LOCK_STATE_MANAGEMENT.md) – background on `.locks`
- [Session State Management](docs/archive/SESSION_STATE_MANAGEMENT.md) – restoring HTTP sessions
- [Stateful Session Guide (Builders)](docs/STATEFUL_SESSION_GUIDE.md) – how Builders, `LockClient`, and tests manage `sessionId`, `lockHandle`, and the lock registry
- [Stateful Session Guide (Server)](../../doc/STATEFUL_SESSION_GUIDE.md) – handler-level orchestration and workflows shared with the MCP server
- [Stateful Session Guide (Connection)](../connection/docs/STATEFUL_SESSION_GUIDE.md) – HTTP session, cookies, and CSRF token persistence

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for package-specific release notes.

## Development & Testing

For test strategy, development roadmap, and contribution guidelines, see:
- **[docs/BUILDER_TEST_PATTERN.md](docs/BUILDER_TEST_PATTERN.md)** - Builder test pattern and structure
- **[docs/TEST_CONFIG_SCHEMA.md](docs/TEST_CONFIG_SCHEMA.md)** - YAML test configuration schema
- **[docs/reference/ARCHITECTURE.md](docs/reference/ARCHITECTURE.md)** - Package architecture

### Logging levels

- `DEBUG_TESTS=true` – verbose step-by-step logging (existing flag).
- `LOG_LOCKS=false` – disable `[LOCK] ...` lines that show session/handle every time a test locks an object (enabled by default).

## License

MIT

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>
