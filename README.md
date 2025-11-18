# @mcp-abap-adt/adt-clients

ADT (ABAP Development Tools) clients for SAP ABAP systems - Read-only, CRUD, and Management operations.

## Features

- ✅ **Read-Only Operations** - Query ABAP objects without modifications
- ✅ **CRUD Operations** - Create, Read, Update, Delete ABAP objects
- ✅ **Management Operations** - Lock, unlock, activate, check objects
- ✅ **Session Management** - Persistent HTTP sessions with cookies and CSRF tokens
- ✅ **Lock Tracking** - Persist lock handles for recovery after crashes
- ✅ **CLI Tools** - Manage sessions and locks from command line

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
import { createAbapConnection, FileSessionStorage } from '@mcp-abap-adt/connection';
import { createClass, getClass, updateClassSource } from '@mcp-abap-adt/adt-clients';

// Create connection with session persistence
const connection = createAbapConnection({
  url: 'https://your-sap-system.com:443',
  client: '100',
  authType: 'basic',
  username: 'your-username',
  password: 'your-password'
}, console);

// Enable stateful session
const sessionStorage = new FileSessionStorage();
await connection.enableStatefulSession('my-session', sessionStorage);

// Create class
await createClass(connection, {
  class_name: 'ZCL_MY_CLASS',
  package_name: 'ZPACKAGE',
  description: 'My test class',
  source_code: `CLASS zcl_my_class DEFINITION PUBLIC.
  PUBLIC SECTION.
    METHODS: hello.
ENDCLASS.

CLASS zcl_my_class IMPLEMENTATION.
  METHOD hello.
    WRITE: 'Hello World!'.
  ENDMETHOD.
ENDCLASS.`
});

// Read class
const result = await getClass(connection, 'ZCL_MY_CLASS');
console.log(result.data); // Source code

// Update class
await updateClassSource(connection, {
  class_name: 'ZCL_MY_CLASS',
  source_code: updatedCode,
  activate: true
});
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

## Documentation

- [Lock State Management](LOCK_STATE_MANAGEMENT.md) - Persistent lock handles
- [Session State Management](SESSION_STATE_MANAGEMENT.md) - HTTP session persistence

## API Reference

### Class Operations

```typescript
import {
  createClass,
  getClass,
  updateClassSource,
  deleteObject,
  checkClass,
  validateClassSource,
  activateClass,
  runClass
} from '@mcp-abap-adt/adt-clients';
```

### Function Module Operations

```typescript
import {
  createFunctionGroup,
  createFunctionModule,
  getFunction,
  updateFunctionModuleSource,
  checkFunctionModule,
  validateFunctionModuleSource,
  activateFunctionModule
} from '@mcp-abap-adt/adt-clients';
```

### Other Object Types

Similar patterns for:
- Interfaces
- Programs  
- Domains
- Data Elements
- CDS Views
- Tables/Structures
- Packages
- Transports

## Development & Testing

For test strategy, development roadmap, and contribution guidelines, see:
- **[docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md)** - Test strategy and development focus
- **[docs/reference/ARCHITECTURE.md](docs/reference/ARCHITECTURE.md)** - Package architecture

## License

MIT

## Author

Oleksii Kyslytsia <oleksij.kyslytsja@gmail.com>
