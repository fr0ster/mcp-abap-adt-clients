# Check and Validation Improvements Proposal

## Current Issues

### 1. Version Parameter Inconsistency
- **Domain check** uses `version: 'new'` (incorrect - should be `'active'` or `'inactive'`)
- **Other objects** use `version: 'active'` as default
- Version should be **explicitly required** (no default) to make intent clear

### 2. Check vs Validation Confusion
- **Check** (checkRun) - validates **code syntax** of existing or hypothetical objects
- **Validation** - validates **object name** before creation (POST `/sap/bc/adt/functions/validation`)
- These are different operations but sometimes mixed

### 3. Source Code Support
- **Classes** can check hypothetical code without creating object (using `runCheckRunWithSource`)
- **FunctionModules** have separate validation endpoint for name validation
- Not all check functions support optional source code parameter

---

## Proposed Improvements

### 1. Standardize Check Function Signatures

#### Current Domain Check (INCORRECT):
```typescript
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  sessionId: string,
  version: string = 'new'  // ❌ 'new' is not a valid version
): Promise<AxiosResponse>
```

#### Proposed Domain Check:
```typescript
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  version: 'active' | 'inactive',  // ✅ Explicit, required
  sessionId: string
): Promise<AxiosResponse>
```

**Rationale:**
- `'active'` = check activated version (existing object)
- `'inactive'` = check inactive version (saved but not activated)
- No `'new'` version - use `'inactive'` for newly created objects

---

### 2. Add Optional Source Code to Class Check

#### Current Class Check:
```typescript
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse>
```

#### Proposed Class Check:
```typescript
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive',  // ✅ Explicit, required
  sourceCode?: string,              // ✅ Optional: check hypothetical code
  sessionId?: string
): Promise<AxiosResponse>
```

**Behavior:**
- If `sourceCode` provided: validates hypothetical code (object doesn't need to exist)
- If `sourceCode` omitted: validates existing object in SAP system
- Uses `runCheckRunWithSource` when code provided, `runCheckRun` otherwise

---

### 3. Standardize All Check Functions

All check functions should follow this pattern:

```typescript
export async function check{ObjectType}(
  connection: AbapConnection,
  objectName: string,
  version: 'active' | 'inactive',  // ✅ Required, explicit
  sourceCode?: string,              // ✅ Optional (only for classes)
  sessionId?: string                // ✅ Optional (required for domain)
): Promise<AxiosResponse>
```

**Exceptions:**
- **Domain**: `sessionId` is required (part of workflow)
- **FunctionModule**: Takes `functionGroupName` and `functionModuleName` separately
- **Classes**: Only type that supports `sourceCode` parameter

---

### 4. Clarify Check vs Validation

#### Check (checkRun) - Code Syntax Validation
- **Purpose**: Validates code syntax
- **Endpoint**: `POST /sap/bc/adt/checkruns?reporters=abapCheckRun`
- **When to use**: 
  - After creating/updating object (check `'inactive'` version)
  - After activating object (check `'active'` version)
  - Before creating object (for classes, with hypothetical code)

#### Validation - Name Validation
- **Purpose**: Validates object name before creation
- **Endpoint**: `POST /sap/bc/adt/functions/validation?objtype=...&objname=...`
- **When to use**: Before creating object to check if name is valid
- **Supported for**: FunctionModules, Classes, and other objects

**Example for FunctionModule:**
```typescript
// Validation - check name before creation
const validationResult = await validateFunctionModuleName(
  connection,
  functionGroupName,
  functionModuleName,
  description
);

// Check - validate code syntax after creation
const checkResult = await checkFunctionModule(
  connection,
  functionGroupName,
  functionModuleName,
  'inactive',  // Check inactive version
  sessionId
);
```

---

## Implementation Plan

### Phase 1: Fix Domain Check
1. Change `checkDomainSyntax` signature:
   - Remove default `version = 'new'`
   - Make `version: 'active' | 'inactive'` required
   - Update all callers to pass explicit version

### Phase 2: Enhance Class Check
1. Add optional `sourceCode` parameter to `checkClass`
2. Implement logic:
   ```typescript
   if (sourceCode) {
     return runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
   } else {
     return runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
   }
   ```

### Phase 3: Standardize All Check Functions
1. Update all check functions to require explicit `version`
2. Remove default values for `version` parameter
3. Update documentation

### Phase 4: Update Tests
1. Update domain check test to use `'inactive'` instead of `'new'`
2. Add test for class check with hypothetical code
3. Verify all tests use explicit version

---

## Updated Function Signatures

### Domain
```typescript
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  version: 'active' | 'inactive',  // Required
  sessionId: string                // Required
): Promise<AxiosResponse>
```

### Class
```typescript
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive',  // Required
  sourceCode?: string,              // Optional: check hypothetical code
  sessionId?: string                // Optional
): Promise<AxiosResponse>
```

### Program
```typescript
export async function checkProgram(
  connection: AbapConnection,
  programName: string,
  version: 'active' | 'inactive',  // Required
  sessionId?: string                // Optional
): Promise<AxiosResponse>
```

### DataElement
```typescript
export async function checkDataElement(
  connection: AbapConnection,
  dataElementName: string,
  version: 'active' | 'inactive',  // Required
  sessionId?: string                // Optional
): Promise<AxiosResponse>
```

### FunctionModule
```typescript
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: 'active' | 'inactive',  // Required
  sessionId?: string                // Optional
): Promise<AxiosResponse>
```

---

## Migration Guide

### Before (Domain):
```typescript
await checkDomainSyntax(connection, 'Z_TEST_DOMAIN', sessionId);  // Uses default 'new'
```

### After (Domain):
```typescript
await checkDomainSyntax(connection, 'Z_TEST_DOMAIN', 'inactive', sessionId);  // Explicit version
```

### Before (Class):
```typescript
await checkClass(connection, 'ZCL_TEST');  // Uses default 'active'
```

### After (Class):
```typescript
// Check existing class
await checkClass(connection, 'ZCL_TEST', 'active');

// Check hypothetical code (object doesn't exist)
await checkClass(connection, 'ZCL_NEW', 'active', hypotheticalSourceCode);
```

---

## Benefits

1. **Clarity**: Explicit version makes intent clear
2. **Consistency**: All check functions follow same pattern
3. **Flexibility**: Classes can check hypothetical code
4. **Correctness**: No invalid `'new'` version
5. **Type Safety**: TypeScript enforces `'active' | 'inactive'`

---

## Backward Compatibility

⚠️ **Breaking Changes:**
- Domain check: `version` parameter becomes required (was optional with default `'new'`)
- All check functions: `version` parameter becomes required (was optional with default `'active'`)

**Migration Strategy:**
1. Update all internal callers first
2. Update public API documentation
3. Release as major version bump (if this is public API)

---

## References

- `src/core/shared/checkRun.ts` - Shared check run utilities
- `src/core/domain/check.ts` - Domain check (needs update)
- `src/core/class/check.ts` - Class check (needs enhancement)
- `src/core/functionModule/validation.ts` - FunctionModule validation
- `src/core/shared/validation.ts` - Shared validation utilities

