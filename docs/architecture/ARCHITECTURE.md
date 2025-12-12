# ADT Clients Architecture

## Overview

Separation of ADT endpoint functionality into three classes to enable different access levels and reduce context for LLM.

## Package Structure `@mcp-abap-adt/adt-clients`

```
@mcp-abap-adt/adt-clients/
├── src/
│   ├── clients/                   # High-level client APIs
│   │   ├── AdtClient.ts          # High-level CRUD API (recommended)
│   │   ├── ReadOnlyClient.ts     # Read-only operations (GET)
│   │   └── CrudClient.ts         # Full CRUD (Create, Read, Update, Delete)
│   ├── core/                     # Core object implementations
│   │   ├── class/                # Class operations (Builder, AdtClass, low-level functions)
│   │   ├── program/              # Program operations
│   │   ├── interface/            # Interface operations
│   │   ├── domain/               # Domain operations
│   │   ├── dataElement/          # Data Element operations
│   │   ├── structure/            # Structure operations
│   │   ├── table/                # Table operations
│   │   ├── view/                 # View (CDS) operations
│   │   ├── functionGroup/        # Function Group operations
│   │   ├── functionModule/       # Function Module operations
│   │   ├── package/              # Package operations
│   │   ├── serviceDefinition/    # Service Definition operations
│   │   ├── behaviorDefinition/   # Behavior Definition operations
│   │   ├── behaviorImplementation/ # Behavior Implementation operations
│   │   ├── metadataExtension/    # Metadata Extension operations
│   │   ├── transport/            # Transport Request operations
│   │   ├── unitTest/             # ABAP Unit Test operations
│   │   └── shared/               # Shared utilities (AdtUtils, SharedBuilder)
│   ├── utils/                    # Utility functions
│   │   ├── activationUtils.ts    # Activation utilities
│   │   ├── checkRun.ts           # Check run parsing
│   │   ├── formatters.ts         # Data formatters
│   │   ├── internalUtils.ts      # Internal utilities (encodeSapObjectName, etc.)
│   │   ├── managementOperations.ts # Management operations
│   │   ├── readOperations.ts     # Read operation utilities
│   │   ├── systemInfo.ts         # System information utilities
│   │   ├── timeouts.ts           # Timeout utilities
│   │   └── validation.ts         # Validation utilities
│   ├── __tests__/                # Test infrastructure
│   │   ├── helpers/              # Test helpers (BaseTester, test config, etc.)
│   │   ├── integration/          # Integration tests for all object types
│   │   └── e2e/                  # End-to-end tests
│   └── index.ts                  # Main package exports
├── docs/                         # Documentation
│   ├── architecture/             # Architecture documentation
│   └── development/              # Development documentation
├── package.json
└── tsconfig.json
```

### Core Module Structure

Each core module (e.g., `class/`, `program/`, `table/`) follows a consistent structure:

```
core/[objectType]/
├── [ObjectType]Builder.ts       # Builder class (fluent API with method chaining)
├── Adt[ObjectType].ts           # High-level AdtObject implementation (for AdtClient)
├── types.ts                     # Type definitions (Config, State, Params)
├── create.ts                    # Low-level create function
├── read.ts                      # Low-level read function
├── update.ts                    # Low-level update function
├── delete.ts                    # Low-level delete function
├── lock.ts                      # Low-level lock function
├── unlock.ts                    # Low-level unlock function
├── activate.ts                  # Low-level activate function
├── check.ts                    # Low-level check function
├── validation.ts                # Low-level validation function
└── index.ts                     # Module exports
```

**Key Components:**
- **Builder Classes**: Fluent API with method chaining (`builder.create().lock().update().unlock().activate()`)
- **AdtObject Classes**: High-level implementations for `AdtClient` (implement `IAdtObject<IConfig, IState>`)
- **Low-level Functions**: Direct ADT endpoint operations (snake_case parameters)
- **Type Definitions**: Centralized type definitions for each module

## Classes

### 1. AdtClient (High-Level CRUD API)

**Purpose:** Simplified high-level CRUD operations with automatic operation chains

**Architecture:**
- Factory pattern: Returns `IAdtObject` instances for each object type
- Encapsulates complex operation chains (validate → create → check → lock → update → unlock → activate)
- Automatic error handling and resource cleanup
- Uses low-level functions directly (not Builder classes internally)

**Factory Methods:**
- `getClass()` → `IAdtObject<ClassBuilderConfig>`
- `getProgram()` → `IAdtObject<ProgramBuilderConfig>`
- `getInterface()` → `IAdtObject<InterfaceBuilderConfig>`
- `getDomain()` → `IAdtObject<DomainBuilderConfig>`
- `getDataElement()` → `IAdtObject<DataElementBuilderConfig>`
- `getStructure()` → `IAdtObject<StructureBuilderConfig>`
- `getTable()` → `IAdtObject<TableBuilderConfig>`
- `getView()` → `IAdtObject<ViewBuilderConfig>`
- `getFunctionGroup()` → `IAdtObject<FunctionGroupBuilderConfig>`
- `getFunctionModule()` → `IAdtObject<FunctionModuleBuilderConfig>`
- `getPackage()` → `IAdtObject<PackageBuilderConfig>`
- `getServiceDefinition()` → `IAdtObject<ServiceDefinitionBuilderConfig>`
- `getBehaviorDefinition()` → `IAdtObject<BehaviorDefinitionBuilderConfig>`
- `getBehaviorImplementation()` → `IAdtObject<BehaviorImplementationBuilderConfig>`
- `getMetadataExtension()` → `IAdtObject<MetadataExtensionBuilderConfig>`
- `getUnitTest()` → `IAdtObject<IUnitTestBuilderConfig>`
- `getRequest()` → `IAdtObject<ITransportBuilderConfig>`
- `getUtils()` → `AdtUtils` (utility functions, NOT CRUD operations)

**Methods (via IAdtObject):**
- `validate(config)` → `Promise<AxiosResponse>`
- `create(config, options?)` → `Promise<TReadResult>` (full operation chain)
- `read(config, version?, options?)` → `Promise<TReadResult | undefined>`
- `update(config, options?)` → `Promise<TReadResult>` (full operation chain)
- `delete(config)` → `Promise<AxiosResponse>`
- `activate(config)` → `Promise<AxiosResponse>`
- `check(config, status?)` → `Promise<AxiosResponse>`
- `readMetadata(config, options?)` → `Promise<AxiosResponse>`
- `readTransport(config)` → `Promise<AxiosResponse>`

**AdtUtils Methods (via getUtils()):**
- `searchObjects(params)` → `Promise<AxiosResponse>`
- `getWhereUsed(params)` → `Promise<AxiosResponse>`
- `getInactiveObjects()` → `Promise<AxiosResponse>`
- `activateObjectsGroup(objects, force?)` → `Promise<AxiosResponse>`
- `checkDeletionGroup(objects)` → `Promise<AxiosResponse>`
- `deleteObjectsGroup(objects)` → `Promise<AxiosResponse>`
- `readObjectSource(objectType, objectName, functionGroup?, version?)` → `Promise<AxiosResponse>`
- `readObjectMetadata(objectType, objectName, functionGroup?)` → `Promise<AxiosResponse>`
- `supportsSourceCode(objectType)` → `boolean`
- `getObjectSourceUri(objectType, objectName, functionGroup?)` → `string`
- `getSqlQuery(params)` → `Promise<AxiosResponse>`
- `getTableContents(params)` → `Promise<AxiosResponse>`

**Usage:**
```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection, logger);

// CRUD operations
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
}, { activateOnCreate: true });

// Utility functions
const utils = client.getUtils();
await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
await utils.getWhereUsed({ objectName: 'ZCL_TEST', objectType: 'CLAS' });
```

**Benefits:**
- Simplified API for common workflows
- Automatic operation chains (no manual lock/unlock management)
- Consistent error handling and resource cleanup
- Separation of CRUD operations (via `IAdtObject`) and utility functions (via `AdtUtils`)

---

### 2. ReadOnlyClient

**Purpose:** Read-only operations (GET requests only)

**Architecture:**
- Stateless client (no session management)
- Direct HTTP GET requests to ADT endpoints
- No object locking or modification capabilities
- Perfect for production systems where write access is not needed

**Supported Object Types:**
- Class, Program, Interface, Domain, DataElement, Structure, Table, View
- FunctionGroup, FunctionModule, Package, ServiceDefinition
- Include, Transaction, Enhancement, Behavior Definition
- Transport Request, ABAP AST, Semantic Analysis, System Symbols

**Key Methods:**
- `getClass(name)` - Read class metadata
- `getProgram(name)` - Read program source code
- `getTable(name)` - Read table definition
- `getView(name)` - Read CDS view definition
- `searchObject(query, objectType?)` - Search for objects
- `getWhereUsed(name, type)` - Find where object is used
- `getTransport(transportNumber)` - Read transport request
- `getSqlQuery(sqlQuery, rowNumber?)` - Execute SQL query
- `getTableContents(tableName, maxRows?)` - Read table contents
- And 30+ more read operations

**Usage:**
```typescript
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';

const client = new ReadOnlyClient(connection);

// Read operations only
const program = await client.getProgram('Z_MY_PROGRAM');
const table = await client.getTable('Z_MY_TABLE');
const classes = await client.searchObject('ZCL_*', 'CLAS/OC');
```

**Benefits:**
- Reduced context for LLM (only ~30 tools instead of 58)
- Security: Cannot modify the system
- Perfect for production systems
- Smaller bundle size

---

### 3. CrudClient extends ReadOnlyClient

**Purpose:** Full CRUD functionality (Create, Read, Update, Delete)

**Session Management:**
- `CrudClient` maintains one ADT session per instance by reusing Builder instances for the same object
- Each object type (Domain, Class, DataElement, etc.) has its own Builder instance stored in internal state
- Builder instances are reused when operating on the same object name, ensuring `lockHandle` and session cookies are preserved
- This prevents "User is currently editing" errors when chaining `lock()` → `update()` → `unlock()` operations
- One `CrudClient` instance corresponds to one ADT session, maintaining consistency across operations
- **Parameter Updates**: When a builder is reused, parameters like `transportRequest` are automatically updated if provided in the new config
  - All `get*Builder()` methods (e.g., `getClassBuilder()`, `getViewBuilder()`) now update `transportRequest` via `builder.setRequest()` when reusing existing builders
  - This ensures parameters are never lost when reusing builders for the same object

**Additional methods (besides ReadOnlyClient):**

**Create:**
- `createClass(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className' | 'packageName' | 'description'>)`
- `createProgram(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName' | 'packageName' | 'description'>)`
- `createInterface(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName' | 'packageName' | 'description'>)`
- `createFunctionGroup(config: Partial<FunctionGroupBuilderConfig> & Pick<FunctionGroupBuilderConfig, 'functionGroupName' | 'packageName' | 'description'>)`
- `createFunctionModule(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName' | 'functionGroupName' | 'packageName' | 'description'>)`
- `createTable(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName' | 'packageName' | 'description' | 'ddlCode'>)`
- `createStructure(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName' | 'packageName' | 'description' | 'ddlCode'>)`
- `createView(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName' | 'packageName' | 'description' | 'ddlSource'>)`
- `createDomain(config: Partial<DomainBuilderConfig> & Pick<DomainBuilderConfig, 'domainName' | 'packageName' | 'description'>)`
- `createDataElement(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName' | 'packageName' | 'description' | 'typeKind'>)`
- `createServiceDefinition(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName' | 'packageName' | 'description'>)`
- `createPackage(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage' | 'description' | 'softwareComponent'>)`
- `createTransport(config: CreateTransportParams)`

**Update:**
- `updateClass(config: Partial<ClassBuilderConfig> & Pick<ClassBuilderConfig, 'className'>, lockHandle?: string)`
- `updateProgram(config: Partial<ProgramBuilderConfig> & Pick<ProgramBuilderConfig, 'programName'>, lockHandle?: string)`
- `updateInterface(config: Partial<InterfaceBuilderConfig> & Pick<InterfaceBuilderConfig, 'interfaceName'>, lockHandle?: string)`
- `updateFunctionModule(config: Partial<FunctionModuleBuilderConfig> & Pick<FunctionModuleBuilderConfig, 'functionModuleName'>, lockHandle?: string)`
- `updateView(config: Partial<ViewBuilderConfig> & Pick<ViewBuilderConfig, 'viewName'>, lockHandle?: string)`
- `updateDomain(config: Partial<DomainBuilderConfig> & Pick<DomainBuilderConfig, 'domainName' | 'packageName' | 'description'>, lockHandle?: string)`
- `updateDataElement(config: Partial<DataElementBuilderConfig> & Pick<DataElementBuilderConfig, 'dataElementName' | 'packageName' | 'description'>, lockHandle?: string)`
- `updateStructure(config: Partial<StructureBuilderConfig> & Pick<StructureBuilderConfig, 'structureName' | 'ddlCode'>, lockHandle?: string)`
- `updateTable(config: Partial<TableBuilderConfig> & Pick<TableBuilderConfig, 'tableName' | 'ddlCode'>, lockHandle?: string)`
- `updateServiceDefinition(config: Partial<ServiceDefinitionBuilderConfig> & Pick<ServiceDefinitionBuilderConfig, 'serviceDefinitionName' | 'sourceCode'>, lockHandle?: string)`
- `updatePackage(config: Partial<PackageBuilderConfig> & Pick<PackageBuilderConfig, 'packageName' | 'superPackage'>, lockHandle?: string)`

**Lock/Unlock:**
- `lockClass(config: Pick<ClassBuilderConfig, 'className'>)` → stores `lockHandle` in state
- `unlockClass(config: Pick<ClassBuilderConfig, 'className'>, lockHandle?: string)`
- Similar methods for all object types (Program, Interface, Domain, DataElement, Structure, Table, View, ServiceDefinition, FunctionModule, FunctionGroup, Package)

**Activate:**
- `activateClass(config: Pick<ClassBuilderConfig, 'className'>)`
- Similar methods for all object types

**Check:**
- `checkClass(config: Pick<ClassBuilderConfig, 'className'>, status?: string)` → returns `Promise<AxiosResponse>`
- Similar methods for all object types

**Validate:**
- `validateClass(config: Pick<ClassBuilderConfig, 'className' | 'packageName' | 'description'>)` → returns `Promise<AxiosResponse>`
- Similar methods for all object types

**Read:**
- `readClass(config: Pick<ClassBuilderConfig, 'className'>)` → returns `Promise<ClassBuilderConfig | undefined>`
- Similar methods for all object types, returning corresponding `*BuilderConfig` or source code string

**Delete:**
- `deleteClass(config: Pick<ClassBuilderConfig, 'className'>)`
- Similar methods for all object types

---

### 4. ManagementClient

**Purpose:** Object management operations (activation, syntax checking)

**Methods:**
- `activateObject(objects: Array<{name: string, type: string}>)`
- `checkObject(name: string, type: string, version?: string)`

---

## Usage and Imports

### Importing Specific Clients

The package allows importing exactly the client variant you need:

```typescript
// Import AdtClient (high-level CRUD API - recommended)
import { AdtClient } from '@mcp-abap-adt/adt-clients';

// Import only ReadOnlyClient
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';

// Import only CrudClient
import { CrudClient } from '@mcp-abap-adt/adt-clients';

// Import only ManagementClient
import { ManagementClient } from '@mcp-abap-adt/adt-clients';

// Import all clients
import { AdtClient, ReadOnlyClient, CrudClient, ManagementClient } from '@mcp-abap-adt/adt-clients';
```

### High-Level CRUD API (Recommended)

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection(config, logger);
const client = new AdtClient(connection, logger);

// Simple CRUD operations with automatic operation chains
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class'
}, { activateOnCreate: true });

// Utility functions
const utils = client.getUtils();
await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
```

### Read-Only MCP Server

```typescript
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection(config, logger);
const client = new ReadOnlyClient(connection);

// Read-only operations only
const program = await client.getProgram('Z_MY_PROGRAM');
const table = await client.getTable('Z_MY_TABLE');
const classes = await client.searchObject('ZCL_*', 'CLAS/OC');
```

### Full CRUD MCP Server

```typescript
import { CrudClient } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection(config, logger);
const client = new CrudClient(connection);

// Full CRUD functionality
await client.createProgram({ name: 'Z_NEW_PROG', ... });
await client.updateProgramSource('Z_NEW_PROG', 'REPORT z_new_prog.');
await client.deleteObject('Z_NEW_PROG', 'PROG/P');

// Also has all read-only methods (inherited from ReadOnlyClient)
const program = await client.getProgram('Z_NEW_PROG');
```

### Management Operations Only

```typescript
import { ManagementClient } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection(config, logger);
const management = new ManagementClient(connection);

// Activation and syntax checking
await management.activateObject([
  { name: 'Z_CLASS', type: 'CLAS/OC' }
]);
await management.checkObject('Z_CLASS', 'CLAS/OC');
```

### Combined Access (Proxy Pattern)

```typescript
import { ReadOnlyClient, ManagementClient } from '@mcp-abap-adt/adt-clients';
import { AbapConnection } from '@mcp-abap-adt/connection';

class ReadOnlyWithActivation {
  private readOnly: ReadOnlyClient;
  private management: ManagementClient;

  constructor(connection: AbapConnection) {
    this.readOnly = new ReadOnlyClient(connection);
    this.management = new ManagementClient(connection);
  }

  // Delegate to ReadOnlyClient
  getProgram = this.readOnly.getProgram.bind(this.readOnly);
  getTable = this.readOnly.getTable.bind(this.readOnly);
  // ... other read-only methods

  // Delegate to ManagementClient
  activateObject = this.management.activateObject.bind(this.management);
  checkObject = this.management.checkObject.bind(this.management);
}
```

### Custom Client Composition

```typescript
import { ReadOnlyClient, CrudClient, ManagementClient } from '@mcp-abap-adt/adt-clients';

// Create a custom client that combines specific functionality
class CustomAbapClient {
  private readOnly: ReadOnlyClient;
  private crud: CrudClient;
  private management: ManagementClient;

  constructor(connection: AbapConnection) {
    this.readOnly = new ReadOnlyClient(connection);
    this.crud = new CrudClient(connection);
    this.management = new ManagementClient(connection);
  }

  // Expose only what you need
  getProgram = this.readOnly.getProgram.bind(this.readOnly);
  createProgram = this.crud.createProgram.bind(this.crud);
  activateObject = this.management.activateObject.bind(this.management);
}
```

---

## Benefits

1. **Reduced Context for LLM:**
   - Read-only MCP exposes only ~30 tools instead of 58
   - Fewer tokens, faster processing
   - More focused context

2. **Flexibility:**
   - Different MCP servers with different access levels
   - Ability to combine classes via proxy pattern
   - Import only what you need

3. **Security:**
   - Read-only access cannot modify the system
   - Perfect for production systems
   - Fine-grained access control

4. **Testing:**
   - Easy to mock individual classes
   - Independent testing of each level
   - Better test isolation

5. **Publishing:**
   - Can publish as separate package
   - Community can use only read-only functionality
   - Smaller bundle size for read-only use cases

---

## Dependencies

```json
{
  "dependencies": {
    "@mcp-abap-adt/connection": "workspace:*",
    "fast-xml-parser": "^5.2.5"
  },
  "devDependencies": {
    "@types/node": "^24.2.1",
    "typescript": "^5.9.2"
  }
}
```

---

## Interfaces

### Logger Interface

All Builders use a unified `IAdtLogger` interface for logging:

```typescript
// src/utils/logger.ts
export interface IAdtLogger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}

// Empty logger for silent operation
export const emptyLogger: IAdtLogger = {};
```

**Features:**
- All methods are optional (using `?`)
- Enables silent operation when logging is disabled
- Unified interface across all Builders
- Compatible with console, winston, pino, and other loggers

**Usage in Builders:**

```typescript
import { IAdtLogger, emptyLogger } from '../../utils/logger';

export class ClassBuilder {
  private logger: IAdtLogger;

  constructor(
    connection: AbapConnection,
    config: ClassBuilderConfig,
    logger?: IAdtLogger
  ) {
    this.connection = connection;
    this.config = config;
    this.logger = logger || emptyLogger;
  }

  async lock(name: string): Promise<string> {
    const lockHandle = await lockObject(/* ... */);
    this.logger.info?.('Class locked, handle:', lockHandle);
    return lockHandle;
  }
}
```

**Note:** Lock handles are always logged in **full** (not truncated), making debugging easier.

### Builder Return Types

Builders use different return types based on whether methods modify state:

**State-changing methods** (return `Promise<this>` for chaining):
- `create()`, `lock()`, `update()`, `unlock()`, `activate()`, `delete()`
- Enable method chaining: `await builder.create().then(b => b.lock()).then(b => b.update())`

**Non-state-changing methods** (return results directly):
- `validate()` → `Promise<AxiosResponse>` – validation response from ADT
- `check(status?: string)` → `Promise<AxiosResponse>` – syntax/consistency check response
- `read(version?: 'active' | 'inactive')` → `Promise<BuilderConfigUnion | string | undefined>` – parsed configuration or source code

This design makes the API more concise:
```typescript
// Before (state-changing pattern)
await builder.validate();
const result = builder.getValidationResponse();

// After (direct return)
const result = await builder.validate();
```

**BuilderConfigUnion** type encompasses all possible `*BuilderConfig` interfaces, allowing type-safe access to parsed configuration from read operations.

### Connection Interface

```typescript
interface AbapConnection {
  makeAdtRequest(options: AbapRequestOptions): Promise<AxiosResponse>;
  getBaseUrl(): Promise<string>;
  getAuthHeaders(): Promise<Record<string, string>>;
}
```

### Builder Configuration Interfaces

```typescript
interface CreateClassParams {
  name: string;
  packageName: string;
  description?: string;
  transportRequest?: string;
  // ... other parameters
}

interface UpdateDomainParams {
  packageName: string;
  dataType: string;
  length?: number;
  decimals?: number;
  transportRequest?: string;
  activate?: boolean;
  // ... other parameters
}
```

---

## Type System Organization

### Type Definition Structure

Each core module (class, program, interface, domain, dataElement, structure, table, view, functionGroup, functionModule, package, transport, behaviorDefinition, metadataExtension, shared) maintains its own `types.ts` file with centralized type definitions.

### Naming Conventions

The package uses **dual naming conventions** to distinguish between low-level operations and high-level Builder API:

#### Low-Level Function Parameters (snake_case)

Used by internal ADT API functions that directly interact with SAP backend:

```typescript
// Low-level function parameters use snake_case
export interface CreateClassParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  create_protected?: boolean;
}
```

#### Builder Configuration (camelCase)

Used by Builder classes that provide fluent API:

```typescript
// Builder configuration uses camelCase
export interface ClassBuilderConfig {
  className: string;
  description: string;
  packageName?: string;
  transportRequest?: string;
  sourceCode?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  createProtected?: boolean;
  masterSystem?: string;
  responsible?: string;
}
```

### Type Organization Pattern

Each module's `types.ts` file follows this structure:

```typescript
// 1. Low-level function parameters (snake_case)
export interface CreateXxxParams { ... }
export interface UpdateXxxParams { ... }
export interface DeleteXxxParams { ... }

// 2. Builder configuration (camelCase)
export interface XxxBuilderConfig { ... }
export interface XxxBuilderState { ... }
```

### Module Exports

Type definitions are exported through module index files:

```typescript
// src/core/class/index.ts
export * from './types';           // All type definitions
export { ClassBuilder } from './ClassBuilder';  // Builder class
```

This allows consumers to import types directly:

```typescript
import { 
  CreateClassParams,      // Low-level parameters
  ClassBuilderConfig,     // Builder configuration
  ClassBuilderState,      // Builder state
  ClassBuilder            // Builder class
} from '@mcp-abap-adt/adt-clients';
```

---

## Test Infrastructure

### BaseTester Class

**Purpose:** Standardized integration test infrastructure for `IAdtObject` implementations

**Location:** `src/__tests__/helpers/BaseTester.ts`

**Architecture:**
- Generic class that works with any `IAdtObject<IConfig, IState>` implementation
- Provides standardized CRUD workflow testing patterns
- Handles test setup, teardown, and cleanup automatically
- Supports dependency management and custom cleanup callbacks

**Key Methods:**
- `setup(options)` - Initialize BaseTester with connection, client, and configuration builder
- `flowTestAuto(options?)` - Execute full CRUD workflow: validate → create → check → update → activate → cleanup
- `readTest()` - Read standard object test (for existing SAP objects)
- `beforeEach()` - Setup before each test (cleanup existing objects)
- `afterEach()` - Cleanup after each test (delete created objects)
- `afterAll()` - Final cleanup (reset connection)

**Benefits:**
- **Consistency**: All integration tests follow the same pattern
- **Reduced Boilerplate**: Eliminates repetitive setup/teardown code
- **Automatic Cleanup**: Handles object deletion and unlock automatically
- **Error Handling**: Proper cleanup on test failures
- **Dependency Management**: Supports creating/deleting dependencies (e.g., FunctionGroup for FunctionModule)

**Migration Status:**
- 13/15 object-specific integration tests migrated to `BaseTester` (87%)
- Remaining: `MetadataExtension.test.ts` (requires existing CDS projection in YAML config)
- See [BaseTester Migration Roadmap](../development/roadmaps/BASE_TESTER_MIGRATION.md) for details

**Example Usage:**
```typescript
import { BaseTester } from '../../helpers/BaseTester';
import { IClassConfig, IClassState } from '../../../core/class';

describe('ClassBuilder (using AdtClient)', () => {
  let tester: BaseTester<IClassConfig, IClassState>;

  beforeAll(async () => {
    const connection = createAbapConnection(config, logger);
    const client = new AdtClient(connection, builderLogger);
    
    tester = new BaseTester(
      client.getClass(),
      'Class',
      'create_class',
      'adt_class',
      testsLogger
    );

    tester.setup({
      connection,
      client,
      hasConfig: true,
      buildConfig: (testCase: any) => ({
        className: testCase.params.class_name,
        packageName: resolvePackageName(testCase.params.package_name),
        // ... other config
      }),
      ensureObjectReady: async (className: string) => {
        // Custom cleanup logic
        return { success: true };
      }
    });
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should execute full workflow', async () => {
      const config = tester.getConfig();
      if (!config) return;

      await tester.flowTestAuto({
        sourceCode: config.sourceCode || 'CLASS ... ENDCLASS.',
        updateConfig: { ...config }
      });
    });
  });
});
```

**Test Organization:**
- Integration tests use `AdtClient` for consistency
- Shared tests use `AdtUtils` for utility functions
- Unit test logic separated from integration tests (e.g., `Class.test.ts`, `View.test.ts`)
- All tests support cleanup parameters (`cleanup_after_test`, `skip_cleanup`)

---

## Debug Flags

The library uses a **5-tier granular debug flag system**:

1. **`DEBUG_CONNECTORS`** - `@mcp-abap-adt/connection` package logs
2. **`DEBUG_ADT_LIBS`** - Builder implementation and core library functions
3. **`DEBUG_ADT_TESTS`** - Builder test execution logs
4. **`DEBUG_ADT_E2E_TESTS`** - E2E integration test logs
5. **`DEBUG_ADT_HELPER_TESTS`** - Test helper function logs

See [DEBUG.md](../DEBUG.md) for detailed usage.

---

## Implementation Plan

1. Create package `@mcp-abap-adt/adt-clients`
2. Create client classes with methods
3. Implement core modules for each object type
4. Implement private utilities
5. Add tests
6. Publish package

**Note:** Handlers are part of the MCP server (`@mcp-abap-adt`), not this client library. This library provides the client APIs that handlers use.

## Export Structure

The package exports clients, utilities, and types individually, allowing tree-shaking and selective imports:

```typescript
// Main exports from src/index.ts
export { AdtClient } from './clients/AdtClient';
export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';
export { AdtUtils, SharedBuilder } from './core/shared';

// Type exports
export type { IClassConfig as ClassBuilderConfig } from './core/class';
export type { IProgramConfig as ProgramBuilderConfig } from './core/program';
// ... and all other object type configs

// Utility exports
export { encodeSapObjectName } from './utils/internalUtils';
export type { ILogger } from '@mcp-abap-adt/interfaces';
```

This allows:
- Tree-shaking: Only imported code is bundled
- Selective imports: Import only what you need
- Type safety: Full TypeScript support
- Clear API: Explicit client selection

