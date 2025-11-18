# CheckRun Usage Analysis

## Overview

This document analyzes the differences in how `checkRun` is used across different object types in the codebase.

## Common Pattern: Using `runCheckRun` Helper

Most object types use the shared `runCheckRun` function from `shared/checkRun.ts`:

### Objects Using `runCheckRun`:
- ✅ **Domain** (`domain/check.ts`)
- ✅ **Class** (`class/check.ts`)
- ✅ **Program** (`program/check.ts`)
- ✅ **DataElement** (`dataElement/check.ts`)
- ✅ **Interface** (assumed, follows same pattern)
- ✅ **Structure** (assumed, follows same pattern)
- ✅ **Table** (assumed, follows same pattern)
- ✅ **View** (assumed, follows same pattern)

### Custom Implementation:
- ⚠️ **FunctionModule** (`functionModule/check.ts`) - Has its own implementation

---

## Differences in Function Signatures

### 1. Domain Check

```typescript
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  sessionId: string,        // ⚠️ REQUIRED (not optional)
  version: string = 'new'  // ⚠️ Default: 'new' (for newly created objects)
): Promise<AxiosResponse>
```

**Key differences:**
- `sessionId` is **required** (not optional)
- Default `version` is `'new'` (for newly created domains before activation)
- Error handling: `if (!checkResult.success && checkResult.has_errors)`

### 2. Class Check

```typescript
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'inactive' | 'active' = 'active',  // ⚠️ Default: 'active'
  sessionId?: string                           // ⚠️ Optional
): Promise<AxiosResponse>
```

**Key differences:**
- `sessionId` is **optional**
- Default `version` is `'active'` (for activated objects)
- Error handling: `if (!checkResult.success || checkResult.has_errors)` (more strict)

### 3. Program Check

```typescript
export async function checkProgram(
  connection: AbapConnection,
  programName: string,
  version: string = 'active',  // ⚠️ Default: 'active'
  sessionId?: string            // ⚠️ Optional
): Promise<AxiosResponse>
```

**Key differences:**
- `sessionId` is **optional**
- Default `version` is `'active'`
- Error handling: `if (!checkResult.success && checkResult.has_errors)`

### 4. DataElement Check

```typescript
export async function checkDataElement(
  connection: AbapConnection,
  dataElementName: string,
  version: string = 'active',  // ⚠️ Default: 'active'
  sessionId?: string            // ⚠️ Optional
): Promise<AxiosResponse>
```

**Key differences:**
- `sessionId` is **optional**
- Default `version` is `'active'`
- Error handling: `if (!checkResult.success && checkResult.has_errors)`

### 5. FunctionModule Check (Custom Implementation)

```typescript
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: string = 'active',  // ⚠️ Default: 'active'
  sessionId?: string            // ⚠️ Optional
): Promise<AxiosResponse>
```

**Key differences:**
- **Does NOT use `runCheckRun`** - has custom implementation
- Builds XML manually using `buildCheckRunXml` function
- Handles session manually (checks if `sessionId` exists)
- `sessionId` is **optional**
- Default `version` is `'active'`
- Error handling: `if (!checkResult.success && checkResult.has_errors)`

---

## Error Handling Differences

### Pattern 1: `&&` (Less Strict)
Used by: Domain, Program, DataElement, FunctionModule

```typescript
if (!checkResult.success && checkResult.has_errors) {
  throw new Error(`Check failed: ${checkResult.message}`);
}
```

**Behavior:** Only throws if BOTH conditions are true:
- `checkResult.success` is false **AND**
- `checkResult.has_errors` is true

### Pattern 2: `||` (More Strict)
Used by: Class

```typescript
if (!checkResult.success || checkResult.has_errors) {
  throw new Error(`Class check failed: ${checkResult.message}`);
}
```

**Behavior:** Throws if EITHER condition is true:
- `checkResult.success` is false **OR**
- `checkResult.has_errors` is true

---

## Version Parameter Differences

### Default: `'new'`
- **Domain** - Used for newly created domains before activation

### Default: `'active'`
- **Class** - Checks activated version
- **Program** - Checks activated version
- **DataElement** - Checks activated version
- **FunctionModule** - Checks activated version

### Rationale
- **Domain**: Typically checked immediately after creation (before activation), so `'new'` makes sense
- **Other objects**: Typically checked after activation or for existing objects, so `'active'` makes sense

---

## SessionId Parameter Differences

### Required (Domain)
- **Domain** requires `sessionId` because domain operations are typically part of a workflow that includes:
  1. Create empty domain
  2. Lock domain
  3. Update domain with data
  4. Check domain syntax
  5. Unlock domain
  6. Activate domain

All these steps use the same session, so `sessionId` is required.

### Optional (Others)
- **Class, Program, DataElement, FunctionModule** have optional `sessionId` because:
  - They can be checked independently (not necessarily part of a multi-step workflow)
  - They can be checked for existing objects without needing a session

---

## FunctionModule Custom Implementation

FunctionModule doesn't use `runCheckRun` because it needs to handle the function group + function module relationship:

```typescript
// Custom XML building
function buildCheckRunXml(functionGroupName: string, functionModuleName: string, version: string): string {
  const encodedGroup = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModule = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;
  // ... builds XML manually
}
```

The `runCheckRun` helper's `getObjectUri` function does support function modules, but FunctionModule check was implemented before that support was added, or the custom implementation provides more control.

---

## Recommendations

### 1. Consistency in Error Handling
Consider standardizing error handling across all check functions:
- Option A: Use `&&` (less strict) - only throw if both conditions are true
- Option B: Use `||` (more strict) - throw if either condition is true

**Recommendation:** Use `&&` for consistency with most implementations, unless stricter validation is needed.

### 2. SessionId Parameter
Consider making `sessionId` optional for Domain check as well, with a fallback to generate a new session if not provided:

```typescript
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  sessionId?: string,  // Make optional
  version: string = 'new'
): Promise<AxiosResponse> {
  const finalSessionId = sessionId || generateSessionId();
  // ... rest of implementation
}
```

**Recommendation:** Keep as-is for Domain (required) since it's part of a workflow, but document why it's required.

### 3. FunctionModule Implementation
Consider refactoring FunctionModule to use `runCheckRun` for consistency:

```typescript
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: string = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  // Use format: "functionGroupName/functionModuleName"
  const objectName = `${functionGroupName}/${functionModuleName}`;
  return runCheckRun(connection, 'function_module', objectName, version, 'abapCheckRun', sessionId);
}
```

**Recommendation:** Keep custom implementation if it provides better error handling or control, but document why it's different.

---

## Summary Table

| Object Type | Uses `runCheckRun` | `sessionId` | Default `version` | Error Handling |
|------------|-------------------|-------------|------------------|----------------|
| Domain | ✅ Yes | Required | `'new'` | `&&` (less strict) |
| Class | ✅ Yes | Optional | `'active'` | `\|\|` (more strict) |
| Program | ✅ Yes | Optional | `'active'` | `&&` (less strict) |
| DataElement | ✅ Yes | Optional | `'active'` | `&&` (less strict) |
| FunctionModule | ❌ No (custom) | Optional | `'active'` | `&&` (less strict) |

---

## Test Implications

When writing tests for check functions:

1. **Domain check test:**
   - Must provide `sessionId` (required)
   - Use `version: 'new'` for newly created domains
   - Verify `response.status` and `response.data`

2. **Class/Program/DataElement check tests:**
   - `sessionId` is optional (can omit)
   - Use `version: 'active'` for activated objects
   - Verify `response.status === 'ok'` (if using parseCheckRunResponse)

3. **FunctionModule check test:**
   - `sessionId` is optional
   - Use `version: 'active'`
   - Verify `response.status === 'ok'`

---

## References

- `src/core/shared/checkRun.ts` - Shared check run utilities
- `src/core/domain/check.ts` - Domain check implementation
- `src/core/class/check.ts` - Class check implementation
- `src/core/program/check.ts` - Program check implementation
- `src/core/dataElement/check.ts` - DataElement check implementation
- `src/core/functionModule/check.ts` - FunctionModule check implementation

