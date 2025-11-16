# Test Structure

Tests are organized into two categories: **integration tests** (individual operations) and **end-to-end workflow tests** (complete scenarios).

**Note:** All tests connect to a real SAP ABAP system via ADT REST API. There are no mock/unit tests - all tests are integration tests that verify actual API behavior.

## Test Folders

### 📁 `integration/` - Integration Tests (Individual Operations)
Tests for individual operations (create, read, update, delete, lock, unlock, activate, check) for each object type.
- Fast execution (1-2s per test)
- Test one function at a time
- Use other functions for setup/verification
- Example: `integration/class/create.test.ts` tests only `createClass()`, uses `getClass()` to verify

### 📁 `e2e/` - End-to-End Tests (Complete Workflows)  
Tests for complete workflows from start to finish.
- Slower execution (10-15s per workflow)
- Test entire scenarios
- Example: `e2e/class.workflow.test.ts` tests create → update → lock → check → activate → unlock → delete

### 📁 `helpers/` - Shared Test Utilities
Common helpers used across all tests:
- `sessionConfig.ts` - Load configuration from `.env` and `test-config.yaml`
- `setupTestEnvironment.ts` - Setup connection and configuration
- Test helper functions

## Idempotency Principle

All tests are designed to be **idempotent** - they can be run multiple times without manual cleanup or setup.

### CREATE Tests
- **Before creating an object**: Check if it exists and **DELETE it if found**.
- This ensures the test always starts from a clean state (object doesn't exist).
- Example: `create.test.ts` files use `ensureObjectDoesNotExist()` helper functions.

### Other Tests (READ, UPDATE, DELETE, CHECK, ACTIVATE, LOCK, UNLOCK)
- **Before testing**: Check if the object exists and **CREATE it if missing**.
- This ensures the test has the required object available.
- Example: `read.test.ts`, `update.test.ts`, `check.test.ts` files use `ensureObjectExists()` helper functions.

### User Space Objects Only
- All tests that **modify objects** (create, update, delete, activate, lock, unlock, check) use only **user-defined objects** (Z_ or Y_ prefix).
- Standard SAP objects cannot be created, updated, activated, locked, or deleted.
- Read-only operations (`get_*`) may use standard SAP objects for testing.

This principle ensures:
- Tests can be run repeatedly without manual intervention
- Tests are independent and don't rely on external state
- Tests are safe to run in any order

## Integration Tests (`integration/`)

Integration tests focus on testing **individual operations** against a real SAP system. Each operation has its own test file.

### Function Group Tests

Location: `integration/functionGroup/`

- `create.test.ts` - Test `createFunctionGroup()` only
- `read.test.ts` - Test `getFunctionGroup()` only
- `delete.test.ts` - Test `deleteObject()` for FUGR only

### Function Module Tests

Location: `integration/functionModule/`

- `create.test.ts` - Test `createFunctionModule()` only
- `read.test.ts` - Test `getFunction()` only
- `update.test.ts` - Test `updateFunctionModuleSource()` only
- `check.test.ts` - Test `checkFunctionModule()` only
- `validate.test.ts` - Test `validateFunctionModuleName()` and `validateFunctionModuleSource()`
- `delete.test.ts` - Test `deleteObject()` for FM only

**Note**: `lock.test.ts` and `activate.test.ts` are not needed as separate files because lock/unlock/activate are tested indirectly via create/update workflows.

## Integration Workflow Tests (`__tests__/integration/`)

Integration tests execute **complete workflows** with multiple operations in the correct sequence.

### Function Module Workflow

File: `functionModule.workflow.test.ts`

Tests complete CRUD workflow:
1. Create Function Group
2. Validate FM name (requires FUGR exists)
3. Create Function Module
4. Read Function Module
5. Check FM syntax
6. Update Function Module
7. Validate FM source code
8. Delete Function Module
9. Delete Function Group

This ensures:
- Operations work in the correct order
- Dependencies are properly handled (FUGR must exist before FM)
- Full lifecycle is tested end-to-end

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific unit test
```bash
npm test -- functionGroup/create.test
npm test -- functionModule/validate.test
```

### Run integration workflow test
```bash
npm test -- functionModule.workflow.test
```

### Run all Function Module unit tests
```bash
npm test -- functionModule
```

### Run all Function Group unit tests
```bash
npm test -- functionGroup
```

## Test Dependencies

All tests require:
- `.env` file with SAP credentials
- `test-config.yaml` with test parameters
- FUGR tests: Package must exist (e.g., `ZOK_TEST_PKG_01`)
- FM tests: FUGR must be created first (for integration workflow)

## Authorization Requirements

Some tests may fail due to SAP authorization:
- **S_ABPLNGVS** - Required for FM create/update operations
- Tests will log authorization errors but continue with cleanup

## Test Pattern

All tests follow this pattern:
```typescript
describe('Object - Operation', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    // Setup connection
  });

  afterAll(async () => {
    // Cleanup connection
  });

  it('should perform operation', async () => {
    if (!hasConfig) return;
    
    // Test logic
  });
});
```
