# Test Structure

Tests are organized into two categories: **unit tests** and **integration workflow tests**.

## Unit Tests (`__tests__/unit/`)

Unit tests focus on testing **individual functions in isolation**. Each function has its own test file.

### Function Group Tests

Location: `__tests__/unit/functionGroup/`

- `create.test.ts` - Test `createFunctionGroup()` only
- `read.test.ts` - Test `getFunctionGroup()` only
- `delete.test.ts` - Test `deleteObject()` for FUGR only

### Function Module Tests

Location: `__tests__/unit/functionModule/`

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
