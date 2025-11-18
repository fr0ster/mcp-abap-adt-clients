# Class Check Analysis - Active, Inactive, and Non-Existing Classes

## 📋 Current Implementation

### Current `checkClass` Function

```typescript
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse>
```

**How it works:**
- Uses `runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId)`
- Builds XML: `<chkrun:checkObject adtcore:uri="..." chkrun:version="${version}"/>`
- **Requires object to exist in SAP** - reads code from SAP system
- **Does NOT support hypothetical code** (non-existing classes)

### Current `validateClassSource` Function

```typescript
export async function validateClassSource(
  connection: AbapConnection,
  className: string,
  sourceCode?: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse>
```

**How it works:**
- If `sourceCode` provided: uses `runCheckRunWithSource` - validates hypothetical code
- If `sourceCode` omitted: uses `runCheckRun` - validates existing class
- **Supports both existing and non-existing classes**

---

## 🔍 How Different Scenarios Work

### Scenario 1: Active Class (Existing, Activated)

**Current usage:**
```typescript
await checkClass(connection, 'ZCL_TEST', 'active');
```

**What happens:**
1. Builds URI: `/sap/bc/adt/oo/classes/zcl_test`
2. Builds XML: `<chkrun:checkObject adtcore:uri="..." chkrun:version="active"/>`
3. SAP reads **activated version** from system
4. Validates: syntax, compilation, rules
5. Returns check results

**Requirements:**
- ✅ Class must exist
- ✅ Class must be activated
- ✅ Reads code from SAP system

**XML sent:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/zcl_test" chkrun:version="active"/>
</chkrun:checkObjectList>
```

---

### Scenario 2: Inactive Class (Existing, Not Activated)

**Current usage:**
```typescript
await checkClass(connection, 'ZCL_TEST', 'inactive');
```

**What happens:**
1. Builds URI: `/sap/bc/adt/oo/classes/zcl_test`
2. Builds XML: `<chkrun:checkObject adtcore:uri="..." chkrun:version="inactive"/>`
3. SAP reads **inactive version** (saved but not activated) from system
4. Validates: syntax, compilation, rules
5. Returns check results

**Requirements:**
- ✅ Class must exist
- ✅ Class must have inactive version (saved but not activated)
- ✅ Reads code from SAP system

**XML sent:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/zcl_test" chkrun:version="inactive"/>
</chkrun:checkObjectList>
```

**When to use:**
- After `createClass()` - check before activation
- After `updateClassSource()` - check modified code before activation

---

### Scenario 3: Non-Existing Class (Hypothetical Code)

**Current usage (workaround):**
```typescript
await validateClassSource(connection, 'ZCL_NEW', hypotheticalSourceCode, 'active');
```

**What happens:**
1. Builds URI: `/sap/bc/adt/oo/classes/zcl_new`
2. Encodes source code to base64
3. Builds XML with artifacts containing source code
4. SAP validates **provided code** (object doesn't need to exist)
5. Returns check results

**Requirements:**
- ❌ Class does NOT need to exist
- ✅ Source code must be provided
- ✅ Validates hypothetical code

**XML sent:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/zcl_new" chkrun:version="active">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkcore:uri="/sap/bc/adt/oo/classes/zcl_new/source/main">
        <chkrun:content>BASE64_ENCODED_SOURCE_CODE</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>
```

**When to use:**
- Before creating class - validate code syntax
- Real-time validation in editor
- Code review before commit

---

## ⚠️ Current Problems

### Problem 1: Inconsistent API

**Two different functions for same purpose:**
- `checkClass()` - only for existing classes
- `validateClassSource()` - for both existing and non-existing

**Confusion:**
- Why two functions?
- Which one to use when?
- `validateClassSource` name suggests "validation" but it's actually "check"

### Problem 2: Missing Support in `checkClass`

**Current `checkClass` cannot:**
- ❌ Check hypothetical code (non-existing classes)
- ❌ Validate code before creating object

**Workaround:**
- Use `validateClassSource` instead
- But it has different name and signature

### Problem 3: Version Default Value

**Current:**
```typescript
version: 'inactive' | 'active' = 'active'  // Default hides intent
```

**Problem:**
- Default value hides what is being checked
- Should be explicit: `version: 'active' | 'inactive'` (required)

---

## 🎯 Proposed Solution

### Unified `checkClass` Function

```typescript
/**
 * Check class code (syntax, compilation, rules)
 * 
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 * 
 * Can check:
 * - Existing active class: provide className, version='active', omit sourceCode
 * - Existing inactive class: provide className, version='inactive', omit sourceCode
 * - Hypothetical code: provide className, sourceCode, version (object doesn't need to exist)
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
  version: 'active' | 'inactive',  // ✅ Required, explicit
  sourceCode?: string,              // ✅ NEW: Optional source code for hypothetical validation
  sessionId?: string                // ✅ Optional
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');
  
  let response: AxiosResponse;
  
  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  }
  
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}
```

---

## 📝 Usage Examples

### Example 1: Check Active Class

```typescript
// Check activated version of existing class
const result = await checkClass(connection, 'ZCL_TEST', 'active');
```

**What happens:**
- Reads activated code from SAP
- Validates syntax, compilation, rules
- Returns check results

---

### Example 2: Check Inactive Class

```typescript
// Check inactive version (after create/update, before activate)
const result = await checkClass(connection, 'ZCL_TEST', 'inactive');
```

**What happens:**
- Reads inactive code from SAP
- Validates modified code before activation
- Returns check results

---

### Example 3: Check Hypothetical Code (Non-Existing Class)

```typescript
// Check code before creating class (object doesn't exist)
const hypotheticalCode = `
CLASS ZCL_NEW DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .
  PUBLIC SECTION.
    METHODS: test_method.
ENDCLASS.

CLASS ZCL_NEW IMPLEMENTATION.
  METHOD test_method.
    " implementation
  ENDMETHOD.
ENDCLASS.
`;

const result = await checkClass(connection, 'ZCL_NEW', 'active', hypotheticalCode);
```

**What happens:**
- Validates provided code (base64 encoded in XML)
- Object doesn't need to exist
- Returns check results
- Can validate before creating object

---

## 🔄 Migration from Current API

### Current → Proposed

#### Active Class:
```typescript
// Current
await checkClass(connection, 'ZCL_TEST', 'active');

// Proposed (same)
await checkClass(connection, 'ZCL_TEST', 'active');
```

#### Inactive Class:
```typescript
// Current
await checkClass(connection, 'ZCL_TEST', 'inactive');

// Proposed (same)
await checkClass(connection, 'ZCL_TEST', 'inactive');
```

#### Hypothetical Code:
```typescript
// Current (workaround)
await validateClassSource(connection, 'ZCL_NEW', sourceCode, 'active');

// Proposed (unified)
await checkClass(connection, 'ZCL_NEW', 'active', sourceCode);
```

---

## ✅ Benefits

1. **Unified API**: One function for all scenarios
2. **Clear Intent**: Explicit version parameter (no default)
3. **Flexibility**: Supports existing and hypothetical code
4. **Consistency**: Same pattern for all check operations
5. **Type Safety**: TypeScript enforces `'active' | 'inactive'`

---

## 📊 Comparison Table

| Scenario | Current API | Proposed API | Object Exists? |
|----------|-------------|--------------|----------------|
| Active class | `checkClass(conn, name, 'active')` | `checkClass(conn, name, 'active')` | ✅ Yes |
| Inactive class | `checkClass(conn, name, 'inactive')` | `checkClass(conn, name, 'inactive')` | ✅ Yes |
| Hypothetical code | `validateClassSource(conn, name, code)` | `checkClass(conn, name, 'active', code)` | ❌ No |

---

## 🔗 Related Functions

### `validateClassName` - Name Validation (Separate)

```typescript
// Validates class name before creation
const validation = await validateClassName(connection, 'ZCL_NEW', 'Description');
if (!validation.valid) {
  throw new Error(`Invalid class name: ${validation.message}`);
}
```

**Purpose:** Validates name (naming conventions, conflicts)
**Endpoint:** `POST /sap/bc/adt/functions/validation?objtype=CLAS/OC&objname=...`
**When to use:** Before creating class to check if name is valid

---

## 📚 References

- `src/core/class/check.ts` - Current checkClass implementation
- `src/core/class/validation.ts` - Current validateClassSource implementation
- `src/core/shared/checkRun.ts` - Shared check run utilities
- `src/core/shared/validation.ts` - Shared validation utilities

