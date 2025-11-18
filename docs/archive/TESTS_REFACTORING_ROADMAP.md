# 🗺️ ROADMAP: adt-clients Tests Refactoring

**⚠️ ARCHIVED: This file is no longer active**  
**Current roadmap:** [../TEST_STRATEGY.md](../TEST_STRATEGY.md)

---

**Створено:** 2025-11-16  
**Статус:** Phase 1-2 завершено, об'єднано в TEST_STRATEGY.md  
**Пакет:** `@mcp-abap-adt/adt-clients`  
**Мета:** Уніфікувати всі тести під `setupTestEnvironment` та загальний `getConfig`

---

## 📊 Статус

- **Всього файлів:** ~112 тестів
- **Виправлено:** 15 (setupTestEnvironment) + 8 (auth+locks) = 23
- **Залишилось:** ~89

### Прогрес по категоріях

| Категорія | Всього | Виправлено | Залишилось | Примітки |
|-----------|--------|------------|------------|----------|
| � КРИТИЧНО: ClassBuilder конфлікт | 1 | 1 | 0 | ✅ DONE |
| Integration тести | 3 | 3 | 0 | ✅ DONE |
| Client тести | 4 | 0 | 4 | |
| unit/class | 9 | 9 | 0 | ✅ DONE (incl. auth+locks) |
| unit/functionModule | 9 | 2 | 7 | 1 create + 1 lock (auth+locks) |
| unit/functionGroup | 7 | 4 | 3 | 3 + 1 lock (auth only) |
| unit/program | 9 | 1 | 8 | 1 lock (auth+locks) |
| unit/interface | 9 | 1 | 8 | 1 lock (auth+locks) |
| unit/table | 8 | 0 | 8 | |
| unit/structure | 8 | 0 | 8 | |
| unit/view | 8 | 1 | 7 | 1 lock (auth+locks) |
| unit/package | 9 | 0 | 9 | |
| unit/shared | 6 | 0 | 6 | |
| unit/domain | 1 | 1 | 0 | ✅ DONE (auth+locks) |
| unit/dataElement | 1 | 1 | 0 | ✅ DONE (auth+locks) |
| unit/transport | 1 | 0 | 1 | |

---

## Phase 1: CRITICAL - ClassBuilder Conflict ✅ COMPLETE
**Priority:** CRITICAL (blocks parallel test execution)  
**Time:** 15 min  
**Status:** ✅ DONE (2025-11-16)

Conflicts:
- `ClassBuilder.test.ts` uses `getEnabledTestCase('create_class', 'basic_class')`
- `create.test.ts` uses `getEnabledTestCase('create_class', 'basic_class')`
- Both create `ZCL_TEST_BASIC` → conflict!

Solution:
- [x] Add new test case `builder_class` to `tests/test-config.yaml`
- [x] Update `ClassBuilder.test.ts` to use `builder_class` instead

---

## Phase 2: Integration Tests ✅ COMPLETE
**Priority:** HIGH  
**Time:** 30 min  
**Status:** ✅ DONE (2025-11-16)

Files (3):
- [x] `integration/class.workflow.test.ts`
- [x] `integration/functionModule.workflow.test.ts`
- [x] `integration/testLockRecovery.integration.test.ts`

---

## 🔧 ПРОБЛЕМА 2: Непослідовне використання setupTestEnvironment

### Що треба виправити

#### Патерн для заміни:

**Було:**
```typescript
import * as dotenv from 'dotenv';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  // ... 50+ рядків
}

describe('Test', () => {
  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    hasConfig = true;
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });
});
```

**Стане:**
```typescript
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';

describe('Test', () => {
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    const env = await setupTestEnvironment(connection, 'module_operation', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    hasConfig = true;
  });

  afterEach(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });
});
```

---

## 📝 ПЛАН ВИПРАВЛЕННЯ

### ФАЗА 1: КРИТИЧНЕ (Пріоритет 🔴)

**Мета:** Виправити конфлікти, які блокують паралельне виконання

- [ ] **1.1** Додати `builder_class` test case в `test-config.yaml`
- [ ] **1.2** Виправити `unit/class/ClassBuilder.test.ts` → використовувати `builder_class`

**Оцінка часу:** 15 хв

---

### ФАЗА 2: Integration тести (Пріоритет 🟠)

**Мета:** Уніфікувати integration тести

- [ ] **2.1** `integration/class.workflow.test.ts`
  - Замінити власний getConfig на import з helpers/sessionConfig
  - Додати setupTestEnvironment в beforeEach
  - Додати cleanupTestEnvironment в afterEach

- [ ] **2.2** `integration/functionModule.workflow.test.ts`
  - Те саме

- [ ] **2.3** `integration/testLockRecovery.integration.test.ts`
  - Те саме (але залишити специфічну логіку lock recovery)

**Оцінка часу:** 30 хв

---

### ФАЗА 3: Client тести (Пріоритет 🟠)

**Мета:** Уніфікувати високорівневі Client API тести

- [ ] **3.1** `CheckClient.integration.test.ts`
- [ ] **3.2** `ManagementClient.integration.test.ts`
- [ ] **3.3** `CrudClient.integration.test.ts`
- [ ] **3.4** `ReadOnlyClient.integration.test.ts`

**Оцінка часу:** 40 хв

---

### ФАЗА 4: Завершити unit/class (Пріоритет 🟡)

**Мета:** Довести до 100% покриття

- [ ] **4.1** `unit/class/lock.test.ts`

**Оцінка часу:** 10 хв

---

### ФАЗА 5: unit/functionModule (Пріоритет 🟡)

**Мета:** Виправити 8 файлів

- [ ] **5.1** `validate.test.ts`
- [ ] **5.2** `delete.test.ts`
- [ ] **5.3** `check.test.ts`
- [ ] **5.4** `update.test.ts`
- [ ] **5.5** `read.test.ts`
- [ ] **5.6** `lock.test.ts`
- [ ] **5.7** `unlock.test.ts`
- [ ] **5.8** `activate.test.ts`
- [ ] **5.9** `FunctionModuleBuilder.test.ts` (+ окремий test case!)

**Оцінка часу:** 1 год

---

### ФАЗА 6: unit/functionGroup (Пріоритет 🟡)

**Мета:** Виправити 4 файли

- [ ] **6.1** `activate.test.ts`
- [ ] **6.2** `lock.test.ts`
- [ ] **6.3** `unlock.test.ts`
- [ ] **6.4** `FunctionGroupBuilder.test.ts` (+ окремий test case!)

**Оцінка часу:** 30 хв

---

### ФАЗА 7: Масові виправлення (Пріоритет 🟢)

**Мета:** Виправити всі решта модулів за єдиним шаблоном

#### 7.1 unit/program (9 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] delete.test.ts
- [ ] check.test.ts
- [ ] validate.test.ts
- [ ] activate.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] ProgramBuilder.test.ts (+ окремий test case!)

#### 7.2 unit/interface (9 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] check.test.ts
- [ ] validate.test.ts
- [ ] activate.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] InterfaceBuilder.test.ts (+ окремий test case!)

#### 7.3 unit/table (8 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] check.test.ts
- [ ] activate.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] TableBuilder.test.ts (+ окремий test case!)

#### 7.4 unit/structure (8 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] check.test.ts
- [ ] activate.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] StructureBuilder.test.ts (+ окремий test case!)

#### 7.5 unit/view (8 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] check.test.ts
- [ ] activate.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] ViewBuilder.test.ts (+ окремий test case!)

#### 7.6 unit/package (9 файлів)
- [ ] create.test.ts
- [ ] read.test.ts
- [ ] update.test.ts
- [ ] check.test.ts
- [ ] validation.test.ts
- [ ] transportCheck.test.ts
- [ ] lock.test.ts
- [ ] unlock.test.ts
- [ ] PackageBuilder.test.ts (+ окремий test case!)

#### 7.7 unit/shared (6 файлів)
- [ ] tableContents.test.ts
- [ ] readMetadata.test.ts
- [ ] search.test.ts
- [ ] whereUsed.test.ts
- [ ] sqlQuery.test.ts
- [ ] readSource.test.ts

#### 7.8 Інші (3 файли)
- [ ] unit/domain/DomainBuilder.test.ts (+ окремий test case!)
- [ ] unit/transport/TransportBuilder.test.ts
- [ ] unit/dataElement/DataElementBuilder.test.ts (вже OK!)

**Оцінка часу:** 3-4 год

---

## 🎯 Загальна оцінка часу

- **ФАЗА 1 (КРИТИЧНО):** 15 хв ⚡
- **ФАЗА 2 (Integration):** 30 хв
- **ФАЗА 3 (Clients):** 40 хв
- **ФАЗА 4-6 (FM/FG/Class):** 1.5 год
- **ФАЗА 7 (Масові):** 3-4 год

**ВСЬОГО:** ~6-7 годин чистої роботи

---

## 📋 Чеклист для кожного файлу

При виправленні кожного тесту:

- [ ] Видалити власну функцію `getConfig()`
- [ ] Видалити `import * as dotenv` та `dotenv.config()`
- [ ] Додати `import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig'`
- [ ] Додати змінні `sessionId` та `testConfig`
- [ ] Замінити `beforeAll` на `beforeEach` з викликом `setupTestEnvironment`
- [ ] Замінити `afterAll` на `afterEach` з викликом `cleanupTestEnvironment`
- [ ] Для Builder тестів: додати окремий test case в yaml
- [ ] Перевірити що тест компілюється без помилок
- [ ] Запустити тест і переконатись що він проходить

---

## 🚀 Початок роботи

**Наступний крок:** Починаємо з ФАЗИ 1 - виправлення ClassBuilder конфлікту

---

## 📌 ВАЖЛИВО: Є також TEST_FIXES_ROADMAP.md

**Статус:** В процесі (2025-11-17)

Цей roadmap фокусується на **setupTestEnvironment міграції**.

Для **auth pattern, lock persistence, та test logging** дивіться:
- `/TEST_FIXES_ROADMAP.md` - основний roadmap для виправлення тестів
  - Phase 1: Lock Tests - ✅ 100% (8/8) - auth + lock persistence
  - Phase 2: Create Tests Cleanup - ⏳ 5% - unlock-before-delete + logging
  - Phase 5: Test Logging Pattern - ⏳ 3% - configurable LOG_LEVEL

Обидва roadmap'и працюють паралельно:
- `TESTS_REFACTORING_ROADMAP.md` - міграція на setupTestEnvironment
- `TEST_FIXES_ROADMAP.md` - auth, locks, cleanup, logging

---

**Останнє оновлення:** 2025-11-17
