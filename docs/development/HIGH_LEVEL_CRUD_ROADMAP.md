# High-Level CRUD API Roadmap

## Overview

This roadmap describes the implementation of high-level CRUD operations that encapsulate complex operation chains for each ADT object type. These operations provide a simplified API for common workflows while maintaining proper error handling and resource cleanup.

## ⚠️ CRITICAL: Session Management Rules

**MANDATORY RULES FOR ALL IMPLEMENTATIONS:**

1. **`stateful` session:**
   - **ONLY** set before `lock` operations
   - **NEVER** set for `create`, `delete`, `activate`, `validate`, `check`, `read`
   - **NEVER** set in cleanup before `unlock` (already in stateful after lock)

2. **`stateless` session:**
   - **ALWAYS** set after `unlock` operations
   - **ALWAYS** set in cleanup after `unlock` in error handlers

3. **Pattern:**
   ```typescript
   // ✅ CORRECT
   this.connection.setSessionType('stateful');  // ONLY before lock
   lockHandle = await lockClass(...);
   // ... operations ...
   await unlockClass(...);
   this.connection.setSessionType('stateless'); // MANDATORY after unlock
   ```

**See "Session Management Rules" section below for detailed documentation.**

## ⚠️ CRITICAL: Timeout Configuration

**MANDATORY FOR ALL IMPLEMENTATIONS:**

1. **Default timeout:**
   - **Default:** 1000 ms (1 second)
   - **Configurable:** via `timeout` option in `IAdtOperationOptions`

2. **Why timeouts are critical:**
   - Without timeouts, operations may fail due to system not completing commands in time
   - System may be slow or under load
   - Complex operations (activate, check) may take longer

3. **Usage:**
   ```typescript
   // Default timeout (1000 ms)
   await adtClass.create(config);
   
   // Custom timeout (5 seconds)
   await adtClass.create(config, { timeout: 5000 });
   
   // Custom timeout for update
   await adtClass.update(config, { timeout: 10000 });
   ```

**See "Timeout Configuration Rules" section below for detailed documentation.**

## Architecture

### Components

1. **Object-Specific CRUD Classes** (`src/core/{entity}/Adt{Entity}.ts`)
   - High-level CRUD operations for each object type
   - Encapsulates operation chains with proper error handling
   - Handles resource cleanup (unlock, delete on failure)
   - Uses low-level functions directly (not Builder classes)
   - Each CRUD class uses low-level functions from `src/core/{entity}/*.ts` modules

2. **IAdtObject Interface** (`@mcp-abap-adt/interfaces/src/adt/IAdtObject.ts`)
   - Common interface for all object CRUD classes
   - Defines standard CRUD operations: create, read, update, delete, validate, activate, check
   - Includes `IAdtOperationOptions` interface (unified for both create and update operations)
   - Exported from `@mcp-abap-adt/interfaces` package
   - Uses "Object" terminology which is accurate for ADT context (ABAP objects)

3. **AdtClient** (`src/clients/AdtClient.ts`)
   - High-level client that returns IAdtObject instances
   - Factory methods for each object type (`getClass()`, `getProgram()`, etc.)
   - Maintains connection and logger context

### Session Management Rules

**CRITICAL: These rules MUST be followed in ALL CRUD classes**

1. **stateful session:**
   - **ONLY** set before `lock` operations
   - **NEVER** set for `create`, `delete`, `activate`, `validate`, `check`, `read` operations
   - **NEVER** set in cleanup blocks before `unlock` (we're already in stateful after lock)

2. **stateless session:**
   - **ALWAYS** set after `unlock` operations
   - **ALWAYS** set in cleanup blocks after `unlock` in error handlers
   - Set in `finally` blocks for `delete` operations (if stateful was set, but delete doesn't use lock/unlock, so no stateful needed)

3. **Operations that DO NOT need stateful:**
   - `validate()` - no stateful needed
   - `create()` - no stateful needed (unless it internally uses lock, but create itself doesn't)
   - `read()` - no stateful needed
   - `check()` - no stateful needed
   - `activate()` - no stateful needed (uses same session/cookies)
   - `delete()` - no stateful needed (if no lock/unlock involved)

4. **Operations that REQUIRE stateful:**
   - `lock()` - **MUST** set stateful before calling
   - `update()` - requires lock, so stateful is set before lock
   - `unlock()` - we're already in stateful after lock, just unlock and set stateless

5. **Correct pattern:**
   ```typescript
   // ✅ CORRECT: stateful ONLY before lock
   this.connection.setSessionType('stateful');
   lockHandle = await lockClass(this.connection, className);
   
   // ... operations while locked (still in stateful) ...
   
   // ✅ CORRECT: stateless MANDATORY after unlock
   await unlockClass(this.connection, className, lockHandle);
   this.connection.setSessionType('stateless');
   ```

6. **Incorrect patterns (NEVER DO THIS):**
   ```typescript
   // ❌ WRONG: stateful before create
   this.connection.setSessionType('stateful');
   await createClass(...);
   
   // ❌ WRONG: stateful before delete (if no lock/unlock)
   this.connection.setSessionType('stateful');
   await deleteClass(...);
   
   // ❌ WRONG: stateful before activate
   this.connection.setSessionType('stateful');
   await activateClass(...);
   
   // ❌ WRONG: stateful in cleanup before unlock (we're already in stateful)
   if (lockHandle) {
     this.connection.setSessionType('stateful'); // ❌ NOT NEEDED!
     await unlockClass(...);
   }
   ```

7. **Cleanup pattern:**
   ```typescript
   catch (error: any) {
     if (lockHandle) {
       try {
         // ✅ CORRECT: we're already in stateful after lock, just unlock and set stateless
         await unlockClass(this.connection, className, lockHandle);
         this.connection.setSessionType('stateless');
       } catch (unlockError) {
         // ...
       }
     } else {
       // ✅ CORRECT: if lock was not acquired, set stateless
       this.connection.setSessionType('stateless');
     }
   }
   ```

### Timeout Configuration Rules

**CRITICAL: These rules MUST be followed in ALL CRUD classes**

1. **Default timeout:**
   - **Default:** 1000 ms (1 second)
   - **Configurable:** via `timeout` option in `IAdtOperationOptions`

2. **Why timeouts are critical:**
   - Without timeouts, operations may fail due to system not completing commands in time
   - System may be slow or under load
   - Complex operations (activate, check) may take longer

3. **Usage:**
   ```typescript
   // Default timeout (1000 ms)
   await adtClass.create(config);
   
   // Custom timeout (5 seconds)
   await adtClass.create(config, { timeout: 5000 });
   
   // Custom timeout for update
   await adtClass.update(config, { timeout: 10000 });
   ```

4. **Implementation:**
   - All low-level function calls should use `options?.timeout || 1000` for timeout value
   - Pass timeout to `connection.makeAdtRequest({ timeout: ... })`
   - For operations without options, use default 1000 ms
   - Timeout applies to all operations in the chain (validate, create, check, lock, update, unlock, activate)

5. **Example implementation:**
   ```typescript
   const timeout = options?.timeout || 1000;
   await validateClassName(this.connection, config.className, { timeout });
   await createClass(this.connection, config, { timeout });
   // ... etc
   ```

## Operation Chains

### Create Operation Chain

```
validate() [no stateful, uses timeout from options or default 1000ms]
  → create() [no stateful, uses timeout from options or default 1000ms]
  → check() [no stateful, uses timeout from options or default 1000ms]
  → lock() [stateful ONLY before lock, uses timeout from options or default 1000ms]
  → check('inactive') [with code/xml for update] [stateful, uses timeout from options or default 1000ms]
  → update() [stateful, uses timeout from options or default 1000ms]
  → unlock() [stateful → stateless MANDATORY after unlock, uses timeout from options or default 1000ms]
  → check() [stateless, uses timeout from options or default 1000ms]
  → activate() [if activateOnCreate=true, no stateful needed, uses same session/cookies, uses timeout from options or default 1000ms]
  → return basic info without sourceCode if activated (object may not be ready)
```

**Error Handling:**
- If validation fails → stop, don't create
- If create fails → stop, no cleanup needed (object doesn't exist)
- If check fails after create → unlock (if locked), optionally delete (if `deleteOnFailure=true`)
- If update fails → unlock, optionally delete (if `deleteOnFailure=true`)
- If any operation locks the object → ensure unlock in finally block
- After activation, don't read source code (return basic info only)

### Update Operation Chain

```
lock() [stateful ONLY before lock, uses timeout from options or default 1000ms]
  → check('inactive') [with code/xml for update] [stateful, uses timeout from options or default 1000ms]
  → update() [stateful, uses timeout from options or default 1000ms]
  → unlock() [stateful → stateless MANDATORY after unlock, uses timeout from options or default 1000ms]
  → check() [stateless, uses timeout from options or default 1000ms]
  → activate() [if activateOnUpdate=true, no stateful needed, uses same session/cookies, uses timeout from options or default 1000ms]
  → return basic info without sourceCode if activated (object may not be ready)
```

**Error Handling:**
- Update always starts with lock (no external lockHandle in options)
- If lock fails → stop
- If check fails before update → unlock, optionally delete (if `deleteOnFailure=true`)
- If update fails → unlock, optionally delete (if `deleteOnFailure=true`)
- Always unlock in finally block if object was locked
- After activation, don't read source code (return basic info only)

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
    options?: IAdtOperationOptions
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
    options?: IAdtOperationOptions
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

### Options Interface

```typescript
export interface IAdtOperationOptions {
  /**
   * Activate object after creation (for create operations)
   * @default false
   */
  activateOnCreate?: boolean;

  /**
   * Activate object after update (for update operations)
   * @default false
   */
  activateOnUpdate?: boolean;

  /**
   * Delete object if operation fails
   * @default false
   */
  deleteOnFailure?: boolean;

  /**
   * Source code to use for update
   * Used in create operations for update after create, and in update operations
   */
  sourceCode?: string;

  /**
   * XML content to use for update
   * Used for objects that use XML format (e.g., Domain, DataElement)
   * Used in create operations for update after create, and in update operations
   */
  xmlContent?: string;

  /**
   * Timeout for operations in milliseconds
   * @default 1000 (1 second)
   * 
   * CRITICAL: Without timeouts, operations may fail due to system not completing commands in time.
   * Increase timeout for complex operations or slow systems.
   * 
   * Example: timeout: 5000 for 5 seconds
   */
  timeout?: number;
}
```

**Note:** `IAdtOperationOptions` is a unified interface for both create and update operations. The `sourceCode` and `xmlContent` fields are available for both create (for update after create) and update operations.

## Implementation Strategy

### Object CRUD Classes

Each object CRUD class will:

1. **Use Low-Level Functions Directly**
   - Use low-level functions from `src/core/{entity}/*.ts` modules directly
   - Compose operation chains
   - Handle session state management explicitly
   - Accept connection and logger in constructor
   - No Builder classes used internally

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
16. **UnitTest** (`AdtUnitTest`)
17. **Request** (`AdtRequest`) - Transport Request

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
  getUnitTest(): IAdtObject<UnitTestBuilderConfig, UnitTestBuilderConfig>;
  getRequest(): IAdtObject<RequestBuilderConfig, RequestBuilderConfig>;
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
- [x] Create unified `IAdtOperationOptions` interface (replaces separate `CreateOptions` and `UpdateOptions`)
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
  - [x] Use low-level functions directly (not Builder classes)
  - [x] Proper session management (stateful only for lock/update/unlock, stateless after unlock)
  - [x] After activation, return basic info without reading source code (object may not be ready)
  - [x] Unified `CreateOptions` and `UpdateOptions` into `IAdtOperationOptions` interface
  - [x] Added `sourceCode` and `xmlContent` to update operations (via `IAdtOperationOptions`)
  - [x] Removed `lockHandle` from update options (update always starts with lock internally)
- [ ] Test create chain with all error scenarios
- [ ] Test update chain with all error scenarios
- [ ] Test delete operation
- [ ] Document patterns and best practices

### Phase 3: Object CRUD Classes
- [x] Implement `AdtClass` as reference (completed in Phase 2)
- [x] Implement CRUD classes for remaining object types:
  - [x] Implement `AdtProgram` in `src/core/program/AdtProgram.ts`
  - [x] Implement `AdtInterface` in `src/core/interface/AdtInterface.ts`
  - [x] Implement `AdtDomain` in `src/core/domain/AdtDomain.ts`
  - [x] Implement `AdtDataElement` in `src/core/dataElement/AdtDataElement.ts`
  - [x] `AdtStructure` in `src/core/structure/AdtStructure.ts`
  - [x] `AdtTable` in `src/core/table/AdtTable.ts`
  - [x] `AdtView` in `src/core/view/AdtView.ts`
  - [x] `AdtFunctionGroup` in `src/core/functionGroup/AdtFunctionGroup.ts`
  - [x] `AdtFunctionModule` in `src/core/functionModule/AdtFunctionModule.ts`
  - [x] `AdtPackage` in `src/core/package/AdtPackage.ts`
  - [x] `AdtServiceDefinition` in `src/core/serviceDefinition/AdtServiceDefinition.ts`
  - [x] `AdtBehaviorDefinition` in `src/core/behaviorDefinition/AdtBehaviorDefinition.ts`
  - [x] `AdtBehaviorImplementation` in `src/core/behaviorImplementation/AdtBehaviorImplementation.ts`
  - [x] `AdtMetadataExtension` in `src/core/metadataExtension/AdtMetadataExtension.ts`
  - [ ] `AdtUnitTest` in `src/core/unitTest/AdtUnitTest.ts`
  - [ ] `AdtRequest` (Transport Request) in `src/core/transport/AdtRequest.ts`
- [x] Add operation stubs for unsupported operations (Package.activate() returns error)
- [x] Ensure consistent error handling across all objects (all use logErrorSafely, try-catch-finally for cleanup)

### Phase 4: Integration
- [x] Complete `AdtClient` with factory method for Class (`getClass()`)
- [x] Complete `AdtClient` with factory methods for Program, Interface, Domain (`getProgram()`, `getInterface()`, `getDomain()`)
- [x] Complete `AdtClient` with factory method for DataElement (`getDataElement()`)
- [x] Complete `AdtClient` with factory methods for Structure, Table, View (`getStructure()`, `getTable()`, `getView()`)
- [x] Complete `AdtClient` with factory methods for FunctionGroup, FunctionModule (`getFunctionGroup()`, `getFunctionModule()`)
- [x] Complete `AdtClient` with factory method for Package (`getPackage()`)
- [x] Complete `AdtClient` with factory methods for ServiceDefinition, BehaviorDefinition, BehaviorImplementation, MetadataExtension (`getServiceDefinition()`, `getBehaviorDefinition()`, `getBehaviorImplementation()`, `getMetadataExtension()`)
- [ ] Complete `AdtClient` with factory methods for UnitTest and Request (`getUnitTest()`, `getRequest()`)
- [x] Export new classes from index files (`src/core/program/index.ts`, `src/core/interface/index.ts`, `src/core/domain/index.ts`, `src/core/dataElement/index.ts`, `src/core/structure/index.ts`, `src/core/table/index.ts`, `src/core/view/index.ts`, `src/core/functionGroup/index.ts`, `src/core/functionModule/index.ts`, `src/core/package/index.ts`, `src/core/serviceDefinition/index.ts`, `src/core/behaviorDefinition/index.ts`, `src/core/behaviorImplementation/index.ts`, `src/core/metadataExtension/index.ts`)
- [ ] Export new classes from index files for UnitTest and Request (`src/core/unitTest/index.ts`, `src/core/transport/index.ts`)
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Add usage examples with clean API

## Naming Conventions

### Classes
- Object CRUD classes: `Adt{Entity}` (e.g., `AdtClass`, `AdtDomain`)
- High-level client: `AdtClient`

### Files
- CRUD class: `src/core/{entity}/Adt{Entity}.ts` (e.g., `src/core/class/AdtClass.ts`)
- Interface: `@mcp-abap-adt/interfaces/src/adt/IAdtObject.ts` (in interfaces package)
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

**CRITICAL SESSION MANAGEMENT RULES:**
- `stateful` ONLY before `lock`
- `stateless` MANDATORY after `unlock`
- If no lock/unlock, then stateful is NOT needed

```typescript
let lockHandle: string | undefined;
try {
  // ✅ CORRECT: stateful ONLY before lock
  connection.setSessionType('stateful');
  lockHandle = await lockClass(connection, className);
  // ... operations (still in stateful)
} finally {
  if (lockHandle) {
    try {
      // ✅ CORRECT: we're already in stateful after lock, just unlock and set stateless
      // DO NOT set stateful here - we're already in stateful!
      await unlockClass(connection, className, lockHandle);
      connection.setSessionType('stateless');
    } catch (unlockError) {
      logger.warn?.('Failed to unlock during cleanup:', unlockError);
    }
  } else {
    // ✅ CORRECT: if lock was not acquired, set stateless
    connection.setSessionType('stateless');
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
