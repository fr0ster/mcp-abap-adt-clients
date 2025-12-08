# ADT Clients Architecture

## Overview

Separation of ADT endpoint functionality into three classes to enable different access levels and reduce context for LLM.

## Package Structure `@mcp-abap-adt/adt-clients`

```
packages/adt-clients/
├── src/
│   ├── clients/
│   │   ├── ReadOnlyClient.ts      # Read-only operations (GET)
│   │   ├── CrudClient.ts          # Full CRUD (Create, Read, Update, Delete)
│   │   └── ManagementClient.ts    # Management operations (Activate, Check, etc.)
│   ├── utils/
│   │   └── internalUtils.ts       # Private utilities (encodeSapObjectName, etc.)
│   └── index.ts                   # Exports
├── package.json
└── tsconfig.json
```

## Classes

### 1. ReadOnlyClient

**Purpose:** Read-only operations (GET)

**Methods:**
- `getClass(name: string)`
- `getProgram(name: string)`
- `getFunction(name: string, group: string)`
- `getFunctionGroup(name: string)`
- `getTable(name: string)`
- `getStructure(name: string)`
- `getView(name: string)`
- `getDomain(name: string)`
- `getDataElement(name: string)`
- `getPackage(name: string)`
- `getInterface(name: string)`
- `getServiceDefinition(name: string)`
- `getInclude(name: string)`
- `getIncludesList(name: string, type: string)`
- `getTypeInfo(name: string, type: string)`
- `getObjectInfo(parentType: string, parentName: string, maxDepth?: number)`
- `getObjectStructure(parentType: string, parentName: string, nodeId: string)`
- `getTransaction(name: string)`
- `getTableContents(tableName: string, maxRows?: number)`
- `getObjectsList(parentName: string, parentTechName: string, parentType: string)`
- `getObjectsByType(parentName: string, parentTechName: string, parentType: string, nodeId: string)`
- `getProgFullCode(name: string, type: string)`
- `getObjectNodeFromCache(...)`
- `getAdtTypes()`
- `getSqlQuery(sqlQuery: string, rowNumber?: number)`
- `getWhereUsed(name: string, type: string)`
- `searchObject(query: string, objectType?: string)`
- `getEnhancements(packageName?: string)`
- `getEnhancementImpl(name: string)`
- `getEnhancementSpot(name: string)`
- `getBdef(name: string)`
- `getTransport(transportNumber: string)`
- `getAbapAST(name: string, type: string)`
- `getAbapSemanticAnalysis(name: string, type: string)`
- `getAbapSystemSymbols()`
- `describeByList(objects: Array<{name: string, type: string}>)`

**Handlers:**
- handleGetClass
- handleGetProgram
- handleGetFunction
- handleGetFunctionGroup
- handleGetTable
- handleGetStructure
- handleGetView
- handleGetDomain
- handleGetDataElement
- handleGetPackage
- handleGetInterface
- handleGetServiceDefinition
- handleGetInclude
- handleGetIncludesList
- handleGetTypeInfo
- handleGetObjectInfo
- handleGetObjectStructure
- handleGetTransaction
- handleGetTableContents
- handleGetObjectsList
- handleGetObjectsByType
- handleGetProgFullCode
- handleGetObjectNodeFromCache
- handleGetAllTypes
- handleGetSqlQuery
- handleGetWhereUsed
- handleSearchObject
- handleGetEnhancements
- handleGetEnhancementImpl
- handleGetEnhancementSpot
- handleGetBdef
- handleGetTransport
- handleGetAbapAST
- handleGetAbapSemanticAnalysis
- handleGetAbapSystemSymbols
- handleDescribeByList

---

### 2. CrudClient extends ReadOnlyClient

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

**Handlers:**
- handleCreateClass
- handleCreateProgram
- handleCreateInterface
- handleCreateFunctionGroup
- handleCreateFunctionModule
- handleCreateTable
- handleCreateStructure
- handleCreateView
- handleCreateDomain
- handleCreateDataElement
- handleCreateServiceDefinition
- handleCreatePackage
- handleCreateTransport
- handleUpdateClassSource
- handleUpdateProgramSource
- handleUpdateInterfaceSource
- handleUpdateFunctionModuleSource
- handleUpdateViewSource
- handleUpdateDomain
- handleUpdateDataElement
- handleDeleteObject

---

### 3. ManagementClient

**Purpose:** Object management operations (activation, syntax checking)

**Methods:**
- `activateObject(objects: Array<{name: string, type: string}>)`
- `checkObject(name: string, type: string, version?: string)`

**Handlers:**
- handleActivateObject
- handleCheckObject

---

## Usage and Imports

### Importing Specific Clients

The package allows importing exactly the client variant you need:

```typescript
// Import only ReadOnlyClient
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';

// Import only CrudClient
import { CrudClient } from '@mcp-abap-adt/adt-clients';

// Import only ManagementClient
import { ManagementClient } from '@mcp-abap-adt/adt-clients';

// Import all clients
import { ReadOnlyClient, CrudClient, ManagementClient } from '@mcp-abap-adt/adt-clients';
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
2. Extract handlers into separate modules
3. Create three classes with methods
4. Implement private utilities
5. Update MCP server to use classes
6. Create proxy for combined access
7. Add tests
8. Publish package

## Export Structure

The package will export clients individually, allowing tree-shaking and selective imports:

```typescript
// packages/adt-clients/src/index.ts
export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';
export { ManagementClient } from './clients/ManagementClient';

// Type exports
export type { ReadOnlyClient as IReadOnlyClient } from './clients/ReadOnlyClient';
export type { CrudClient as ICrudClient } from './clients/CrudClient';
export type { ManagementClient as IManagementClient } from './clients/ManagementClient';
```

This allows:
- Tree-shaking: Only imported code is bundled
- Selective imports: Import only what you need
- Type safety: Full TypeScript support
- Clear API: Explicit client selection

