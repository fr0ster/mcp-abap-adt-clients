# План покращення покриття тестами - @mcp-abap-adt/adt-clients

**Поточний стан:** 32.8% загальне покриття | 61 інтеграційний тест | 0 unit тестів

## 📊 Аналіз поточного покриття

### ✅ Добре покриття (>80%)
- `src/clients/ReadOnlyClient.ts` - **88.88%** ✅
- `src/core/*/check.ts` - **77-100%** ✅ (check операції)
- `src/core/*/read.ts` - **42-100%** ✅ (read операції)
- `src/core/*/index.ts` - **100%** ✅ (експорти)
- `src/utils/internalUtils.ts` - **100%** ✅
- `src/utils/sessionUtils.ts` - **100%** ✅

### ⚠️ Критично низьке покриття (<20%)

#### CRUD операції (8-15% покриття):
- `src/core/class/create.ts` - **12.5%** ❌
- `src/core/program/create.ts` - **11.29%** ❌
- `src/core/structure/create.ts` - **8.57%** ❌
- `src/core/table/create.ts` - **11.25%** ❌
- `src/core/domain/create.ts` - **12.9%** ❌
- `src/core/dataElement/create.ts` - **14.28%** ❌
- `src/core/functionGroup/create.ts` - **11.62%** ❌
- `src/core/functionModule/create.ts` - **14.54%** ❌
- `src/core/interface/create.ts` - **15.38%** ❌
- `src/core/package/create.ts` - **13.95%** ❌
- `src/core/transport/create.ts` - **10%** ❌
- `src/core/view/create.ts` - **14.89%** ❌

#### Update операції (9-20% покриття):
- `src/core/dataElement/update.ts` - **9.3%** ❌
- `src/core/domain/update.ts` - **15.09%** ❌
- `src/core/class/update.ts` - **20%** ❌
- `src/core/program/update.ts` - **20%** ❌
- `src/core/interface/update.ts` - **20%** ❌
- `src/core/functionModule/update.ts` - **18.75%** ❌
- `src/core/view/update.ts` - **20.68%** ❌

#### Lock/Unlock операції (17-37% покриття):
- `src/core/*/lock.ts` - **17-30%** ⚠️
- `src/core/*/unlock.ts` - **33-60%** ⚠️

#### Activation операції (16-60% покриття):
- `src/core/*/activation.ts` - **16-60%** ⚠️
- `src/utils/activationUtils.ts` - **16.21%** ❌

#### Інші:
- `src/core/delete.ts` - **10%** ❌
- `src/clients/CrudClient.ts` - **44.44%** ⚠️
- `src/core/readOperations.ts` - **37.66%** ⚠️
- `src/core/managementOperations.ts` - **21.42%** ⚠️

## 🎯 Стратегія покращення

### Фаза 1: Unit тести для створення об'єктів (Пріоритет: ВИСОКИЙ)
**Мета:** Покрити create операції на 60%+

#### 1.1 Базові create операції
- [ ] `src/core/class/create.test.ts` - тест створення класу
- [ ] `src/core/program/create.test.ts` - тест створення програми
- [ ] `src/core/interface/create.test.ts` - тест створення інтерфейсу
- [ ] `src/core/functionGroup/create.test.ts` - тест створення функц. групи

**Підхід:** Mock connection, перевірити:
- Правильність формування XML payload
- Правильність URL endpoints
- Обробку параметрів (transport, package, master system)
- Обробку помилок

#### 1.2 DDIC create операції
- [ ] `src/core/domain/create.test.ts`
- [ ] `src/core/dataElement/create.test.ts`
- [ ] `src/core/structure/create.test.ts`
- [ ] `src/core/table/create.test.ts`
- [ ] `src/core/view/create.test.ts`

#### 1.3 Інші create операції
- [ ] `src/core/package/create.test.ts`
- [ ] `src/core/transport/create.test.ts`
- [ ] `src/core/functionModule/create.test.ts`

### Фаза 2: Unit тести для update операцій (Пріоритет: ВИСОКИЙ)
**Мета:** Покрити update операції на 50%+

- [ ] `src/core/class/update.test.ts`
- [ ] `src/core/program/update.test.ts`
- [ ] `src/core/interface/update.test.ts`
- [ ] `src/core/dataElement/update.test.ts`
- [ ] `src/core/domain/update.test.ts`
- [ ] `src/core/functionModule/update.test.ts`
- [ ] `src/core/view/update.test.ts`

**Підхід:** Mock connection, перевірити:
- Правильність PUT/PATCH запитів
- Content-Type headers
- ETag handling
- Encoding source code

### Фаза 3: Unit тести для lock/unlock (Пріоритет: СЕРЕДНІЙ)
**Мета:** Покрити на 70%+

- [ ] `src/core/*/lock.test.ts` - об'єднаний тест для всіх типів
- [ ] `src/core/*/unlock.test.ts` - об'єднаний тест для всіх типів

**Підхід:** Тестувати session management і lock tokens

### Фаза 4: Unit тести для activation (Пріоритет: СЕРЕДНІЙ)
**Мета:** Покрити на 60%+

- [ ] `src/utils/activationUtils.test.ts` - тест XML generation
- [ ] `src/core/activation.test.ts` - загальні тести активації

### Фаза 5: Тести для клієнтів (Пріоритет: СЕРЕДНІЙ)
**Мета:** Покрити CrudClient на 70%+

- [ ] `src/clients/CrudClient.test.ts` - unit тести з моками
- [ ] `src/clients/ManagementClient.test.ts` - unit тести

### Фаза 6: Тести для операцій (Пріоритет: НИЗЬКИЙ)
- [ ] `src/core/delete.test.ts`
- [ ] `src/core/readOperations.test.ts`
- [ ] `src/core/managementOperations.test.ts`

## 📝 Шаблон unit тесту

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
    // Test transport handling
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

## 🎯 Цільові показники

### Короткострокові (1-2 тижні):
- **Загальне покриття:** 32% → **60%**
- **Create операції:** 12% → **60%**
- **Update операції:** 15% → **50%**

### Середньострокові (1 місяць):
- **Загальне покриття:** 60% → **75%**
- **Lock/Unlock:** 25% → **70%**
- **Activation:** 30% → **60%**

### Довгострокові (2-3 місяці):
- **Загальне покриття:** 75% → **85%+**
- **Критичні шляхи:** **90%+**
- **Всі CRUD операції:** **80%+**

## 🔧 Необхідні інструменти

1. **Mock infrastructure:**
   - [ ] Створити `src/__mocks__/connection.ts` - mock AbapConnection
   - [ ] Створити `src/__tests__/helpers/` - test utilities

2. **Test fixtures:**
   - [ ] XML response templates
   - [ ] Test data builders

3. **CI/CD:**
   - [ ] Додати coverage threshold в jest.config.js
   - [ ] Fail build якщо coverage падає
