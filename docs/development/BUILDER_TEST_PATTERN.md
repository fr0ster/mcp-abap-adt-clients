# Integration Test Pattern

This document describes the current integration test pattern using `AdtClient` and `BaseTester`.

## Key Components

- `BaseTester` standardizes CRUD flows and read-only checks.
- `TestConfigResolver` resolves params and environment defaults.
- `builderTestLogger` handles structured test start/step/end output.

## Typical Flow Test

```typescript
const tester = new BaseTester(
  client.getClass(),
  'Class',
  'create_class',
  'adt_class',
  testsLogger,
);

tester.setup({
  connection,
  client,
  hasConfig,
  isCloudSystem,
  buildConfig: (testCase, resolver) => ({
    className: resolver.getParam('class_name'),
    packageName: resolver.getPackageName(),
    description: resolver.getParam('description'),
    sourceCode: resolver.getParam('source_code'),
  }),
});

await tester.flowTestAuto({
  sourceCode: config.sourceCode,
  updateConfig: { className: config.className },
});
```

## Logging

- `DEBUG_CONNECTORS` → connection logs
- `DEBUG_ADT_LIBS` → library logs (`Adt*` objects)
- `DEBUG_ADT_TESTS` → test flow logs

## Read Tests

Use `tester.readTest()` or `tester.readTestAuto()` to verify `read` + `readMetadata`.
