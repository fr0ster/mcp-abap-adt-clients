# Check and Validation Methods - Detailed Proposal

## 📋 Important Concepts

### Check vs Validation - Key Differences

#### **Check (checkRun)** - Comprehensive Code Validation
- **Purpose**: Comprehensive validation of objects with code (syntax, compilation, rules, etc.)
- **Endpoint**: `POST /sap/bc/adt/checkruns?reporters=abapCheckRun`
- **What it checks**: Everything - syntax, compilation errors, warnings, code quality rules
- **Works with**: Objects that have code (Class, Program, FunctionModule, View, CDS, BDEF, etc.)
- **Does NOT work with**: DDIC objects without code (Domain, DataElement, Structure, Table - these don't have syntax)

#### **Validation** - Name Validation
- **Purpose**: Validates object name before creation
- **Endpoint**: `POST /sap/bc/adt/functions/validation?objtype=...&objname=...`
- **What it checks**: Name validity, naming conventions, conflicts, reserved names
- **Works with**: All object types (before creation)

### Objects with Code vs DDIC Objects

**Objects WITH code (have syntax):**
- Class (CLAS/OC)
- Program (PROG/P)
- FunctionModule (FUGR/FF)
- View (DDLS/DF)
- CDS Views
- BDEF (Behavior Definitions)
- Interface (INTF/IF)

**DDIC Objects WITHOUT code (no syntax):**
- Domain (DOMA/DD) - no syntax, only structure validation
- DataElement (DTEL) - no syntax, only structure validation
- Structure (STRU/DT) - no syntax, only structure validation
- Table (TABL/DT) - no syntax, only structure validation

**Note**: For DDIC objects, "check" validates structure/validity, NOT syntax.

## 📋 Current State Analysis

### Problems Identified

#### 1. **Version Parameter Issues**

**Problem:** Most check methods use `version: string = 'active'` with default value, but:
- Domain uses invalid `version: 'new'` (should be `'active'` or `'inactive'`)
- Default values hide the intent - should be explicit
- Version should be **required** to make it clear what is being checked

**Current State:**
```typescript
// ❌ Domain (WRONG - uses 'new')
checkDomainSyntax(connection, domainName, sessionId, version = 'new')

// ❌ Class (has default)
checkClass(connection, className, version: 'inactive' | 'active' = 'active', sessionId?)

// ❌ FunctionModule (has default)
checkFunctionModule(connection, fugrName, fmName, version: string = 'active', sessionId?)

// ❌ FunctionGroup (has default)
checkFunctionGroup(connection, fugrName, version: string = 'active', sessionId?)

// ❌ Program (has default)
checkProgram(connection, programName, version: string = 'active', sessionId?)

// ❌ DataElement (has default)
checkDataElement(connection, dataElementName, version: string = 'active', sessionId?)
```

#### 2. **Source Code Support Missing**

**Problem:** Classes can check hypothetical code (without creating object), but this is not exposed in the API.

**Current State:**
- `runCheckRunWithSource` exists in `shared/checkRun.ts`
- `validateClassSource` exists but uses different naming
- `checkClass` doesn't support optional source code parameter

**What's needed:**
- `checkClass` should accept optional `sourceCode` parameter
- If provided, validates hypothetical code (object doesn't need to exist)
- If omitted, validates existing object in SAP

#### 3. **Check vs Validation Confusion**

**Problem:** Two different operations are sometimes mixed:

1. **Check (checkRun)** - Validates **code syntax**
   - Endpoint: `POST /sap/bc/adt/checkruns?reporters=abapCheckRun`
   - Checks: syntax, compilation errors, warnings
   - Works with: existing objects OR hypothetical code (for classes)

2. **Validation** - Validates **object name** before creation
   - Endpoint: `POST /sap/bc/adt/functions/validation?objtype=...&objname=...`
   - Checks: name validity, naming conventions, conflicts
   - Works with: object names only (not code)

**Current State:**
- FunctionModule has both `checkFunctionModule` (check) and `validateFunctionModuleName` (validation) ✅
- Class has `checkClass` (check) and `validateClassName` (validation) ✅
- But naming is inconsistent

---

## 🎯 Proposed Solutions

### Solution 1: Standardize Check Method Signatures

#### Pattern for All Check Methods:

```typescript
export async function check{ObjectType}(
  connection: AbapConnection,
  objectName: string,
  version: 'active' | 'inactive',  // ✅ REQUIRED, explicit
  sourceCode?: string,              // ✅ Optional (only for classes)
  sessionId?: string                // ✅ Optional (required for domain)
): Promise<AxiosResponse>
```

#### Specific Implementations:

##### 1. Domain Check (FIXED - needs callers update)

**Important**: Domain is a DDIC object without code, so this is NOT "syntax check" but structure/validity check.

```typescript
/**
 * Check domain validity
 * 
 * Note: Domain is a DDIC object without code, so this validates structure/validity,
 * NOT syntax (domains don't have syntax).
 * 
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Session ID (required for domain operations)
 * @returns Check result with errors/warnings
 */
export async function checkDomain(
  connection: AbapConnection,
  domainName: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sessionId: string                 // ✅ Required
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'domain', domainName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Domain check failed: ${checkResult.message}`);
  }

  return response;
}
```

**Note**: Consider renaming from `checkDomainSyntax` to `checkDomain` since domains don't have syntax.

**Changes needed:**
- ✅ Signature already fixed (but consider renaming from `checkDomainSyntax` to `checkDomain`)
- ⚠️ Update callers in `domain/create.ts` and `domain/update.ts`:
  ```typescript
  // Current (WRONG):
  await checkDomainSyntax(connection, params.domain_name, sessionId);
  
  // Should be:
  await checkDomain(connection, params.domain_name, 'inactive', sessionId);
  ```
  
**Note**: If renaming `checkDomainSyntax` → `checkDomain`, also update:
- Function name in `domain/check.ts`
- Exports in `domain/index.ts`
- All callers in `domain/create.ts` and `domain/update.ts`
- Tests in `__tests__/unit/domain/check.test.ts`

##### 2. Class Check (ENHANCE - add sourceCode support)

**Important**: Class has code, so checkRun validates syntax, compilation, and all code quality rules.

```typescript
/**
 * Check class code (syntax, compilation, rules)
 * 
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 * 
 * Can check:
 * - Existing class: provide className, omit sourceCode
 * - Hypothetical code: provide className and sourceCode (object doesn't need to exist)
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sourceCode?: string,              // ✅ NEW: Optional source code for hypothetical validation
  sessionId?: string                 // ✅ Optional
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');
  
  let response: AxiosResponse;
  
  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  }
  
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}
```

##### 3. FunctionModule Check (FIX - make version required)

**Important**: FunctionModule has code, so checkRun validates syntax, compilation, and all code quality rules.

```typescript
/**
 * Check function module code (syntax, compilation, rules)
 * 
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 * 
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sessionId?: string                // ✅ Optional
): Promise<AxiosResponse> {
  // ... existing implementation
}
```

##### 4. FunctionGroup Check (FIX - make version required)

```typescript
/**
 * Check function group syntax
 * 
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkFunctionGroup(
  connection: AbapConnection,
  functionGroupName: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sessionId?: string                // ✅ Optional
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'function_group', functionGroupName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Function group check failed: ${checkResult.message}`);
  }

  return response;
}
```

##### 5. Program Check (FIX - make version required)

```typescript
/**
 * Check program syntax
 * 
 * @param connection - SAP connection
 * @param programName - Program name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkProgram(
  connection: AbapConnection,
  programName: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sessionId?: string                // ✅ Optional
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'program', programName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Program check failed: ${checkResult.message}`);
  }

  return response;
}
```

##### 6. DataElement Check (FIX - make version required)

**Important**: DataElement is a DDIC object without code, so this is NOT "syntax check" but structure/validity check.

```typescript
/**
 * Check data element validity
 * 
 * Note: DataElement is a DDIC object without code, so this validates structure/validity,
 * NOT syntax (data elements don't have syntax).
 * 
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkDataElement(
  connection: AbapConnection,
  dataElementName: string,
  version: 'active' | 'inactive',  // ✅ Required, no default
  sessionId?: string                // ✅ Optional
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'data_element', dataElementName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Data element check failed: ${checkResult.message}`);
  }

  return response;
}
```

**Note**: Consider renaming from `checkDataElement` to just `checkDataElement` (name is OK, but documentation should clarify it's not syntax).

---

### Solution 2: Clarify Check vs Validation

#### Validation Methods (Name Validation)

These should remain separate and clearly named:

```typescript
// ✅ FunctionModule validation (name validation)
validateFunctionModuleName(connection, fugrName, fmName, description?)

// ✅ Class validation (name validation)
validateClassName(connection, className, description?)

// ✅ Other objects can have validation too
validateProgramName(connection, programName, description?)
validateDataElementName(connection, dataElementName, description?)
```

**Purpose:** Validate object name before creation (naming conventions, conflicts, etc.)

#### Check Methods (Comprehensive Validation)

These validate objects using checkRun (comprehensive validation):

**For objects WITH code** (Class, Program, FunctionModule, View, etc.):
- Validates: syntax, compilation, code quality rules, everything

**For DDIC objects WITHOUT code** (Domain, DataElement, Structure, Table):
- Validates: structure validity, data type consistency, references

```typescript
// ✅ FunctionModule check (code: syntax, compilation, rules)
checkFunctionModule(connection, fugrName, fmName, version, sessionId?)

// ✅ Class check (code: syntax, compilation, rules, optionally with hypothetical code)
checkClass(connection, className, version, sourceCode?, sessionId?)

// ✅ Program check (code: syntax, compilation, rules)
checkProgram(connection, programName, version, sessionId?)

// ✅ Domain check (structure validity, NOT syntax - domains don't have code)
checkDomain(connection, domainName, version, sessionId)

// ✅ DataElement check (structure validity, NOT syntax - data elements don't have code)
checkDataElement(connection, dataElementName, version, sessionId?)
```

**Purpose:** 
- For code objects: Validate syntax, compilation errors, warnings, code quality rules (everything)
- For DDIC objects: Validate structure validity, data type consistency, references

---

## 📝 Implementation Plan

### Phase 1: Fix Domain Check Callers
1. Update `domain/create.ts`:
   ```typescript
   // Line 175: Change from
   await checkDomainSyntax(connection, params.domain_name, sessionId);
   // To:
   await checkDomainSyntax(connection, params.domain_name, 'inactive', sessionId);
   ```

2. Update `domain/update.ts`:
   ```typescript
   // Line 135: Change from
   await checkDomainSyntax(connection, params.domain_name, sessionId);
   // To:
   await checkDomainSyntax(connection, params.domain_name, 'inactive', sessionId);
   ```

### Phase 2: Enhance Class Check
1. Update `class/check.ts` signature to include optional `sourceCode`
2. Implement logic to use `runCheckRunWithSource` when code provided
3. Update documentation

### Phase 3: Standardize All Check Methods
1. Update `functionModule/check.ts` - make version required
2. Update `functionGroup/check.ts` - make version required
3. Update `program/check.ts` - make version required
4. Update `dataElement/check.ts` - make version required
5. Update all callers to pass explicit version

### Phase 4: Update Tests
1. Update domain check test to use explicit version
2. Update all other check tests to use explicit version
3. Add test for class check with hypothetical code

---

## 🔍 Version Usage Guidelines

### When to use `'active'`:
- Checking activated/active version of existing object
- After object has been activated
- For production/stable code validation

### When to use `'inactive'`:
- Checking saved but not activated version
- After create/update operations, before activation
- For newly created or modified objects
- For domain: after creation, before activation

### Examples:

```typescript
// After creating domain (not yet activated)
await checkDomainSyntax(connection, 'Z_TEST_DOMAIN', 'inactive', sessionId);

// After activating domain
await checkDomainSyntax(connection, 'Z_TEST_DOMAIN', 'active', sessionId);

// Check existing class (active version)
await checkClass(connection, 'ZCL_TEST', 'active');

// Check hypothetical class code (doesn't exist yet)
await checkClass(connection, 'ZCL_NEW', 'active', hypotheticalSourceCode);

// After updating function module (not yet activated)
await checkFunctionModule(connection, 'Z_TEST_FUGR', 'Z_TEST_FM', 'inactive', sessionId);
```

---

## ✅ Benefits

1. **Clarity**: Explicit version makes intent clear
2. **Consistency**: All check methods follow same pattern
3. **Flexibility**: Classes can check hypothetical code
4. **Correctness**: No invalid `'new'` version
5. **Type Safety**: TypeScript enforces `'active' | 'inactive'`
6. **Separation**: Clear distinction between check (code) and validation (name)

---

## ⚠️ Breaking Changes

These changes are **breaking** for public API:

1. **Domain check**: `version` parameter becomes required (was optional with default `'new'`)
2. **All check methods**: `version` parameter becomes required (was optional with default `'active'`)
3. **Class check**: New optional `sourceCode` parameter (additive, not breaking)

**Migration Strategy:**
- Update all internal callers first
- Update public API documentation
- Consider major version bump if this is public API

---

## 📚 References

- `src/core/shared/checkRun.ts` - Shared check run utilities
- `src/core/domain/check.ts` - Domain check (already fixed, needs callers update)
- `src/core/class/check.ts` - Class check (needs enhancement)
- `src/core/functionModule/check.ts` - FunctionModule check (needs fix)
- `src/core/functionGroup/check.ts` - FunctionGroup check (needs fix)
- `src/core/program/check.ts` - Program check (needs fix)
- `src/core/dataElement/check.ts` - DataElement check (needs fix)
- `src/core/functionModule/validation.ts` - FunctionModule validation (correct)
- `src/core/shared/validation.ts` - Shared validation utilities

