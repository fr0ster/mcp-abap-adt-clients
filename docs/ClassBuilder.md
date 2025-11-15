# ClassBuilder - Fluent API з Promise Chaining

`ClassBuilder` надає fluent API для роботи з ABAP класами з підтримкою стандартного TypeScript Promise chaining.

## Основні можливості

1. **Promise Chaining** - стандартний TypeScript спосіб через `.then()`, `.catch()`, `.finally()`
2. **Автоматичне переривання ланцюга** - при першій помилці ланцюг зупиняється
3. **Збереження результатів** - всі результати зберігаються в стані builder'а
4. **Обробка помилок** - `.catch()` для обробки помилок
5. **Cleanup** - `.finally()` завжди виконується, навіть при помилці

## Створення Builder

```typescript
import { ClassBuilder } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const connection = createAbapConnection(config, logger);

const builder = new ClassBuilder(connection, logger, {
  className: 'ZCL_TEST',
  packageName: 'ZOK_TEST_PKG_01',
  transportRequest: 'E19K905635',
})
  .setCode('CLASS ZCL_TEST DEFINITION...');
```

## Promise Chaining

### Базовий приклад

```typescript
await builder
  .validate()
  .then(b => b.create())
  .then(b => b.lock())
  .then(b => b.update())
  .then(b => b.check())
  .then(b => b.unlock())
  .then(b => b.activate())
  .catch(error => {
    // Обробка помилок
    console.error('Operation failed:', error);
  })
  .finally(() => {
    // Cleanup - завжди виконується
    console.log('Cleanup');
  });
```

### Як працює переривання ланцюга

При помилці в будь-якому методі, ланцюг автоматично переривається (стандартна поведінка Promise):

```typescript
await builder
  .validate()  // ✅ Успішно
  .then(b => b.create())  // ✅ Успішно
  .then(b => b.lock())  // ❌ Помилка - ланцюг переривається
  .then(b => b.update())  // ⏭️ НЕ виконується
  .then(b => b.check())  // ⏭️ НЕ виконується
  .catch(error => {
    // Виконується тут
    console.error('Error at lock:', error);
  });
```

### Отримання результатів

Всі результати зберігаються в стані builder'а:

```typescript
await builder
  .validate()
  .then(b => {
    const validationResult = b.getValidationResult();
    console.log('Validation:', validationResult?.valid);
    return b.create();
  })
  .then(b => {
    const createResult = b.getCreateResult();
    console.log('Create status:', createResult?.status);
    return b.lock();
  })
  .then(b => {
    const lockHandle = b.getLockHandle();
    console.log('Lock handle:', lockHandle);
    return b.update();
  });

// Отримати всі результати
const allResults = builder.getResults();
console.log('All results:', allResults);
```

### Обробка помилок

```typescript
await builder
  .validate()
  .then(b => b.create())
  .then(b => b.lock())
  .then(b => b.update())
  .catch(error => {
    // Обробка помилок
    console.error('Error:', error);
    
    // Отримати всі помилки з ланцюга
    const errors = builder.getErrors();
    console.error('All errors:', errors);
    
    // Cleanup при помилці
    if (builder.getLockHandle()) {
      builder.unlock().catch(console.error);
    }
  })
  .finally(() => {
    // Завжди виконується
    console.log('Cleanup completed');
  });
```

### Умовна логіка

```typescript
await builder
  .validate()
  .then(b => {
    const validationResult = b.getValidationResult();
    if (validationResult?.valid) {
      return b.create();
    } else {
      throw new Error(`Validation failed: ${validationResult?.message}`);
    }
  })
  .then(b => b.lock())
  .then(b => {
    // Умовна логіка
    if (shouldUpdate) {
      return b.update();
    } else {
      return b; // Пропустити update
    }
  })
  .then(b => b.check())
  .then(b => b.unlock())
  .then(b => b.activate());
```

## Методи Builder

### Конфігурація

```typescript
builder
  .setPackage('ZOK_TEST_PKG_01')
  .setRequest('E19K905635')
  .setName('ZCL_TEST')
  .setCode('CLASS ZCL_TEST DEFINITION...')
  .setDescription('Test class')
  .setSuperclass('CL_OBJECT')
  .setFinal(false)
  .setAbstract(false)
  .setCreateProtected(false);
```

### Операції

Всі операції повертають `Promise<this>` для chaining:

- `validate()` - валідація імені класу
- `create()` - створення класу
- `lock()` - блокування класу
- `update(sourceCode?)` - оновлення коду
- `check(version?)` - перевірка синтаксису
- `unlock()` - розблокування
- `activate()` - активація

## Отримання результатів

### Окремі результати

```typescript
const validationResult = builder.getValidationResult();
const createResult = builder.getCreateResult();
const lockHandle = builder.getLockHandle();
const updateResult = builder.getUpdateResult();
const checkResult = builder.getCheckResult();
const unlockResult = builder.getUnlockResult();
const activateResult = builder.getActivateResult();
```

### Всі результати

```typescript
const results = builder.getResults();
// {
//   validation?: ValidationResult;
//   create?: AxiosResponse;
//   update?: AxiosResponse;
//   check?: AxiosResponse;
//   unlock?: AxiosResponse;
//   activate?: AxiosResponse;
//   lockHandle?: string;
//   errors: Array<{ method: string; error: Error; timestamp: Date }>;
// }
```

### Стан builder'а

```typescript
const state = builder.getState();
// Readonly<ClassBuilderState>
```

### Помилки

```typescript
const errors = builder.getErrors();
// ReadonlyArray<{ method: string; error: Error; timestamp: Date }>
```

## Повний приклад

```typescript
import { ClassBuilder } from '@mcp-abap-adt/adt-clients';
import { createAbapConnection } from '@mcp-abap-adt/connection';

const logger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

const connection = createAbapConnection(config, logger);

const builder = new ClassBuilder(connection, logger, {
  className: 'ZCL_TEST',
  packageName: 'ZOK_TEST_PKG_01',
  transportRequest: 'E19K905635',
})
  .setCode('CLASS ZCL_TEST DEFINITION...');

try {
  await builder
    .validate()
    .then(b => {
      console.log('✅ Validation passed');
      return b.create();
    })
    .then(b => {
      console.log('✅ Class created');
      return b.lock();
    })
    .then(b => {
      console.log('✅ Class locked');
      return b.update();
    })
    .then(b => {
      console.log('✅ Source updated');
      return b.check();
    })
    .then(b => {
      console.log('✅ Check passed');
      return b.unlock();
    })
    .then(b => {
      console.log('✅ Class unlocked');
      return b.activate();
    })
    .then(b => {
      console.log('✅ Class activated');
      console.log('All results:', b.getResults());
    })
    .catch(error => {
      console.error('❌ Operation failed:', error);
      console.error('Errors:', builder.getErrors());
      
      // Cleanup при помилці
      if (builder.getLockHandle()) {
        builder.unlock().catch(console.error);
      }
    })
    .finally(() => {
      console.log('🏁 Cleanup completed');
    });
} catch (error) {
  console.error('Fatal error:', error);
}
```

## Переваги

1. **Стандартний TypeScript** - використовує нативний Promise chaining
2. **Автоматичне переривання** - ланцюг зупиняється при помилці
3. **Збереження результатів** - всі результати доступні через getters
4. **Обробка помилок** - `.catch()` для обробки помилок
5. **Cleanup** - `.finally()` завжди виконується
6. **Типізація** - повна підтримка TypeScript
7. **Логування** - всі операції логуються через logger

