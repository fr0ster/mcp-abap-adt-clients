# Debugging

This project uses scoped debug flags for integration tests and library code.

## Scopes

- `DEBUG_CONNECTORS=true` - connection logs from `@mcp-abap-adt/connection`.
- `DEBUG_ADT_LIBS=true` - core library logs from `Adt*` objects.
- `DEBUG_ADT_TESTS=true` - integration test workflow logs.
- `DEBUG_ADT_E2E_TESTS=true` - E2E test logs.
- `DEBUG_ADT_HELPER_TESTS=true` - helper/test utility logs.

## Examples

```bash
DEBUG_CONNECTORS=true npm test
DEBUG_ADT_LIBS=true npm test
DEBUG_ADT_TESTS=true npm test
DEBUG_ADT_E2E_TESTS=true npm test
DEBUG_ADT_HELPER_TESTS=true npm test
```

## Logger Usage in Tests

Integration tests typically create three loggers:

- Connection logger (DEBUG_CONNECTORS)
- Library logger (DEBUG_ADT_LIBS)
- Test logger (DEBUG_ADT_TESTS)

```typescript
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';

const connectionLogger = createConnectionLogger();
const libsLogger = createBuilderLogger();
const testsLogger = createTestsLogger();
```

`createBuilderLogger()` is still the helper name used for library logs, but it now targets `Adt*` objects.
