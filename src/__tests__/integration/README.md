# Integration Tests

Comprehensive integration tests for ADT Client operations with real SAP ABAP systems.

## Overview

These tests verify individual operations (create, read, update, delete, lock, unlock, activate, check) for each object type by interacting with an actual SAP system via ADT REST API.

**Note:** Despite being in the `integration/` folder, these tests connect to a real SAP system and are true integration tests, not unit tests. For complete workflow tests, see `../e2e/`.

## Test Organization

Tests are organized by module type:

- **`core/`** - Tests for CRUD operations on main ABAP objects (class, program, table, view, etc.)
- **`runtime/`** - Tests for runtime operations (memory snapshots, traces, debugger, logs, feeds)
- **`shared/`** - Tests for shared utility functions (search, whereUsed, readMetadata, etc.)

## Features

- ✅ **Separate test cases** - each operation tested independently
- ✅ **Automatic cleanup** - objects deleted before/after tests
- ✅ **Configurable debug logs** - control output verbosity
- ✅ **Real SAP validation** - tests against actual SAP system
- ✅ **YAML configuration** - all parameters from test-config.yaml
- ✅ **JWT Token Auto-Refresh** - all tests support automatic JWT token refresh when refresh credentials are provided
  - Tests automatically refresh expired JWT tokens during execution
  - Prevents "JWT token has expired" errors in long-running test suites
  - Requires `SAP_REFRESH_TOKEN`, `SAP_UAA_URL`, `SAP_UAA_CLIENT_ID`, and `SAP_UAA_CLIENT_SECRET` in `.env`

## Test Structure

### 1. Create and Read (2 tests)
- Create basic class → verify by reading
- Create class with superclass → verify by reading

### 2. Update (2 tests)
- Update class source code → verify changes (reads inactive version)
- Read inactive version after update (GET with `?version=inactive`)

### 3. Lock and Unlock (1 test)
- Lock class → unlock class

### 4. Check (1 test)
- Check **inactive** class syntax (after update, before activation)

### 5. Activate (3 tests)
- Activate basic class
- Check **active** class syntax (after activation)
- Activate class with superclass

### 6. Live Validation (2 tests)
- Validate correct unsaved source code
- Detect syntax errors in unsaved code

### 7. Run Class (3 tests)
- Ensure runnable class exists with correct source (create if missing, update if differs)
- Run class and get console output
- Delete runnable class

### 8. Delete (2 tests)
- Delete basic class → verify deletion
- Delete class with superclass → verify deletion

**Total: 16 tests**

## Running Tests

### Normal run (minimal output):
```bash
npm test -- testClass.integration.test.ts
```

### With debug logs (shows all HTTP requests, CSRF tokens, cookies):
```bash
DEBUG_TESTS=true npm test -- testClass.integration.test.ts
```

### With ADT operation debug logs (shows test steps and ADT operations):
```bash
DEBUG_ADT_TESTS=true npm test -- integration/view
```

### Clean output (only test results):
```bash
npm test -- testClass.integration.test.ts 2>&1 | grep -E "(✓|✅|🧹|PASS|FAIL|Tests:)"
```

## Debug Logging

Debug logs are controlled by environment variables:

- `DEBUG_TESTS=true` - shows all debug/info logs from connection layer (HTTP requests, CSRF tokens, cookies)
- `DEBUG_ADT_TESTS=true` - shows test workflow steps and ADT operation details (create, lock, update, activate, delete)
- Default (unset) - shows only test progress (✅) and errors (❌)

Example debug output with `DEBUG_TESTS=true`:
```
[DEBUG] BaseAbapConnection - Fetching NEW CSRF token
[DEBUG] BaseAbapConnection - Updated cookies from response
[DEBUG] BaseAbapConnection - Reusing existing CSRF token
✅ Created class: ZCL_TEST_BASIC
```

Example debug output with `DEBUG_ADT_TESTS=true`:
```
[1/3] ▶ ViewBuilder - full workflow :: builder_view
  Params: {"view_name":"ZADT_BLD_VIEW02","description":"ViewBuilder workflow view",...}
  → validate
  → create
  → lock
  → update
  → unlock
  → activate
  → delete (cleanup)
[1/3] ✓ PASS ViewBuilder - full workflow (12.3s)
```

## Environment Variables

Tests require SAP connection configuration in `.env` file or environment variables:

### Required Variables

**For Basic Authentication:**
- `SAP_URL` - SAP system URL (e.g., `https://your-system.example.com`)
- `SAP_USERNAME` - SAP username
- `SAP_PASSWORD` - SAP password
- `SAP_CLIENT` - SAP client (optional)
- `SAP_AUTH_TYPE=basic` - Authentication type (default: `basic`)

**For JWT Authentication:**
- `SAP_URL` - SAP system URL
- `SAP_JWT_TOKEN` - JWT access token
- `SAP_CLIENT` - SAP client (optional)
- `SAP_AUTH_TYPE=jwt` or `SAP_AUTH_TYPE=xsuaa` - Authentication type

### Optional Variables (for JWT Auto-Refresh)

To enable automatic JWT token refresh during test execution, add these variables:

- `SAP_REFRESH_TOKEN` - Refresh token for obtaining new access tokens
- `SAP_UAA_URL` or `UAA_URL` - UAA OAuth endpoint URL
- `SAP_UAA_CLIENT_ID` or `UAA_CLIENT_ID` - UAA client ID
- `SAP_UAA_CLIENT_SECRET` or `UAA_CLIENT_SECRET` - UAA client secret

**Benefits of Auto-Refresh:**
- Tests continue running even if JWT token expires during execution
- No manual token refresh required for long-running test suites
- Prevents "JWT token has expired" errors
- Connection automatically refreshes token on 401/403 errors

**Note:** All shared module tests (`whereUsed`, `readMetadata`, `readSource`, `search`, `sqlQuery`, `tableContents`) now support auto-refresh when refresh credentials are provided.

## Test Configuration

All test parameters come from `src/__tests__/helpers/test-config.yaml`:

```yaml
create_class:
  basic_class:
    enabled: true
    params:
      class_name: ZCL_TEST_BASIC
      package_name: ZTEST
      description: "Basic test class"

  class_with_superclass:
    enabled: true
    params:
      class_name: ZCL_TEST_INHERIT
      package_name: ZTEST
      description: "Test class with superclass"
      superclass: ZCL_TEST_BASIC
      final: true
```

## Important: Reading vs Checking vs Validating Objects

### Three different operations with different APIs:

#### 1. Read Object Source (GET) - `getClass()`
**Read Inactive (modified but not activated):**
```http
GET /sap/bc/adt/oo/classes/ZCL_TEST?version=inactive
```
- **Reads source code** of inactive version
- Use after `create` or `update`, **before** `activate`
- Does **NOT** run syntax checker - just returns code

**Read Active (currently deployed):**
```http
GET /sap/bc/adt/oo/classes/ZCL_TEST
```
- **Reads source code** of active version
- Returns currently running code in system
- Default behavior (no version parameter)

#### 2. Run Syntax Check (POST) - `checkClass()`
**Check Inactive (saved version):**
```http
POST /sap/bc/adt/checkruns?reporters=abapCheckRun
Body: <version>inactive</version>
```
- **Runs ATC/syntax checker** on inactive version
- Returns errors/warnings/messages
- Validates changes before activation
- Object must exist in SAP system

**Check Active (saved version):**
```http
POST /sap/bc/adt/checkruns?reporters=abapCheckRun
Body: <version>active</version>
```
- **Runs ATC/syntax checker** on active version
- Validates currently deployed code
- Returns errors/warnings/messages
- Object must exist in SAP system

**Check with New Code (unsaved code validation):**
```http
POST /sap/bc/adt/checkruns?reporters=abapCheckRun
Body: <checkObject>
  <artifacts>
    <artifact contentType="text/plain; charset=utf-8" uri="/sap/bc/adt/oo/classes/zcl_test/source/main">
      <content>BASE64_ENCODED_SOURCE</content>
    </artifact>
  </artifacts>
</checkObject>
```
- **Validates code that hasn't been saved to SAP yet**
- Source code is base64 encoded in request body
- Similar to live validation, but uses check endpoint
- Can validate code before creating or updating object
- All 11 code-bearing object types support this feature (Table, View, Structure, Class, Program, FunctionModule, Interface, BehaviorDefinition, ServiceDefinition, MetadataExtension, BehaviorImplementation)

#### 3. Live Validation (POST) - `validateClassSource()`
**Validate Unsaved Source:**
```http
POST /sap/bc/adt/checkruns?reporters=abapCheckRun
Body: <artifacts><content>BASE64_ENCODED_SOURCE</content></artifacts>
```
- **Validates code that hasn't been saved to SAP yet**
- Real-time syntax checking like Eclipse ADT editor
- Source code encoded as base64 in XML body
- Perfect for pre-flight validation before create/update
- Does **NOT** require object to exist in SAP

**Use Cases:**
- Check code syntax before saving to SAP
- Real-time validation during code editing
- Pre-flight validation before create/update operations
- Test syntax without modifying SAP system

#### 4. Run Class (POST) - `runClass()`
**Execute Class that implements if_oo_adt_classrun:**
```http
POST /sap/bc/adt/oo/classrun/{className}
```
- **Executes ABAP class main() method**
- Returns console output from the execution
- Class **MUST** implement `if_oo_adt_classrun` interface
- Similar to F9 run in Eclipse ADT
- Class must be **activated** before running

**Use Cases:**
- Execute test/demo classes
- Run data migration scripts
- Execute batch processing classes
- Quick code testing without creating programs
- Console output testing

**Example class structure:**
```abap
CLASS zcl_example DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS zcl_example IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    out->write( 'Hello World' ).
  ENDMETHOD.
ENDCLASS.
```

**Smart "Ensure Before Run" Logic:**

When `source_code` is provided in YAML `run_class` configuration, the test automatically:
1. **Checks if class exists** - attempts to read the class
2. **Creates if missing** - creates new class with source from YAML
3. **Updates if differs** - compares existing source with YAML, updates if different
4. **Activates** - ensures class is activated before running
5. **Runs** - executes the class with correct source code

This ensures the class always has the correct implementation before execution, making tests idempotent and self-healing.

### In Tests:
- **Read inactive** (after Update) → `getClass(connection, className, 'inactive')` - GET with ?version=inactive
- **Check inactive** (after Update) → `checkClass(connection, className, 'inactive')` - POST checkrun
- **Activate** → makes inactive → active
- **Check active** (after Activate) → `checkClass(connection, className, 'active')` - POST checkrun
- **Read active** → `getClass(connection, className, 'active')` or `getClass(connection, className)` - GET default
- **Live validation** → `validateClassSource(connection, className, sourceCode)` - POST checkrun with base64 source

## Test Execution Order

Tests run **independently** in this order:
1. **beforeAll**: Cleanup existing classes
2. **Create and Read**: Creates test classes
3. **Update**: Modifies class source
4. **Lock/Unlock**: Tests locking mechanism (order not important)
5. **Check (inactive)**: Validates syntax of **modified** version (after Update, before Activate)
6. **Activate**: Activates classes + **Check (active)**: Validates syntax of **activated** version
7. **Delete**: Removes classes and verifies deletion
8. **afterAll**: Final cleanup

> **Note**: Lock/Unlock, Check, and Activate tests can run in any order - they don't depend on each other.

## Coverage

These tests validate:
- ✅ `createClass()` - class creation
- ✅ `getClass()` - reading class source (active/inactive)
- ✅ `updateClassSource()` - modifying class code
- ✅ `lockClass()` - acquiring lock
- ✅ `unlockClass()` - releasing lock
- ✅ `checkClass()` - syntax checking (saved code)
- ✅ `validateClassSource()` - live validation (unsaved code)
- ✅ `activateClass()` - activation
- ✅ `deleteObject()` - deletion
- ✅ Connection lifecycle (CSRF tokens, cookies, sessions)
- ✅ Error handling (verify deletion by expecting failure)

## Example Output

```
PASS src/__tests__/integration/testClass.integration.test.ts (48.12 s)
  Class Operations (Integration)
    Create and Read
      ✓ should create basic class and verify by reading (11798 ms)
      ✓ should create class with superclass (9116 ms)
    Update
      ✓ should update class source code (8607 ms)
    Lock and Unlock
      ✓ should lock and unlock class (2238 ms)
    Check
      ✓ should check class syntax (650 ms)
    Activate
      ✓ should activate class (2333 ms)
      ✓ should activate class with superclass (608 ms)
    Delete
      ✓ should delete basic class and verify deletion (3706 ms)
      ✓ should delete class with superclass and verify deletion (3083 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        48.282 s
```
