# Test Coverage Improvement Plan - @mcp-abap-adt/adt-clients

**⚠️ NOTE: This is a plan for UNIT tests, separate from the integration test roadmap.**  
**Related:** [TEST_IMPROVEMENT_ROADMAP.md](./TEST_IMPROVEMENT_ROADMAP.md) – integration test roadmap.

**Current state:** 32.8% overall coverage | 61 integration tests | 0 unit tests

## 📊 Coverage Analysis

### ✅ Strong Coverage (>80%)
- `src/clients/ReadOnlyClient.ts` – **88.88%**
- `src/core/*/check.ts` – **77-100%** (check operations)
- `src/core/*/read.ts` – **42-100%** (read operations)
- `src/core/*/index.ts` – **100%** (re-export files)
- `src/utils/internalUtils.ts` – **100%**
- `src/utils/sessionUtils.ts` – **100%**

### ⚠️ Critical Coverage (<20%)

#### CRUD operations (8-15% coverage):
- `src/core/class/create.ts` – **12.5%**
- `src/core/program/create.ts` – **11.29%**
- `src/core/structure/create.ts` – **8.57%**
- `src/core/table/create.ts` – **11.25%**
- `src/core/domain/create.ts` – **12.9%**
- `src/core/dataElement/create.ts` – **14.28%**
- `src/core/functionGroup/create.ts` – **11.62%**
- `src/core/functionModule/create.ts` – **14.54%**
- `src/core/interface/create.ts` – **15.38%**
- `src/core/package/create.ts` – **13.95%**
- `src/core/transport/create.ts` – **10%**
- `src/core/view/create.ts` – **14.89%**

#### Update operations (9-20% coverage):
- `src/core/dataElement/update.ts` – **9.3%**
- `src/core/domain/update.ts` – **15.09%**
- `src/core/class/update.ts` – **20%**
- `src/core/program/update.ts` – **20%**
- `src/core/interface/update.ts` – **20%**
- `src/core/functionModule/update.ts` – **18.75%**
- `src/core/view/update.ts` – **20.68%**

#### Lock/Unlock operations (17-37% coverage):
- `src/core/*/lock.ts` – **17-30%**
- `src/core/*/unlock.ts` – **33-60%**

#### Activation operations (16-60% coverage):
- `src/core/*/activation.ts` – **16-60%**
- `src/utils/activationUtils.ts` – **16.21%**

#### Other low-coverage modules:
- `src/core/delete.ts` – **10%**
- `src/clients/CrudClient.ts` – **44.44%**
- `src/core/readOperations.ts` – **37.66%**
- `src/core/managementOperations.ts` – **21.42%**

## 🎯 Improvement Strategy

### Phase 1: Unit Tests for Create Operations (Priority: HIGH)
**Goal:** Raise create operation coverage to 60%+

#### 1.1 Core create operations
- [ ] `src/core/class/create.test.ts`
- [ ] `src/core/program/create.test.ts`
- [ ] `src/core/interface/create.test.ts`
- [ ] `src/core/functionGroup/create.test.ts`

**Approach:** mock connection and assert:
- XML payload correctness
- Endpoint URLs
- Parameter handling (transport, package, master system)
- Error handling

#### 1.2 DDIC create operations
- [ ] `src/core/domain/create.test.ts`
- [ ] `src/core/dataElement/create.test.ts`
- [ ] `src/core/structure/create.test.ts`
- [ ] `src/core/table/create.test.ts`
- [ ] `src/core/view/create.test.ts`

#### 1.3 Other create operations
- [ ] `src/core/package/create.test.ts`
- [ ] `src/core/transport/create.test.ts`
- [ ] `src/core/functionModule/create.test.ts`

### Phase 2: Unit Tests for Update Operations (Priority: HIGH)
**Goal:** Raise update coverage to 50%+

- [ ] `src/core/class/update.test.ts`
- [ ] `src/core/program/update.test.ts`
- [ ] `src/core/interface/update.test.ts`
- [ ] `src/core/dataElement/update.test.ts`
- [ ] `src/core/domain/update.test.ts`
- [ ] `src/core/functionModule/update.test.ts`
- [ ] `src/core/view/update.test.ts`

**Approach:** mock connection and verify:
- PUT/PATCH requests
- Content-Type headers
- ETag handling
- Source encoding

### Phase 3: Unit Tests for Lock/Unlock (Priority: MEDIUM)
**Goal:** Raise lock/unlock coverage to 70%+

- [ ] Consolidated lock tests (`src/core/*/lock.test.ts`)
- [ ] Consolidated unlock tests (`src/core/*/unlock.test.ts`)

**Approach:** test session management, lock tokens, error handling.

### Phase 4: Unit Tests for Activation (Priority: MEDIUM)
**Goal:** Raise activation coverage to 60%+

- [ ] `src/utils/activationUtils.test.ts`
- [ ] `src/core/activation.test.ts`

### Phase 5: Client Unit Tests (Priority: MEDIUM)
**Goal:** `CrudClient` coverage ≥70%

- [ ] `src/clients/CrudClient.test.ts`
- [ ] `src/clients/ManagementClient.test.ts`

### Phase 6: Remaining Operations (Priority: LOW)
- [ ] `src/core/delete.test.ts`
- [ ] `src/core/readOperations.test.ts`
- [ ] `src/core/managementOperations.test.ts`

## 📝 Unit Test Template

```typescript
import { createMockConnection } from '../__mocks__/connection';
import { createClass } from './create';

describe('createClass', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
  });

  it('should create class with correct XML payload', async () => {
    mockConnection.makeAdtRequest.mockResolvedValue({
      status: 201,
      data: '<class:abapClass ...>',
      headers: {},
    });

    await createClass(mockConnection, {
      className: 'ZCL_TEST',
      package: 'ZTEST',
      transport: 'DEVK900001',
      description: 'Test class'
    });

    expect(mockConnection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/sap/bc/adt/oo/classes'),
        headers: expect.objectContaining({
          'Content-Type': 'application/vnd.sap.adt.oo.classes.v4+xml'
        })
      })
    );
  });

  it('should handle transport parameter correctly', async () => {
    // Additional assertions
  });

  it('should throw error on 400 response', async () => {
    mockConnection.makeAdtRequest.mockRejectedValue({
      response: { status: 400, data: 'Bad request' }
    });

    await expect(
      createClass(mockConnection, { className: 'ZCL_TEST' })
    ).rejects.toThrow();
  });
});
```

## 🎯 Target Metrics

### Short-term (1-2 weeks)
- **Overall coverage:** 32% → **60%**
- **Create operations:** 12% → **60%**
- **Update operations:** 15% → **50%**

### Mid-term (1 month)
- **Overall coverage:** 60% → **75%**
- **Lock/Unlock:** 25% → **70%**
- **Activation:** 30% → **60%**

### Long-term (2-3 months)
- **Overall coverage:** 75% → **85%+**
- **Critical paths:** **90%+**
- **All CRUD operations:** **80%+**

## 🔧 Required Tooling

1. **Mock infrastructure**
   - [ ] `src/__mocks__/connection.ts`
   - [ ] `src/__tests__/helpers/` (shared utilities)

2. **Test fixtures**
   - [ ] XML response templates
   - [ ] Test data builders

3. **CI/CD**
   - [ ] Add coverage thresholds to `jest.config.js`
   - [ ] Fail build if coverage drops below threshold
