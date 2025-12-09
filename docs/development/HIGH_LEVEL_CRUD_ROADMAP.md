# High-Level CRUD API Roadmap

## Overview

This roadmap describes the implementation of high-level CRUD operations that encapsulate complex operation chains for each ADT object type. These operations provide a simplified API for common workflows while maintaining proper error handling and resource cleanup.

## Architecture

### Components

1. **Object-Specific CRUD Classes** (`src/core/{entity}/Adt{Entity}.ts`)
   - High-level CRUD operations for each object type
   - Encapsulates operation chains with proper error handling
   - Handles resource cleanup (unlock, delete on failure)
   - Uses existing Builder classes internally for low-level operations
   - Each CRUD class wraps the corresponding Builder (e.g., `AdtClass` uses `ClassBuilder`)

2. **IAdtObject Interface** (`@mcp-abap-adt/interfaces/src/adt/IAdtObject.ts`)
   - Common interface for all object CRUD classes
   - Defines standard CRUD operations: create, read, update, delete, validate, activate, check
   - Includes `CreateOptions` and `UpdateOptions` interfaces
   - Exported from `@mcp-abap-adt/interfaces` package
   - Uses "Object" terminology which is accurate for ADT context (ABAP objects)

3. **AdtClient** (`src/clients/AdtClient.ts`)
   - High-level client that returns IAdtObject instances
   - Factory methods for each object type (`getClass()`, `getProgram()`, etc.)
   - Maintains connection and logger context

## Operation Chains

### Create Operation Chain

```
validate() 
  → create() 
  → check() 
  → lock() 
  → check('inactive') [with code/xml for update] 
  → update() 
  → unlock() 
  → check() 
  → activate() [if activateOnCreate=true]
```

**Error Handling:**
- If validation fails → stop, don't create
- If create fails → stop, no cleanup needed (object doesn't exist)
- If check fails after create → unlock (if locked), optionally delete (if `deleteOnFailure=true`)
- If update fails → unlock, optionally delete (if `deleteOnFailure=true`)
- If any operation locks the object → ensure unlock in finally block

### Update Operation Chain

```
lock() 
  → check('inactive') [with code/xml for update] 
  → update() 
  → unlock() 
  → check() 
  → activate() [if activateOnUpdate=true]
```

**Error Handling:**
- If lock fails → stop
- If check fails before update → unlock, optionally delete (if `deleteOnFailure=true`)
- If update fails → unlock, optionally delete (if `deleteOnFailure=true`)
- Always unlock in finally block if object was locked

### Delete Operation Chain

```
check('deletion') 
  → delete()
```

**Error Handling:**
- If check fails → stop, don't delete
- If delete fails → propagate error

## Interface Design

### IAdtObject Interface

```typescript
export interface IAdtObject<TConfig, TReadResult = TConfig> {
  /**
   * Validate object configuration before creation
   * @param config - Object configuration
   * @returns Validation response
   */
  validate(config: Partial<TConfig>): Promise<AxiosResponse>;

  /**
   * Create object with full operation chain
   * @param config - Object configuration
   * @param options - Create options
   * @returns Created object configuration
   */
  create(
    config: TConfig,
    options?: CreateOptions
  ): Promise<TReadResult>;

  /**
   * Read object
   * @param config - Object identification (name, etc.)
   * @param version - 'active' or 'inactive'
   * @returns Object configuration or source code
   */
  read(
    config: Partial<TConfig>,
    version?: 'active' | 'inactive'
  ): Promise<TReadResult | undefined>;

  /**
   * Update object with full operation chain
   * @param config - Object configuration with updates
   * @param options - Update options
   * @returns Updated object configuration
   */
  update(
    config: Partial<TConfig>,
    options?: UpdateOptions
  ): Promise<TReadResult>;

  /**
   * Delete object
   * @param config - Object identification
   * @returns Delete response
   */
  delete(config: Partial<TConfig>): Promise<AxiosResponse>;

  /**
   * Activate object
   * @param config - Object identification
   * @returns Activation response
   */
  activate(config: Partial<TConfig>): Promise<AxiosResponse>;

  /**
   * Check object (syntax, consistency, etc.)
   * @param config - Object identification
   * @param status - Optional status to check ('active', 'inactive', 'deletion')
   * @returns Check response
   */
  check(
    config: Partial<TConfig>,
    status?: string
  ): Promise<AxiosResponse>;
}
```

### Options Interfaces

```typescript
export interface CreateOptions {
  /**
   * Activate object after creation
   * @default false
   */
  activateOnCreate?: boolean;

  /**
   * Delete object if creation fails
   * @default false
   */
  deleteOnFailure?: boolean;

  /**
   * Source code or XML to use for update after create
   */
  sourceCode?: string;
  xmlContent?: string;
}

export interface UpdateOptions {
  /**
   * Activate object after update
   * @default false
   */
  activateOnUpdate?: boolean;

  /**
   * Delete object if update fails
   * @default false
   */
  deleteOnFailure?: boolean;

  /**
   * Lock handle if object is already locked
   */
  lockHandle?: string;
}
```

## Implementation Strategy

### Object CRUD Classes

Each object CRUD class will:

1. **Wrap Builder Operations**
   - Use existing Builder classes for low-level operations
   - Compose operation chains
   - Handle state management
   - Accept connection and logger in constructor (same as Builders)
   - Create Builder instances internally as needed

2. **Error Handling**
   - Try-catch-finally blocks for resource cleanup
   - Track lock state to ensure unlock
   - Optional deletion on failure
   - Proper error propagation with context

3. **Operation Stubs**
   - For operations not supported by ADT for specific entity types
   - Throw error: "Operation not implemented in ADT for this object type"
   - Use consistent error message format

### Supported Objects

The following object types will have CRUD classes:

1. **Class** (`AdtClass`)
2. **Program** (`AdtProgram`)
3. **Interface** (`AdtInterface`)
4. **Domain** (`AdtDomain`)
5. **DataElement** (`AdtDataElement`)
6. **Structure** (`AdtStructure`)
7. **Table** (`AdtTable`)
8. **View** (`AdtView`)
9. **FunctionGroup** (`AdtFunctionGroup`)
10. **FunctionModule** (`AdtFunctionModule`)
11. **Package** (`AdtPackage`)
12. **ServiceDefinition** (`AdtServiceDefinition`)
13. **BehaviorDefinition** (`AdtBehaviorDefinition`)
14. **BehaviorImplementation** (`AdtBehaviorImplementation`)
15. **MetadataExtension** (`AdtMetadataExtension`)

### AdtClient API

```typescript
export class AdtClient {
  private connection: IAbapConnection;
  private logger: IAdtLogger;

  constructor(
    connection: IAbapConnection,
    logger?: IAdtLogger
  ) {
    this.connection = connection;
    this.logger = logger || emptyLogger;
  }

  // Factory methods returning IAdtObject instances
  // Each method creates a new CRUD instance with connection and logger
  getClass(): IAdtObject<ClassBuilderConfig, ClassBuilderConfig>;
  getProgram(): IAdtObject<ProgramBuilderConfig, ProgramBuilderConfig>;
  getInterface(): IAdtObject<InterfaceBuilderConfig, InterfaceBuilderConfig>;
  getDomain(): IAdtObject<DomainBuilderConfig, DomainBuilderConfig>;
  getDataElement(): IAdtObject<DataElementBuilderConfig, DataElementBuilderConfig>;
  getStructure(): IAdtObject<StructureBuilderConfig, StructureBuilderConfig>;
  getTable(): IAdtObject<TableBuilderConfig, TableBuilderConfig>;
  getView(): IAdtObject<ViewBuilderConfig, ViewBuilderConfig>;
  getFunctionGroup(): IAdtObject<FunctionGroupBuilderConfig, FunctionGroupBuilderConfig>;
  getFunctionModule(): IAdtObject<FunctionModuleBuilderConfig, FunctionModuleBuilderConfig>;
  getPackage(): IAdtObject<PackageBuilderConfig, PackageBuilderConfig>;
  getServiceDefinition(): IAdtObject<ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderConfig>;
  getBehaviorDefinition(): IAdtObject<BehaviorDefinitionBuilderConfig, BehaviorDefinitionBuilderConfig>;
  getBehaviorImplementation(): IAdtObject<BehaviorImplementationBuilderConfig, BehaviorImplementationBuilderConfig>;
  getMetadataExtension(): IAdtObject<MetadataExtensionBuilderConfig, MetadataExtensionBuilderConfig>;
}
```

**Note:** Each factory method creates a new CRUD instance. CRUD instances are stateless and can be reused, but each factory call returns a new instance for flexibility.

**Usage Example:**
```typescript
const client = new AdtClient(connection, logger);

// Clean, readable API
const classOps = client.getClass();
await classOps.create(config, { activateOnCreate: true });

const domainOps = client.getDomain();
await domainOps.update(config, { activateOnUpdate: true });
```

## Implementation Phases

### Phase 1: Core Infrastructure
- [x] Create `IAdtObject` interface in `@mcp-abap-adt/interfaces/src/adt/IAdtObject.ts`
- [x] Create `CreateOptions` and `UpdateOptions` interfaces (in same file)
- [x] Create base error classes for unsupported operations in `src/core/shared/errors.ts`
- [x] Create `AdtClient` skeleton in `src/clients/AdtClient.ts`
- [x] Export `IAdtObject` from `@mcp-abap-adt/interfaces` package

### Phase 2: Reference Implementation
- [x] Implement `AdtClass` as reference implementation in `src/core/class/AdtClass.ts`
  - [x] Implement `validate()` method
  - [x] Implement `create()` with full operation chain (validate → create → check → lock → check(inactive) → update → unlock → check → activate)
  - [x] Implement `read()` method
  - [x] Implement `update()` with full operation chain (lock → check(inactive) → update → unlock → check → activate)
  - [x] Implement `delete()` with deletion check
  - [x] Implement `activate()` method
  - [x] Implement `check()` method
  - [x] Error handling with cleanup (unlock, delete on failure)
  - [x] Integration with `AdtClient.getClass()`
- [ ] Test create chain with all error scenarios
- [ ] Test update chain with all error scenarios
- [ ] Test delete operation
- [ ] Document patterns and best practices

### Phase 3: Object CRUD Classes
- [x] Implement `AdtClass` as reference (completed in Phase 2)
- [ ] Implement CRUD classes for remaining object types:
  - [ ] `AdtProgram`
  - [ ] `AdtInterface`
  - [ ] `AdtDomain`
  - [ ] `AdtDataElement`
  - [ ] `AdtStructure`
  - [ ] `AdtTable`
  - [ ] `AdtView`
  - [ ] `AdtFunctionGroup`
  - [ ] `AdtFunctionModule`
  - [ ] `AdtPackage`
  - [ ] `AdtServiceDefinition`
  - [ ] `AdtBehaviorDefinition`
  - [ ] `AdtBehaviorImplementation`
  - [ ] `AdtMetadataExtension`
- [ ] Add operation stubs for unsupported operations
- [ ] Ensure consistent error handling across all objects

### Phase 4: Integration
- [x] Complete `AdtClient` with factory method for Class (`getClass()`)
- [ ] Complete `AdtClient` with remaining factory methods (`getProgram()`, `getInterface()`, etc.)
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Add usage examples with clean API

## Naming Conventions

### Classes
- Object CRUD classes: `Adt{Entity}` (e.g., `AdtClass`, `AdtDomain`)
- High-level client: `AdtClient`

### Files
- CRUD class: `src/core/{entity}/Adt{Entity}.ts` (e.g., `src/core/class/AdtClass.ts`)
- Interface: `src/core/shared/IAdtObject.ts` (follows existing pattern with `IBuilder`)
- Client: `src/clients/AdtClient.ts`

### Methods
- Follow existing Builder naming conventions
- Use camelCase for methods
- Use descriptive names that indicate operation chains

## Error Handling Patterns

### Unsupported Operations

```typescript
async create(config: TConfig, options?: CreateOptions): Promise<TReadResult> {
  throw new Error(
    `Create operation is not implemented in ADT for ${this.objectType} objects`
  );
}
```

**Note:** Each CRUD class should have a `readonly objectType: string` property for consistent error messages.

### Lock Cleanup

```typescript
let lockHandle: string | undefined;
try {
  lockHandle = await builder.lock();
  // ... operations
} finally {
  if (lockHandle) {
    try {
      await builder.unlock();
    } catch (unlockError) {
      logger.warn?.('Failed to unlock during cleanup:', unlockError);
    }
  }
}
```

### Delete on Failure

```typescript
let objectCreated = false;
try {
  await builder.create();
  objectCreated = true;
  // ... more operations
} catch (error) {
  if (objectCreated && options?.deleteOnFailure) {
    try {
      await builder.delete();
    } catch (deleteError) {
      logger.warn?.('Failed to delete object after failure:', deleteError);
    }
  }
  throw error;
}
```

## Testing Strategy

### Unit Tests
- Test each operation chain independently
- Test error scenarios (validation failure, create failure, update failure)
- Test cleanup logic (unlock, delete on failure)
- Test unsupported operations

### Integration Tests
- Test full create chain end-to-end
- Test full update chain end-to-end
- Test delete operation
- Test error recovery scenarios

## Documentation

### API Documentation
- JSDoc comments for all public methods
- Usage examples for each entity type
- Error handling examples

### User Guide
- When to use high-level CRUD vs. low-level Builder API
- Common patterns and best practices
- Migration guide from Builder API

## Future Enhancements

1. **Batch Operations**
   - Create/update/delete multiple objects
   - Group activation support

2. **Transaction Support**
   - Rollback on failure
   - Atomic operations

3. **Progress Tracking**
   - Callbacks for operation progress
   - Detailed operation logs

4. **Retry Logic**
   - Automatic retry for transient failures
   - Configurable retry policies
