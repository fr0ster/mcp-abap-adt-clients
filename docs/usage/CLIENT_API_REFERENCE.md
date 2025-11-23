# Client API Reference

Complete reference for `ReadOnlyClient` and `CrudClient` classes.

## Table of Contents

- [ReadOnlyClient](#readonlyclient)
  - [Read Operations](#read-operations)
  - [State Management](#readonly-state-management)
- [CrudClient](#crudclient)
  - [Create Operations](#create-operations)
  - [Lock Operations](#lock-operations)
  - [Unlock Operations](#unlock-operations)
  - [Update Operations](#update-operations)
  - [Activate Operations](#activate-operations)
  - [Delete Operations](#delete-operations)
  - [Check Operations](#check-operations)
  - [Validation Operations](#validation-operations)
  - [State Management](#crud-state-management)
  - [Shared Operations](#shared-operations)

---

## ReadOnlyClient

Read-only access to SAP ADT objects. All methods return `Promise<AxiosResponse>`.

### Constructor

```typescript
import { ReadOnlyClient } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection({...}, console);
const client = new ReadOnlyClient(connection);
```

### Read Operations

#### Program Operations
```typescript
readProgram(name: string): Promise<AxiosResponse>
```
Read ABAP program source code.

**Example:**
```typescript
const response = await client.readProgram('Z_MY_REPORT');
console.log(response.data); // Program source code
```

#### Class Operations
```typescript
readClass(name: string): Promise<AxiosResponse>
```
Read ABAP class source code.

**Example:**
```typescript
const response = await client.readClass('ZCL_MY_CLASS');
```

#### Interface Operations
```typescript
readInterface(name: string): Promise<AxiosResponse>
```
Read ABAP interface source code.

**Example:**
```typescript
const response = await client.readInterface('ZIF_MY_INTERFACE');
```

#### Data Dictionary Operations
```typescript
readDataElement(name: string): Promise<AxiosResponse>
readDomain(name: string): Promise<AxiosResponse>
readStructure(name: string): Promise<AxiosResponse>
readTable(name: string): Promise<AxiosResponse>
```

Read data dictionary objects (data elements, domains, structures, tables).

**Example:**
```typescript
const dtel = await client.readDataElement('Z_MY_DTEL');
const domain = await client.readDomain('Z_MY_DOMAIN');
const structure = await client.readStructure('Z_MY_STRUCTURE');
const table = await client.readTable('Z_MY_TABLE');
```

#### View Operations
```typescript
readView(name: string): Promise<AxiosResponse>
```
Read CDS view or classic view source.

**Example:**
```typescript
const response = await client.readView('Z_MY_CDS_VIEW');
```

#### Function Module Operations
```typescript
readFunctionGroup(name: string): Promise<AxiosResponse>
readFunctionModule(name: string, functionGroup: string): Promise<AxiosResponse>
```

Read function groups and function modules.

**Example:**
```typescript
const group = await client.readFunctionGroup('Z_MY_FUNCTION_GROUP');
const module = await client.readFunctionModule('Z_MY_FUNCTION', 'Z_MY_FUNCTION_GROUP');
```

#### Package Operations
```typescript
readPackage(name: string): Promise<AxiosResponse>
```

Read package metadata.

**Example:**
```typescript
const response = await client.readPackage('Z_MY_PACKAGE');
```

#### Transport Operations
```typescript
readTransport(transportRequest: string): Promise<AxiosResponse>
```

Read transport request details.

**Example:**
```typescript
const response = await client.readTransport('NPLK900123');
```

### ReadOnly State Management

```typescript
getReadResult(): AxiosResponse | undefined
```

Get the last read operation result.

**Example:**
```typescript
await client.readProgram('Z_MY_REPORT');
const result = client.getReadResult();
console.log(result?.status); // 200
```

---

## CrudClient

Full CRUD operations extending `ReadOnlyClient`. All methods return `Promise<this>` for chaining.

### Constructor

```typescript
import { CrudClient } from '@mcp-abap-adt/adt-clients';

const connection = createAbapConnection({...}, console);
const client = new CrudClient(connection);
```

### Create Operations

All create methods follow this pattern:
```typescript
create<ObjectType>(
  name: string,
  description: string,
  packageName: string,
  transportRequest?: string,
  options?: { ... }
): Promise<this>
```

#### Available Create Methods

```typescript
// Programs
createProgram(name, description, packageName, transportRequest?, options?: {
  masterSystem?: string;
  responsible?: string;
  programType?: string;
  application?: string;
}): Promise<this>

// Classes
createClass(name, description, packageName, transportRequest?, options?: {
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  createProtected?: boolean;
}): Promise<this>

// Interfaces
createInterface(name, description, packageName, transportRequest?, options?: {
  masterSystem?: string;
  responsible?: string;
}): Promise<this>

// Data Dictionary
createDataElement(name, description, packageName, transportRequest?, options?: {
  domainName?: string;
  dataType?: string;
  length?: number;
  decimals?: number;
  shortLabel?: string;
  mediumLabel?: string;
  longLabel?: string;
  headingLabel?: string;
}): Promise<this>

createDomain(name, description, packageName, transportRequest?, options?: {
  datatype?: string;
  length?: number;
  decimals?: number;
  lowercase?: boolean;
}): Promise<this>

createStructure(name, description, packageName, transportRequest?, options?: {
  ddlCode?: string;
}): Promise<this>

createTable(name, packageName, transportRequest?, options?: {
  ddlCode?: string;
}): Promise<this>

createView(name, description, packageName, transportRequest?, options?: {
  ddlSource?: string;
}): Promise<this>

// Function Modules
createFunctionGroup(name, description, packageName, transportRequest?): Promise<this>

createFunctionModule(
  name: string,
  functionGroup: string,
  description: string,
  packageName: string,
  transportRequest?: string,
  options?: { sourceCode?: string }
): Promise<this>

// Package
createPackage(
  name: string,
  description: string,
  superPackage: string,
  transportRequest?: string,
  options?: {
    packageType?: string;
    softwareComponent?: string;
    transportLayer?: string;
  }
): Promise<this>

// Transport
createTransport(description: string, options?: {
  transportType?: 'workbench' | 'customizing';
  targetSystem?: string;
}): Promise<this>
```

**Example:**
```typescript
await client
  .createClass('ZCL_TEST', 'Test Class', 'Z_PACKAGE', 'NPLK900123', {
    superclass: 'CL_ABAP_OBJECT',
    final: false
  })
  .lockClass('ZCL_TEST')
  .updateClass('ZCL_TEST', sourceCode)
  .unlockClass('ZCL_TEST')
  .activateClass('ZCL_TEST');

console.log(client.getCreateResult());
console.log(client.getActivateResult());
```

### Lock Operations

All lock methods follow this pattern:
```typescript
lock<ObjectType>(name: string): Promise<this>
```

Locks are automatically stored in `CrudClient` state and accessible via `getLockHandle()`.

#### Available Lock Methods

```typescript
lockProgram(name: string): Promise<this>
lockClass(name: string): Promise<this>
lockInterface(name: string): Promise<this>
lockDataElement(name: string): Promise<this>
lockDomain(name: string): Promise<this>
lockStructure(name: string): Promise<this>
lockTable(name: string): Promise<this>
lockView(name: string): Promise<this>
lockFunctionGroup(name: string): Promise<this>
lockFunctionModule(name: string, functionGroup: string): Promise<this>
lockPackage(name: string): Promise<this>
```

**Example:**
```typescript
await client.lockClass('ZCL_MY_CLASS');
const lockHandle = client.getLockHandle();
console.log('Lock handle:', lockHandle);
```

### Unlock Operations

All unlock methods follow this pattern:
```typescript
unlock<ObjectType>(name: string, lockHandle?: string): Promise<this>
```

If `lockHandle` is not provided, uses the handle from state (set by previous `lock*` call).

#### Available Unlock Methods

```typescript
unlockProgram(name: string, lockHandle?: string): Promise<this>
unlockClass(name: string, lockHandle?: string): Promise<this>
unlockInterface(name: string, lockHandle?: string): Promise<this>
unlockDataElement(name: string, lockHandle?: string): Promise<this>
unlockDomain(name: string, lockHandle?: string): Promise<this>
unlockStructure(name: string, lockHandle?: string): Promise<this>
unlockTable(name: string, lockHandle?: string): Promise<this>
unlockView(name: string, lockHandle?: string): Promise<this>
unlockFunctionGroup(name: string, lockHandle?: string): Promise<this>
unlockFunctionModule(name: string, functionGroup: string, lockHandle?: string): Promise<this>
unlockPackage(name: string, lockHandle?: string): Promise<this>
```

**Example:**
```typescript
// Automatic lock handle from state
await client.lockClass('ZCL_MY_CLASS');
await client.unlockClass('ZCL_MY_CLASS'); // Uses stored lock handle

// Explicit lock handle
await client.unlockClass('ZCL_MY_CLASS', 'specific-lock-handle-123');
```

### Update Operations

All update methods follow this pattern:
```typescript
update<ObjectType>(name: string, sourceCode: string, lockHandle?: string): Promise<this>
```

#### Available Update Methods

```typescript
updateProgram(name: string, sourceCode: string, lockHandle?: string): Promise<this>
updateClass(name: string, sourceCode: string, lockHandle?: string): Promise<this>
updateInterface(name: string, sourceCode: string, lockHandle?: string): Promise<this>
updateDataElement(name: string, metadata: object, lockHandle?: string): Promise<this>
updateDomain(name: string, metadata: object, lockHandle?: string): Promise<this>
updateStructure(name: string, ddlCode: string, lockHandle?: string): Promise<this>
updateTable(name: string, ddlCode: string, lockHandle?: string): Promise<this>
updateView(name: string, ddlSource: string, lockHandle?: string): Promise<this>
updateFunctionModule(name: string, functionGroup: string, sourceCode: string, lockHandle?: string): Promise<this>
updatePackage(name: string, description: string, lockHandle?: string): Promise<this>
```

**Example:**
```typescript
const sourceCode = `CLASS zcl_test DEFINITION PUBLIC.
  PUBLIC SECTION.
    METHODS: test.
ENDCLASS.

CLASS zcl_test IMPLEMENTATION.
  METHOD test.
    WRITE: 'Hello World'.
  ENDMETHOD.
ENDCLASS.`;

await client
  .lockClass('ZCL_TEST')
  .updateClass('ZCL_TEST', sourceCode)
  .unlockClass('ZCL_TEST');
```

### Activate Operations

All activate methods follow this pattern:
```typescript
activate<ObjectType>(name: string): Promise<this>
```

#### Available Activate Methods

```typescript
activateProgram(name: string): Promise<this>
activateClass(name: string): Promise<this>
activateInterface(name: string): Promise<this>
activateDataElement(name: string): Promise<this>
activateDomain(name: string): Promise<this>
activateStructure(name: string): Promise<this>
activateTable(name: string): Promise<this>
activateView(name: string): Promise<this>
activateFunctionGroup(name: string): Promise<this>
activateFunctionModule(name: string, functionGroup: string): Promise<this>
activatePackage(name: string): Promise<this>
```

**Example:**
```typescript
await client
  .updateClass('ZCL_TEST', sourceCode)
  .activateClass('ZCL_TEST');

const activationResult = client.getActivateResult();
console.log('Activation status:', activationResult?.status);
```

### Delete Operations

All delete methods follow this pattern:
```typescript
delete<ObjectType>(name: string, transportRequest?: string): Promise<this>
```

#### Available Delete Methods

```typescript
deleteProgram(name: string, transportRequest?: string): Promise<this>
deleteClass(name: string, transportRequest?: string): Promise<this>
deleteInterface(name: string, transportRequest?: string): Promise<this>
deleteDataElement(name: string, transportRequest?: string): Promise<this>
deleteDomain(name: string, transportRequest?: string): Promise<this>
deleteStructure(name: string, transportRequest?: string): Promise<this>
deleteTable(name: string, transportRequest?: string): Promise<this>
deleteView(name: string, transportRequest?: string): Promise<this>
deleteFunctionGroup(name: string, transportRequest?: string): Promise<this>
deleteFunctionModule(name: string, functionGroup: string, transportRequest?: string): Promise<this>
deletePackage(name: string, transportRequest?: string): Promise<this>
```

**Example:**
```typescript
await client.deleteClass('ZCL_TEST', 'NPLK900123');
console.log(client.getDeleteResult());
```

### Check Operations

```typescript
checkProgram(name: string, version?: string): Promise<this>
checkClass(name: string, version?: string): Promise<this>
// ... similar for other object types
```

Performs syntax/consistency check on the object.

**Example:**
```typescript
await client.checkClass('ZCL_TEST');
const checkResult = client.getCheckResult();
```

### Validation Operations

```typescript
validateProgramName(name: string): Promise<this>
validateClassName(name: string): Promise<this>
// ... similar for other object types
```

Validates object name against SAP naming rules.

**Example:**
```typescript
await client.validateClassName('ZCL_TEST');
const validation = client.getValidationResult();
console.log('Valid:', validation.valid);
```

### CRUD State Management

```typescript
// Getters for CRUD state
getCreateResult(): AxiosResponse | undefined
getLockHandle(): string | undefined
getUnlockResult(): AxiosResponse | undefined
getUpdateResult(): AxiosResponse | undefined
getActivateResult(): AxiosResponse | undefined
getDeleteResult(): AxiosResponse | undefined
getCheckResult(): AxiosResponse | undefined
getValidationResult(): any | undefined

// Inherited from ReadOnlyClient
getReadResult(): AxiosResponse | undefined
```

**Example:**
```typescript
await client
  .createClass('ZCL_TEST', 'Test', 'Z_PKG', 'NPLK900123')
  .lockClass('ZCL_TEST')
  .updateClass('ZCL_TEST', sourceCode)
  .unlockClass('ZCL_TEST')
  .activateClass('ZCL_TEST');

// Access all results
console.log('Created:', client.getCreateResult()?.status);
console.log('Lock handle:', client.getLockHandle());
console.log('Updated:', client.getUpdateResult()?.status);
console.log('Unlocked:', client.getUnlockResult()?.status);
console.log('Activated:', client.getActivateResult()?.status);
```

### Shared Operations

CrudClient also provides access to shared cross-cutting operations:

```typescript
// Get inactive objects
getInactiveObjects(): Promise<this>

// Activate multiple objects
activateObjectsGroup(objects: Array<{ type: string; name: string }>): Promise<this>

// Search objects
searchObjects(query: string, params?: SearchObjectsParams): Promise<this>

// Get table contents
getTableContents(tableName: string, params?: GetTableContentsParams): Promise<this>

// Execute SQL query
getSqlQuery(query: string, params?: GetSqlQueryParams): Promise<this>

// Get where-used list
getWhereUsed(objectName: string, params?: GetWhereUsedParams): Promise<this>
```

**Example:**
```typescript
// Get all inactive objects
await client.getInactiveObjects();
const inactive = client.getReadResult();

// Activate multiple objects
await client.activateObjectsGroup([
  { type: 'CLAS/OC', name: 'ZCL_CLASS1' },
  { type: 'PROG/P', name: 'Z_PROGRAM1' }
]);

// Search for objects
await client.searchObjects('Z_TEST*', { objectType: 'CLAS/OC', maxResults: 10 });
```

---

## Method Chaining

All `CrudClient` methods return `Promise<this>`, enabling fluent method chaining:

```typescript
await client
  .createInterface('ZIF_TEST', 'Test Interface', 'Z_PACKAGE', 'NPLK900123')
  .lockInterface('ZIF_TEST')
  .updateInterface('ZIF_TEST', interfaceCode)
  .checkInterface('ZIF_TEST')
  .unlockInterface('ZIF_TEST')
  .activateInterface('ZIF_TEST');

// Access results
console.log('Creation result:', client.getCreateResult());
console.log('Check result:', client.getCheckResult());
console.log('Activation result:', client.getActivateResult());
```

## Error Handling

All methods throw errors on failure. Use try/catch for error handling:

```typescript
try {
  await client
    .createClass('ZCL_TEST', 'Test', 'Z_PACKAGE')
    .lockClass('ZCL_TEST')
    .updateClass('ZCL_TEST', sourceCode)
    .unlockClass('ZCL_TEST')
    .activateClass('ZCL_TEST');
  
  console.log('Success!');
} catch (error) {
  console.error('Operation failed:', error);
  
  // Try to unlock if lock was acquired
  if (client.getLockHandle()) {
    await client.unlockClass('ZCL_TEST').catch(() => {});
  }
}
```

---

## See Also

- [Architecture Documentation](../architecture/ARCHITECTURE.md)
- [Stateful Session Guide](./STATEFUL_SESSION_GUIDE.md)
- [Debug Guide](./DEBUG.md)
- [Type System](../../README.md#type-system)
