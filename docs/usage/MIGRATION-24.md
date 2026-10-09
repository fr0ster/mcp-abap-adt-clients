# Migrating to 24.0.0

24.0.0 removes the unit-test handlers. **A unit test is not an object type** —
it is a local test class, and it lives in the `testclasses` include of a global
class: the class under test, or a container made for the purpose, which is what
a CDS view's tests need because a view cannot hold a class. So the library
groups it the way it groups everything else, by the object each request
touches.

`getUnitTest()` and `getCdsUnitTest()` had no request of their own. Measured
against the endpoints, every member was another handler's request under a
second name:

| member | was | is, since 24.0.0 |
|---|---|---|
| `getUnitTest().create`, `getCdsUnitTest().create` | the class's POST | `client.getClass().create(…)` — for a CDS container pass `classTemplate` and `final: true`, which `getCdsUnitTest().create` added for you |
| `validate` (both) | the class-name validation | `client.getClass().validate(…)` |
| `read`, `readMetadata` | the local test class's GET | `client.getLocalTestClass().read(…)`, `.readMetadata(…)` |
| `update` | the local test class's PUT | `client.getLocalTestClass().update(…)` — then `getClass().activate(…)`, which `getCdsUnitTest().update` did after the write |
| `getUnitTest().delete` | the local test class's empty PUT | `client.getLocalTestClass().delete(…)` |
| `getCdsUnitTest().delete` | the class's DELETE | `client.getClass().delete(…)` |
| `lock`, `unlock` | the class's LOCK/UNLOCK | `client.getClass().lock(…)`, `.unlock(…)` |
| `run`, `getStatus`, `getResult` | `/abapunit/runs`, `/abapunit/results` | `executor.getClassTestRunner().run(…)`, `.getStatus(…)`, `.getResult(…)` |
| `getCdsUnitTest().checkCdsTestDoubles` | `/aunit/dbtestdoubles/cds/validation` | `client.getDdl().checkCdsTestDoubles(…)` |

## Running

Running is an executor's, beside `classrun`. The runner takes a class name —
every test class in it — or a list of `{ containerClass, testClass }`:

```typescript
import { classTestRunnerDocuments, createAdtExecutor } from '@mcp-abap-adt/adt-clients';
import { analyseUnitTest, analyseUnitTestStart, unitTestRunId } from '@mcp-abap-adt/adt-strategies';

const executor = await createAdtExecutor(connection);
const runner = executor.getClassTestRunner({ ...classTestRunnerDocuments, run: unitTestRunId });

const started = await runner.run('ZCL_TESTS', { analyse: analyseUnitTestStart });
const runId = started.getResult().value;
const status = await runner.getStatus(runId, true);
const result = await runner.getResult(runId, { analyse: analyseUnitTest });
```

A report's tests run the same way, through `executor.getProgramTestRunner()`
and `run(programName)` — the test classes may sit in the report's source or in
an include it pulls in. A function group's through
`executor.getFunctionGroupTestRunner().run(groupName)`, one module's through
`executor.getFunctionModuleTestRunner().run(moduleName)`. All three are new in
24.0.0; there was no way to run them before.

**Integration test config.** Two new test cases, `run_program_unit_test` and
`run_function_group_unit_test`, are in `test-config.yaml.template`. Copy them
into your `test-config.yaml` to run the new suites.

The result set shrank to what a runner answers: `run`, `status`, `result`.
`IUnitTestResults` and `unitTestDocuments` are gone; `IClassTestRunnerResults`
and `classTestRunnerDocuments` replace them. A caller who put a strategy into
`unitTestDocuments.run` puts it into `classTestRunnerDocuments.run`.

**Legacy systems.** `createAdtExecutor` answers `AdtExecutorLegacy` below 7.50,
the way `createAdtClient` answers `AdtClientLegacy`. Its runner posts to
`/abapunit/testruns`, whose POST answers the finished result, and refuses
`getStatus`/`getResult` without a request — the behaviour `AdtClientLegacy
.getUnitTest()` had. The legacy format addresses classes only, so a list of test
definitions runs each distinct container whole.

## The CDS check

`checkCdsTestDoubles` is a question about the view, so it is the view's handler
that asks it. Its answer has its own slot in the DDL result set,
`ddlDocuments.testDoubles` (it was `unitTestDocuments.cdsCheck`); pass
`analyseCdsTestDoubles` to read `SEVERITY` as the verdict. On a legacy system
`AdtDdlLegacy` refuses it without a request — the endpoint does not exist there,
which is why `AdtClientLegacy.getCdsUnitTest()` threw.

A consumer passing its own `IDdlResults` adds a `testDoubles` strategy.

## `AdtClass`

`lockTestClasses`, `unlockTestClasses` and `checkTestClass` are gone. The first
two were `lock` and `unlock` of the same class — minus the lock tracker, so a
lock taken through them was invisible to it. The third was
`getLocalTestClass().check`'s request. Use those.

## Also removed

- `AdtUnitTest`, `AdtCdsUnitTest`, `AdtUnitTestLegacy` and `core/unitTest`.
- The second copy of the run module: `startClassUnitTestRun`,
  `startClassUnitTestRunByObject`, `getClassUnitTestStatus` and
  `getClassUnitTestResult` existed byte for byte in two files. The exported
  ones, from the class module, stay.
