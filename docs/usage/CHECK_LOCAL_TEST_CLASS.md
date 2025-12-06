# Check Local Test Class

## Питання
Чи можна звичайним check для класу перевірити локальний тест-клас?

## Відповідь
**НІ**, звичайний check класу НЕ МОЖЕ перевірити локальний тест-клас.

## Причини

1. **Різні URI артефактів**:
   - Main class code: `/sap/bc/adt/oo/classes/zadt_bld_cls444/source/main`
   - Test class code: `/sap/bc/adt/oo/classes/zadt_bld_cls444/includes/testclasses`

2. **Окремий include файл**: Локальні тест-класи зберігаються в окремому include файлі (`testclasses`), а не в основному коді класу

## Рішення

Для перевірки локального тест-класу потрібно використовувати спеціальний checkRun з артефактом для `testclasses` include.

### API

#### Через CrudClient (рекомендовано)

```typescript
import { CrudClient } from '@mcp-abap-adt/adt-clients';

const client = new CrudClient(connection);

await client.checkClassTestClass({
  className: 'ZCL_MY_CLASS',
  testClassCode: testClassSource
});
```

#### Через ClassBuilder

```typescript
import { ClassBuilder } from '@mcp-abap-adt/adt-clients';

const builder = new ClassBuilder(connection, { className: 'ZCL_MY_CLASS' });

await builder
  .setTestClassCode(testClassSource)
  .checkTestClass();
```

#### Низькорівнева функція (для спеціальних випадків)

```typescript
import { checkClassLocalTestClass } from '@mcp-abap-adt/adt-clients';

await checkClassLocalTestClass(
  connection,
  className,      // Ім'я класу-контейнера
  testClassSource, // Код тест-класу
  'inactive'      // Версія: 'active' або 'inactive'
);
```

### HTTP Request

```http
POST /sap/bc/adt/checkruns?reporters=abapCheckRun HTTP/1.1
Accept: application/vnd.sap.adt.checkmessages+xml
Content-Type: application/vnd.sap.adt.checkobjects+xml

<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/zadt_bld_cls444" chkrun:version="inactive">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="/sap/bc/adt/oo/classes/zadt_bld_cls444/includes/testclasses">
        <chkrun:content>BASE64_ENCODED_TEST_CLASS_CODE</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>
```

### Response з помилкою

```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:triggeringUri="/sap/bc/adt/oo/classes/zadt_bld_cls444" chkrun:status="processed" chkrun:statusText="Object ZADT_BLD_CLS444 has been checked">
    <chkrun:checkMessageList>
      <chkrun:checkMessage chkrun:uri="/sap/bc/adt/oo/classes/zadt_bld_cls444/includes/testclasses#start=15,24;end=15,38" chkrun:type="E" chkrun:shortText="The type &quot;ZADT_BLD_CLS01&quot; is unknown..." chkrun:code="MESSAGE(GWO)"/>
    </chkrun:checkMessageList>
  </chkrun:checkReport>
</chkrun:checkRunReports>
```

**Важливо**: `chkrun:type="E"` означає помилку (Error), функція кине виключення.

### Response без помилок

```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:triggeringUri="/sap/bc/adt/oo/classes/zadt_bld_cls444" chkrun:status="processed" chkrun:statusText="Object ZADT_BLD_CLS444 has been checked">
    <chkrun:checkMessageList/>
  </chkrun:checkReport>
</chkrun:checkRunReports>
```

## Використання в ClassBuilder

Функція автоматично викликається перед оновленням тест-класу:

```typescript
const builder = new ClassBuilder(connection, { className: 'ZADT_BLD_CLS01' });

await builder
  .lock()
  .setTestClassCode(testClassSource)
  .updateTestClass(); // ← Автоматично викликає checkTestClass() перед оновленням
```

Або можна викликати окремо:

```typescript
await builder
  .setTestClassCode(testClassSource)
  .checkTestClass(); // ← Перевіряє код без оновлення
```

## Переваги перевірки

1. **Валідація до збереження**: Виявляє помилки в коді до того, як SAP спробує зберегти зміни
2. **Економія часу**: Не потрібно чекати unlock/rollback при помилках
3. **Чіткі повідомлення**: SAP повертає детальний опис помилок з номерами рядків
4. **Безпека**: Об'єкт не залишається в некоректному стані

## Типи повідомлень

- `chkrun:type="E"` - **Error** (помилка, блокує update)
- `chkrun:type="W"` - **Warning** (попередження, дозволено)
- `chkrun:type="I"` - **Info** (інформація, дозволено)

## Приклад

Дивіться [examples/check-test-class.js](../examples/check-test-class.js)
