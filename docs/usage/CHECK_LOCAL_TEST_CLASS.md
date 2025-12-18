# Check Local Test Class

## Question
Can a regular `check` for a class validate a local test class?

## Answer
**NO**, a regular class `check` **CANNOT** validate a local test class.

## Reasons

1. **Different artifact URIs**:
   - Main class code: `/sap/bc/adt/oo/classes/zadt_bld_cls444/source/main`
   - Test class code: `/sap/bc/adt/oo/classes/zadt_bld_cls444/includes/testclasses`

2. **Separate include file**: Local test classes are stored in a separate include file (`testclasses`), not in the main class code

## Solution

To check a local test class, you need to use a special `checkRun` with an artifact for the `testclasses` include.

### API

#### Using AdtClient (Recommended)

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection, logger);

// Use getLocalTestClass() for local test class operations
await client.getLocalTestClass().check({
  className: 'ZCL_MY_CLASS',
  testClassCode: testClassSource
});
```

#### Using CrudClient

```typescript
import { CrudClient } from '@mcp-abap-adt/adt-clients';

const client = new CrudClient(connection);

await client.checkClassTestClass({
  className: 'ZCL_MY_CLASS',
  testClassCode: testClassSource
});
```

#### Using ClassBuilder (Low-Level)

```typescript
import { ClassBuilder } from '@mcp-abap-adt/adt-clients';

const builder = new ClassBuilder(connection, { className: 'ZCL_MY_CLASS' });

await builder
  .setTestClassCode(testClassSource)
  .checkTestClass();
```

#### Low-Level Function (For Special Cases)

```typescript
import { checkClassLocalTestClass } from '@mcp-abap-adt/adt-clients';

await checkClassLocalTestClass(
  connection,
  className,      // Container class name
  testClassSource, // Test class code
  'inactive'      // Version: 'active' or 'inactive'
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

### Error Response

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

**Important**: `chkrun:type="E"` means Error - the function will throw an exception.

### Success Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:triggeringUri="/sap/bc/adt/oo/classes/zadt_bld_cls444" chkrun:status="processed" chkrun:statusText="Object ZADT_BLD_CLS444 has been checked">
    <chkrun:checkMessageList/>
  </chkrun:checkReport>
</chkrun:checkRunReports>
```

## Usage in ClassBuilder

The function is automatically called before updating the test class:

```typescript
const builder = new ClassBuilder(connection, { className: 'ZADT_BLD_CLS01' });

await builder
  .lock()
  .setTestClassCode(testClassSource)
  .updateTestClass(); // ← Automatically calls checkTestClass() before update
```

Or it can be called separately:

```typescript
await builder
  .setTestClassCode(testClassSource)
  .checkTestClass(); // ← Validates code without updating
```

## Benefits of Validation

1. **Pre-save validation**: Detects errors in code before SAP attempts to save changes
2. **Time savings**: No need to wait for unlock/rollback on errors
3. **Clear messages**: SAP returns detailed error descriptions with line numbers
4. **Safety**: Object does not remain in an incorrect state

## Message Types

- `chkrun:type="E"` - **Error** (blocks update)
- `chkrun:type="W"` - **Warning** (allowed)
- `chkrun:type="I"` - **Info** (allowed)

## Example

See [examples/check-test-class.js](../examples/check-test-class.js)
