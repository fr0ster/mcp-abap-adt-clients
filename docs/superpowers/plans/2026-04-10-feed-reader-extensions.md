# Feed Reader Extensions & Runtime Client Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `AdtRuntimeClient` from ~80 flat methods into noun-style factory methods returning domain objects, and add new feed reader, system messages, and gateway error log modules.

**Architecture:** Two-track approach. Track A wraps existing low-level functions in domain object classes and refactors `AdtRuntimeClient` into a factory. Track B adds new modules (feeds parsing, system messages, gateway error log). All domain objects implement `IRuntimeAnalysisObject` marker interface. Feed-backed objects use `IFeedQueryOptions`; others keep existing domain-specific option types.

**Tech Stack:** TypeScript (strict), `fast-xml-parser` for Atom XML parsing, Jest for tests, Biome for formatting.

**Spec:** `docs/superpowers/specs/2026-04-10-feed-reader-extensions-design.md`

---

## Track A: Runtime Client Refactoring

### Task 1: Shared runtime interfaces

**Files:**
- Create: `src/runtime/types.ts`

- [ ] **Step 1: Create shared runtime interface types**

```typescript
// src/runtime/types.ts
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

/**
 * Marker interface for all runtime analysis domain objects.
 * These are NOT IAdtObject (not CRUD) — they represent
 * runtime analysis/monitoring capabilities.
 */
export interface IRuntimeAnalysisObject {}

/**
 * Generic listable runtime object.
 * Each domain supplies its own options type.
 */
export interface IListableRuntimeObject<TOptions = void>
  extends IRuntimeAnalysisObject {
  list(options?: TOptions): Promise<IAdtResponse>;
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/runtime/types.ts
git commit -m "feat(runtime): add IRuntimeAnalysisObject and IListableRuntimeObject interfaces"
```

---

### Task 2: Simple domain objects — St05Trace, DdicActivation, AtcLog

These are the simplest modules (1-2 methods each). Create all three to establish the pattern.

**Files:**
- Create: `src/runtime/traces/St05Trace.ts`
- Create: `src/runtime/ddic/DdicActivation.ts`
- Create: `src/runtime/atc/AtcLog.ts`
- Create: `src/__tests__/unit/runtime/St05Trace.test.ts`
- Create: `src/__tests__/unit/runtime/DdicActivation.test.ts`
- Create: `src/__tests__/unit/runtime/AtcLog.test.ts`

- [ ] **Step 1: Write failing test for St05Trace**

```typescript
// src/__tests__/unit/runtime/St05Trace.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { St05Trace } from '../../../runtime/traces/St05Trace';

describe('St05Trace domain object', () => {
  function createSt05Trace() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { st05: new St05Trace(connection, logger), connection };
  }

  it('getState delegates to /sap/bc/adt/st05/trace/state', async () => {
    const { st05, connection } = createSt05Trace();
    await st05.getState();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/st05/trace/state' }),
    );
  });

  it('getDirectory delegates to /sap/bc/adt/st05/trace/directory', async () => {
    const { st05, connection } = createSt05Trace();
    await st05.getDirectory();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/st05/trace/directory' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/St05Trace' --no-coverage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement St05Trace**

```typescript
// src/runtime/traces/St05Trace.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import { getSt05TraceState, getSt05TraceDirectory } from './st05';

export class St05Trace implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getState(): Promise<AxiosResponse> {
    return getSt05TraceState(this.connection);
  }

  async getDirectory(): Promise<AxiosResponse> {
    return getSt05TraceDirectory(this.connection);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/St05Trace' --no-coverage`
Expected: PASS

- [ ] **Step 5: Write failing test for DdicActivation**

```typescript
// src/__tests__/unit/runtime/DdicActivation.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { DdicActivation } from '../../../runtime/ddic/DdicActivation';

describe('DdicActivation domain object', () => {
  function createDdicActivation() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { ddic: new DdicActivation(connection, logger), connection };
  }

  it('getGraph delegates to activation graph endpoint', async () => {
    const { ddic, connection } = createDdicActivation();
    await ddic.getGraph({ objectName: 'ZTEST', objectType: 'TABL' });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/ddic/logs/activationgraph',
      }),
    );
  });
});
```

- [ ] **Step 6: Implement DdicActivation**

```typescript
// src/runtime/ddic/DdicActivation.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getActivationGraph,
  type IGetActivationGraphOptions,
} from './activationGraph';

export class DdicActivation implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getGraph(options?: IGetActivationGraphOptions): Promise<AxiosResponse> {
    return getActivationGraph(this.connection, options);
  }
}
```

- [ ] **Step 7: Write failing test for AtcLog**

```typescript
// src/__tests__/unit/runtime/AtcLog.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AtcLog } from '../../../runtime/atc/AtcLog';

describe('AtcLog domain object', () => {
  function createAtcLog() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { atc: new AtcLog(connection, logger), connection };
  }

  it('getCheckFailureLogs delegates to ATC endpoint', async () => {
    const { atc, connection } = createAtcLog();
    await atc.getCheckFailureLogs({ objName: 'ZTEST' });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/atc/checkfailures/logs',
      }),
    );
  });

  it('getExecutionLog delegates with executionId', async () => {
    const { atc, connection } = createAtcLog();
    await atc.getExecutionLog('exec123');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/atc/results/exec123/log',
      }),
    );
  });
});
```

- [ ] **Step 8: Implement AtcLog**

```typescript
// src/runtime/atc/AtcLog.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getCheckFailureLogs,
  getExecutionLog,
  type IGetCheckFailureLogsOptions,
} from './logs';

export class AtcLog implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getCheckFailureLogs(
    options?: IGetCheckFailureLogsOptions,
  ): Promise<AxiosResponse> {
    return getCheckFailureLogs(this.connection, options);
  }

  async getExecutionLog(executionId: string): Promise<AxiosResponse> {
    return getExecutionLog(this.connection, executionId);
  }
}
```

- [ ] **Step 9: Run all three tests**

Run: `npx jest --testPathPattern='unit/runtime/(St05Trace|DdicActivation|AtcLog)' --no-coverage`
Expected: PASS (all 5 tests)

- [ ] **Step 10: Commit**

```bash
git add src/runtime/traces/St05Trace.ts src/runtime/ddic/DdicActivation.ts src/runtime/atc/AtcLog.ts src/__tests__/unit/runtime/
git commit -m "feat(runtime): add St05Trace, DdicActivation, AtcLog domain objects"
```

---

### Task 3: ApplicationLog domain object

**Files:**
- Create: `src/runtime/applicationLog/ApplicationLog.ts`
- Create: `src/__tests__/unit/runtime/ApplicationLog.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/ApplicationLog.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { ApplicationLog } from '../../../runtime/applicationLog/ApplicationLog';

describe('ApplicationLog domain object', () => {
  function createApplicationLog() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { appLog: new ApplicationLog(connection, logger), connection };
  }

  it('getObject delegates to application log endpoint', async () => {
    const { appLog, connection } = createApplicationLog();
    await appLog.getObject('Z_MY_LOG');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG',
      }),
    );
  });

  it('getSource delegates to source endpoint', async () => {
    const { appLog, connection } = createApplicationLog();
    await appLog.getSource('Z_MY_LOG');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG/source/main',
      }),
    );
  });

  it('validateName delegates to validation endpoint', async () => {
    const { appLog, connection } = createApplicationLog();
    await appLog.validateName('Z_MY_LOG');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/validation',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/ApplicationLog' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement ApplicationLog**

```typescript
// src/runtime/applicationLog/ApplicationLog.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getApplicationLogObject,
  getApplicationLogSource,
  validateApplicationLogName,
  type IGetApplicationLogObjectOptions,
  type IGetApplicationLogSourceOptions,
} from './read';

export class ApplicationLog implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getObject(
    objectName: string,
    options?: IGetApplicationLogObjectOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogObject(this.connection, objectName, options);
  }

  async getSource(
    objectName: string,
    options?: IGetApplicationLogSourceOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogSource(this.connection, objectName, options);
  }

  async validateName(objectName: string): Promise<AxiosResponse> {
    return validateApplicationLogName(this.connection, objectName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/ApplicationLog' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/applicationLog/ApplicationLog.ts src/__tests__/unit/runtime/ApplicationLog.test.ts
git commit -m "feat(runtime): add ApplicationLog domain object"
```

---

### Task 4: CrossTrace domain object

**Files:**
- Create: `src/runtime/traces/CrossTrace.ts`
- Create: `src/__tests__/unit/runtime/CrossTrace.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/CrossTrace.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { CrossTrace } from '../../../runtime/traces/CrossTrace';

describe('CrossTrace domain object', () => {
  function createCrossTrace() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { ct: new CrossTrace(connection, logger), connection };
  }

  it('list delegates to cross trace endpoint', async () => {
    const { ct, connection } = createCrossTrace();
    await ct.list({ traceUser: 'TESTUSER' });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/crosstrace/traces' }),
    );
  });

  it('getById delegates with traceId', async () => {
    const { ct, connection } = createCrossTrace();
    await ct.getById('trace123');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/trace123',
      }),
    );
  });

  it('getRecords delegates with traceId', async () => {
    const { ct, connection } = createCrossTrace();
    await ct.getRecords('trace123');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/trace123/records',
      }),
    );
  });

  it('getRecordContent delegates with traceId and recordNumber', async () => {
    const { ct, connection } = createCrossTrace();
    await ct.getRecordContent('trace123', 5);
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/trace123/records/5/content',
      }),
    );
  });

  it('getActivations delegates to activations endpoint', async () => {
    const { ct, connection } = createCrossTrace();
    await ct.getActivations();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/activations',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/CrossTrace' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement CrossTrace**

```typescript
// src/runtime/traces/CrossTrace.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IListableRuntimeObject } from '../types';
import {
  listCrossTraces,
  getCrossTrace,
  getCrossTraceRecords,
  getCrossTraceRecordContent,
  getCrossTraceActivations,
  type IListCrossTracesOptions,
} from './crossTrace';

export class CrossTrace
  implements IListableRuntimeObject<IListCrossTracesOptions>
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IListCrossTracesOptions): Promise<AxiosResponse> {
    return listCrossTraces(this.connection, options);
  }

  async getById(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<AxiosResponse> {
    return getCrossTrace(this.connection, traceId, includeSensitiveData);
  }

  async getRecords(traceId: string): Promise<AxiosResponse> {
    return getCrossTraceRecords(this.connection, traceId);
  }

  async getRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<AxiosResponse> {
    return getCrossTraceRecordContent(
      this.connection,
      traceId,
      recordNumber,
    );
  }

  async getActivations(): Promise<AxiosResponse> {
    return getCrossTraceActivations(this.connection);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/CrossTrace' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/traces/CrossTrace.ts src/__tests__/unit/runtime/CrossTrace.test.ts
git commit -m "feat(runtime): add CrossTrace domain object"
```

---

### Task 5: Profiler domain object

**Files:**
- Create: `src/runtime/traces/Profiler.ts`
- Create: `src/__tests__/unit/runtime/Profiler.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/Profiler.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { Profiler } from '../../../runtime/traces/Profiler';

describe('Profiler domain object', () => {
  function createProfiler() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        status: 200,
        data: '',
        headers: {},
      }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { profiler: new Profiler(connection, logger), connection };
  }

  it('listTraceFiles delegates to trace files endpoint', async () => {
    const { profiler, connection } = createProfiler();
    await profiler.listTraceFiles();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces',
      }),
    );
  });

  it('getParameters delegates to trace parameters endpoint', async () => {
    const { profiler, connection } = createProfiler();
    await profiler.getParameters();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/parameters',
      }),
    );
  });

  it('listRequests delegates to trace requests endpoint', async () => {
    const { profiler, connection } = createProfiler();
    await profiler.listRequests();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/requests',
      }),
    );
  });

  it('buildParametersXml returns XML string', () => {
    const { profiler } = createProfiler();
    const xml = profiler.buildParametersXml({ description: 'test' });
    expect(xml).toContain('test');
  });

  it('getDefaultParameters returns default params', () => {
    const { profiler } = createProfiler();
    const params = profiler.getDefaultParameters();
    expect(params).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/Profiler' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement Profiler**

```typescript
// src/runtime/traces/Profiler.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  listTraceFiles,
  getTraceParameters,
  getTraceParametersForCallstack,
  getTraceParametersForAmdp,
  buildTraceParametersXml,
  createTraceParameters,
  extractProfilerIdFromResponse,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  getTraceHitList,
  getTraceStatements,
  getTraceDbAccesses,
  listTraceRequests,
  getTraceRequestsByUri,
  listObjectTypes,
  listProcessTypes,
  type IProfilerTraceParameters,
  type IProfilerTraceHitListOptions,
  type IProfilerTraceStatementsOptions,
  type IProfilerTraceDbAccessesOptions,
} from './profiler';

export class Profiler implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async listTraceFiles(): Promise<AxiosResponse> {
    return listTraceFiles(this.connection);
  }

  async getParameters(): Promise<AxiosResponse> {
    return getTraceParameters(this.connection);
  }

  async getParametersForCallstack(): Promise<AxiosResponse> {
    return getTraceParametersForCallstack(this.connection);
  }

  async getParametersForAmdp(): Promise<AxiosResponse> {
    return getTraceParametersForAmdp(this.connection);
  }

  buildParametersXml(options: IProfilerTraceParameters = {}): string {
    return buildTraceParametersXml(options);
  }

  async createParameters(
    options: IProfilerTraceParameters = {},
  ): Promise<AxiosResponse> {
    return createTraceParameters(this.connection, options);
  }

  extractIdFromResponse(response: AxiosResponse): string | undefined {
    return extractProfilerIdFromResponse(response);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }

  async getHitList(
    traceIdOrUri: string,
    options: IProfilerTraceHitListOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceHitList(this.connection, traceIdOrUri, options);
  }

  async getStatements(
    traceIdOrUri: string,
    options: IProfilerTraceStatementsOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceStatements(this.connection, traceIdOrUri, options);
  }

  async getDbAccesses(
    traceIdOrUri: string,
    options: IProfilerTraceDbAccessesOptions = {},
  ): Promise<AxiosResponse> {
    return getTraceDbAccesses(this.connection, traceIdOrUri, options);
  }

  async listRequests(): Promise<AxiosResponse> {
    return listTraceRequests(this.connection);
  }

  async getRequestsByUri(uri: string): Promise<AxiosResponse> {
    return getTraceRequestsByUri(this.connection, uri);
  }

  async listObjectTypes(): Promise<AxiosResponse> {
    return listObjectTypes(this.connection);
  }

  async listProcessTypes(): Promise<AxiosResponse> {
    return listProcessTypes(this.connection);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/Profiler' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/traces/Profiler.ts src/__tests__/unit/runtime/Profiler.test.ts
git commit -m "feat(runtime): add Profiler domain object"
```

---

### Task 6: RuntimeDumps domain object

**Files:**
- Create: `src/runtime/dumps/RuntimeDumps.ts`
- Create: `src/__tests__/unit/runtime/RuntimeDumps.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/RuntimeDumps.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { RuntimeDumps } from '../../../runtime/dumps/RuntimeDumps';

describe('RuntimeDumps domain object', () => {
  function createRuntimeDumps() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { dumps: new RuntimeDumps(connection, logger), connection };
  }

  it('list delegates to runtime dumps endpoint', async () => {
    const { dumps, connection } = createRuntimeDumps();
    await dumps.list({ top: 10 });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps?%24top=10',
      }),
    );
  });

  it('listByUser delegates with user query', async () => {
    const { dumps, connection } = createRuntimeDumps();
    await dumps.listByUser('TESTUSER', { top: 5 });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('TESTUSER'),
      }),
    );
  });

  it('getById delegates to dump endpoint', async () => {
    const { dumps, connection } = createRuntimeDumps();
    await dumps.getById('DUMP123');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dump/DUMP123',
      }),
    );
  });

  it('getById supports view option', async () => {
    const { dumps, connection } = createRuntimeDumps();
    await dumps.getById('DUMP123', { view: 'summary' });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dump/DUMP123/summary',
      }),
    );
  });

  it('buildIdPrefix composes prefix from components', () => {
    const { dumps } = createRuntimeDumps();
    expect(
      dumps.buildIdPrefix('20260331215347', 'epbyminsd0654', 'E19', '00'),
    ).toBe('20260331215347epbyminsd0654_E19_00');
  });

  it('buildUserQuery returns undefined for empty user', () => {
    const { dumps } = createRuntimeDumps();
    expect(dumps.buildUserQuery()).toBeUndefined();
    expect(dumps.buildUserQuery('   ')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/RuntimeDumps' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement RuntimeDumps**

```typescript
// src/runtime/dumps/RuntimeDumps.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
  getRuntimeDumpById,
  type IRuntimeDumpsListOptions,
  type IRuntimeDumpReadOptions,
} from './read';

export class RuntimeDumps implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options: IRuntimeDumpsListOptions = {}): Promise<AxiosResponse> {
    return listRuntimeDumps(this.connection, options);
  }

  async listByUser(
    user?: string,
    options: Omit<IRuntimeDumpsListOptions, 'query'> = {},
  ): Promise<AxiosResponse> {
    return listRuntimeDumpsByUser(this.connection, user, options);
  }

  async getById(
    dumpId: string,
    options: IRuntimeDumpReadOptions = {},
  ): Promise<AxiosResponse> {
    return getRuntimeDumpById(this.connection, dumpId, options);
  }

  buildIdPrefix(
    datetime: string,
    hostname: string,
    sysid: string,
    instance: string,
  ): string {
    return buildDumpIdPrefix(datetime, hostname, sysid, instance);
  }

  buildUserQuery(user?: string): string | undefined {
    return buildRuntimeDumpsUserQuery(user);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/RuntimeDumps' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/dumps/RuntimeDumps.ts src/__tests__/unit/runtime/RuntimeDumps.test.ts
git commit -m "feat(runtime): add RuntimeDumps domain object"
```

---

### Task 7: AbapDebugger domain object

The largest domain object (~27 methods). Delegates to existing `src/runtime/debugger/abap.ts` functions.

**Files:**
- Create: `src/runtime/debugger/AbapDebugger.ts`
- Create: `src/__tests__/unit/runtime/AbapDebugger.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/AbapDebugger.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AbapDebugger } from '../../../runtime/debugger/AbapDebugger';

describe('AbapDebugger domain object', () => {
  function createDebugger() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { dbg: new AbapDebugger(connection, logger), connection };
  }

  it('launch delegates to debugger launch', async () => {
    const { dbg, connection } = createDebugger();
    await dbg.launch();
    expect(connection.makeAdtRequest).toHaveBeenCalled();
  });

  it('stop delegates to debugger stop', async () => {
    const { dbg, connection } = createDebugger();
    await dbg.stop();
    expect(connection.makeAdtRequest).toHaveBeenCalled();
  });

  it('getCallStack delegates correctly', async () => {
    const { dbg, connection } = createDebugger();
    await dbg.getCallStack();
    expect(connection.makeAdtRequest).toHaveBeenCalled();
  });

  it('buildBatchPayload returns payload object', () => {
    const { dbg } = createDebugger();
    const payload = dbg.buildBatchPayload(['req1']);
    expect(payload).toHaveProperty('boundary');
    expect(payload).toHaveProperty('body');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/AbapDebugger' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement AbapDebugger**

Create the domain object wrapping all debugger functions from `src/runtime/debugger/abap.ts`. This file imports all debugger utility functions and exposes them with simplified names (strip `Debugger` prefix where redundant).

```typescript
// src/runtime/debugger/AbapDebugger.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  launchDebugger,
  stopDebugger,
  getDebugger,
  getMemorySizes,
  getSystemArea,
  synchronizeBreakpoints,
  getBreakpointStatements,
  getBreakpointMessageTypes,
  getBreakpointConditions,
  validateBreakpoints,
  getVitBreakpoints,
  getVariableMaxLength,
  getVariableSubcomponents,
  getVariableAsCsv,
  getVariableAsJson,
  getVariableValueStatement,
  executeDebuggerAction,
  getCallStack,
  insertWatchpoint,
  getWatchpoints,
  executeBatchRequest,
  buildDebuggerBatchPayload,
  buildDebuggerStepWithStackBatchPayload,
  executeDebuggerStepBatch,
  stepIntoDebuggerBatch,
  stepOutDebuggerBatch,
  stepContinueDebuggerBatch,
  type ILaunchDebuggerOptions,
  type IStopDebuggerOptions,
  type IGetDebuggerOptions,
  type IGetSystemAreaOptions,
  type IGetVariableAsCsvOptions,
  type IGetVariableAsJsonOptions,
  type IGetVariableValueStatementOptions,
  type IDebuggerBatchPayload,
  type IAbapDebuggerStepMethod,
} from './abap';

export class AbapDebugger implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  // Session management
  async launch(options?: ILaunchDebuggerOptions): Promise<AxiosResponse> {
    return launchDebugger(this.connection, options);
  }

  async stop(options?: IStopDebuggerOptions): Promise<AxiosResponse> {
    return stopDebugger(this.connection, options);
  }

  async get(options?: IGetDebuggerOptions): Promise<AxiosResponse> {
    return getDebugger(this.connection, options);
  }

  async getMemorySizes(includeAbap?: boolean): Promise<AxiosResponse> {
    return getMemorySizes(this.connection, includeAbap);
  }

  async getSystemArea(
    systemarea: string,
    options?: IGetSystemAreaOptions,
  ): Promise<AxiosResponse> {
    return getSystemArea(this.connection, systemarea, options);
  }

  // Breakpoints
  async synchronizeBreakpoints(
    checkConflict?: boolean,
  ): Promise<AxiosResponse> {
    return synchronizeBreakpoints(this.connection, checkConflict);
  }

  async getBreakpointStatements(): Promise<AxiosResponse> {
    return getBreakpointStatements(this.connection);
  }

  async getBreakpointMessageTypes(): Promise<AxiosResponse> {
    return getBreakpointMessageTypes(this.connection);
  }

  async getBreakpointConditions(): Promise<AxiosResponse> {
    return getBreakpointConditions(this.connection);
  }

  async validateBreakpoints(): Promise<AxiosResponse> {
    return validateBreakpoints(this.connection);
  }

  async getVitBreakpoints(): Promise<AxiosResponse> {
    return getVitBreakpoints(this.connection);
  }

  // Variables
  async getVariableMaxLength(
    variableName: string,
    part: string,
    maxLength?: number,
  ): Promise<AxiosResponse> {
    return getVariableMaxLength(this.connection, variableName, part, maxLength);
  }

  async getVariableSubcomponents(
    variableName: string,
    part: string,
    component?: string,
    line?: number,
  ): Promise<AxiosResponse> {
    return getVariableSubcomponents(
      this.connection,
      variableName,
      part,
      component,
      line,
    );
  }

  async getVariableAsCsv(
    variableName: string,
    part: string,
    options?: IGetVariableAsCsvOptions,
  ): Promise<AxiosResponse> {
    return getVariableAsCsv(this.connection, variableName, part, options);
  }

  async getVariableAsJson(
    variableName: string,
    part: string,
    options?: IGetVariableAsJsonOptions,
  ): Promise<AxiosResponse> {
    return getVariableAsJson(this.connection, variableName, part, options);
  }

  async getVariableValueStatement(
    variableName: string,
    part: string,
    options?: IGetVariableValueStatementOptions,
  ): Promise<AxiosResponse> {
    return getVariableValueStatement(
      this.connection,
      variableName,
      part,
      options,
    );
  }

  // Actions & stack
  async executeAction(
    action: string,
    value?: string,
  ): Promise<AxiosResponse> {
    return executeDebuggerAction(this.connection, action, value);
  }

  async getCallStack(): Promise<AxiosResponse> {
    return getCallStack(this.connection);
  }

  // Watchpoints
  async insertWatchpoint(
    variableName: string,
    condition?: string,
  ): Promise<AxiosResponse> {
    return insertWatchpoint(this.connection, variableName, condition);
  }

  async getWatchpoints(): Promise<AxiosResponse> {
    return getWatchpoints(this.connection);
  }

  // Batch operations
  async executeBatchRequest(requests: string): Promise<AxiosResponse> {
    return executeBatchRequest(this.connection, requests);
  }

  buildBatchPayload(requests: string[]): IDebuggerBatchPayload {
    return buildDebuggerBatchPayload(requests);
  }

  buildStepWithStackBatchPayload(
    stepMethod: IAbapDebuggerStepMethod,
  ): IDebuggerBatchPayload {
    return buildDebuggerStepWithStackBatchPayload(stepMethod);
  }

  async executeStepBatch(
    stepMethod: IAbapDebuggerStepMethod,
  ): Promise<AxiosResponse> {
    return executeDebuggerStepBatch(this.connection, stepMethod);
  }

  async stepIntoBatch(): Promise<AxiosResponse> {
    return stepIntoDebuggerBatch(this.connection);
  }

  async stepOutBatch(): Promise<AxiosResponse> {
    return stepOutDebuggerBatch(this.connection);
  }

  async stepContinueBatch(): Promise<AxiosResponse> {
    return stepContinueDebuggerBatch(this.connection);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/AbapDebugger' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/debugger/AbapDebugger.ts src/__tests__/unit/runtime/AbapDebugger.test.ts
git commit -m "feat(runtime): add AbapDebugger domain object"
```

---

### Task 8: MemorySnapshots domain object

Memory snapshots are not yet on `AdtRuntimeClient` — they only exist as low-level functions in `src/runtime/memory/snapshots.ts`. This task wraps them.

**Files:**
- Create: `src/runtime/memory/MemorySnapshots.ts`
- Create: `src/__tests__/unit/runtime/MemorySnapshots.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/MemorySnapshots.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { MemorySnapshots } from '../../../runtime/memory/MemorySnapshots';

describe('MemorySnapshots domain object', () => {
  function createMemorySnapshots() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { mem: new MemorySnapshots(connection, logger), connection };
  }

  it('list delegates to snapshots endpoint', async () => {
    const { mem, connection } = createMemorySnapshots();
    await mem.list();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots',
      }),
    );
  });

  it('getById delegates with snapshotId', async () => {
    const { mem, connection } = createMemorySnapshots();
    await mem.getById('snap123');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/snap123',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/MemorySnapshots' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement MemorySnapshots**

Create the domain object. Read the full `snapshots.ts` to get all function signatures, then wrap them all.

```typescript
// src/runtime/memory/MemorySnapshots.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  listSnapshots,
  getSnapshot,
  getSnapshotOverview,
  getSnapshotRankingList,
  getSnapshotChildren,
  getSnapshotReferences,
  getSnapshotDeltaOverview,
  getSnapshotDeltaRankingList,
  getSnapshotDeltaChildren,
  getSnapshotDeltaReferences,
  type ISnapshotRankingListOptions,
  type ISnapshotChildrenOptions,
  type ISnapshotReferencesOptions,
} from './snapshots';

export class MemorySnapshots implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(user?: string, originalUser?: string): Promise<AxiosResponse> {
    return listSnapshots(this.connection, user, originalUser);
  }

  async getById(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshot(this.connection, snapshotId);
  }

  async getOverview(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshotOverview(this.connection, snapshotId);
  }

  async getRankingList(
    snapshotId: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotRankingList(this.connection, snapshotId, options);
  }

  async getChildren(
    snapshotId: string,
    objectId: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotChildren(this.connection, snapshotId, objectId, options);
  }

  async getReferences(
    snapshotId: string,
    objectId: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotReferences(
      this.connection,
      snapshotId,
      objectId,
      options,
    );
  }

  async getDeltaOverview(
    snapshotId: string,
    compareId: string,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaOverview(this.connection, snapshotId, compareId);
  }

  async getDeltaRankingList(
    snapshotId: string,
    compareId: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaRankingList(
      this.connection,
      snapshotId,
      compareId,
      options,
    );
  }

  async getDeltaChildren(
    snapshotId: string,
    compareId: string,
    objectId: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaChildren(
      this.connection,
      snapshotId,
      compareId,
      objectId,
      options,
    );
  }

  async getDeltaReferences(
    snapshotId: string,
    compareId: string,
    objectId: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaReferences(
      this.connection,
      snapshotId,
      compareId,
      objectId,
      options,
    );
  }
}
```

**Important:** Before implementing, read `src/runtime/memory/snapshots.ts` fully to verify all function signatures match. The implementation above is based on the spec's mapping table — adjust parameter order if the actual low-level functions differ.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/MemorySnapshots' --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/memory/MemorySnapshots.ts src/__tests__/unit/runtime/MemorySnapshots.test.ts
git commit -m "feat(runtime): add MemorySnapshots domain object"
```

---

### Task 9: Update runtime module exports

Update each module's `index.ts` to export the new domain object class, and update `src/runtime/index.ts`.

**Files:**
- Modify: `src/runtime/traces/index.ts`
- Modify: `src/runtime/ddic/index.ts`
- Modify: `src/runtime/atc/index.ts`
- Modify: `src/runtime/applicationLog/index.ts`
- Modify: `src/runtime/dumps/index.ts`
- Modify: `src/runtime/debugger/index.ts`
- Modify: `src/runtime/memory/index.ts`
- Modify: `src/runtime/index.ts`

- [ ] **Step 1: Update module index files**

Add export for each new domain object class in its module's `index.ts`. For example in `src/runtime/traces/index.ts`, add:

```typescript
export { St05Trace } from './St05Trace';
export { CrossTrace } from './CrossTrace';
export { Profiler } from './Profiler';
```

Similarly for each module — add the domain object export to its `index.ts`.

- [ ] **Step 2: Update `src/runtime/index.ts`**

Add exports for domain objects and the shared types:

```typescript
export * from './types';
export { MemorySnapshots } from './memory/MemorySnapshots';
```

(Other domain objects already re-exported via their module barrels.)

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/runtime/
git commit -m "feat(runtime): export all domain objects from module barrels"
```

---

### Task 10: Refactor AdtRuntimeClient to factory pattern

Replace all ~80 flat methods with 9 noun-style factory methods (3 new modules added in Track B later).

**Files:**
- Modify: `src/clients/AdtRuntimeClient.ts`

- [ ] **Step 1: Write failing test for factory methods**

```typescript
// Add to existing or create: src/__tests__/unit/clients/AdtRuntimeClient.factory.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';

describe('AdtRuntimeClient factory methods', () => {
  function createClient() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return new AdtRuntimeClient(connection, logger, {
      enableAcceptCorrection: false,
    });
  }

  it('profiler() returns Profiler instance', () => {
    const client = createClient();
    const p = client.profiler();
    expect(p).toBeDefined();
    expect(p.listTraceFiles).toBeDefined();
  });

  it('crossTrace() returns CrossTrace instance', () => {
    const client = createClient();
    const ct = client.crossTrace();
    expect(ct).toBeDefined();
    expect(ct.list).toBeDefined();
  });

  it('st05Trace() returns St05Trace instance', () => {
    const client = createClient();
    const st05 = client.st05Trace();
    expect(st05).toBeDefined();
    expect(st05.getState).toBeDefined();
  });

  it('debugger() returns AbapDebugger instance', () => {
    const client = createClient();
    const dbg = client.debugger();
    expect(dbg).toBeDefined();
    expect(dbg.launch).toBeDefined();
  });

  it('applicationLog() returns ApplicationLog instance', () => {
    const client = createClient();
    const al = client.applicationLog();
    expect(al).toBeDefined();
    expect(al.getObject).toBeDefined();
  });

  it('atcLog() returns AtcLog instance', () => {
    const client = createClient();
    const atc = client.atcLog();
    expect(atc).toBeDefined();
    expect(atc.getCheckFailureLogs).toBeDefined();
  });

  it('ddicActivation() returns DdicActivation instance', () => {
    const client = createClient();
    const ddic = client.ddicActivation();
    expect(ddic).toBeDefined();
    expect(ddic.getGraph).toBeDefined();
  });

  it('dumps() returns RuntimeDumps instance', () => {
    const client = createClient();
    const d = client.dumps();
    expect(d).toBeDefined();
    expect(d.list).toBeDefined();
  });

  it('memorySnapshots() returns MemorySnapshots instance', () => {
    const client = createClient();
    const m = client.memorySnapshots();
    expect(m).toBeDefined();
    expect(m.list).toBeDefined();
  });

  it('factory methods return cached instances', () => {
    const client = createClient();
    expect(client.profiler()).toBe(client.profiler());
    expect(client.dumps()).toBe(client.dumps());
    expect(client.debugger()).toBe(client.debugger());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/clients/AdtRuntimeClient.factory' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Rewrite AdtRuntimeClient**

Replace the entire class body (keep constructor unchanged). Remove all flat methods. Add factory methods with lazy caching:

```typescript
// src/clients/AdtRuntimeClient.ts — new body after constructor
import { Profiler } from '../runtime/traces/Profiler';
import { CrossTrace } from '../runtime/traces/CrossTrace';
import { St05Trace } from '../runtime/traces/St05Trace';
import { AbapDebugger } from '../runtime/debugger/AbapDebugger';
import { ApplicationLog } from '../runtime/applicationLog/ApplicationLog';
import { AtcLog } from '../runtime/atc/AtcLog';
import { DdicActivation } from '../runtime/ddic/DdicActivation';
import { RuntimeDumps } from '../runtime/dumps/RuntimeDumps';
import { MemorySnapshots } from '../runtime/memory/MemorySnapshots';

export class AdtRuntimeClient {
  protected readonly connection: IAbapConnection;
  protected readonly logger: ILogger;

  // Cached domain objects
  private _profiler?: Profiler;
  private _crossTrace?: CrossTrace;
  private _st05Trace?: St05Trace;
  private _debugger?: AbapDebugger;
  private _applicationLog?: ApplicationLog;
  private _atcLog?: AtcLog;
  private _ddicActivation?: DdicActivation;
  private _dumps?: RuntimeDumps;
  private _memorySnapshots?: MemorySnapshots;

  constructor(/* unchanged */) { /* unchanged */ }

  profiler(): Profiler {
    if (!this._profiler) {
      this._profiler = new Profiler(this.connection, this.logger);
    }
    return this._profiler;
  }

  crossTrace(): CrossTrace {
    if (!this._crossTrace) {
      this._crossTrace = new CrossTrace(this.connection, this.logger);
    }
    return this._crossTrace;
  }

  st05Trace(): St05Trace {
    if (!this._st05Trace) {
      this._st05Trace = new St05Trace(this.connection, this.logger);
    }
    return this._st05Trace;
  }

  debugger(): AbapDebugger {
    if (!this._debugger) {
      this._debugger = new AbapDebugger(this.connection, this.logger);
    }
    return this._debugger;
  }

  applicationLog(): ApplicationLog {
    if (!this._applicationLog) {
      this._applicationLog = new ApplicationLog(this.connection, this.logger);
    }
    return this._applicationLog;
  }

  atcLog(): AtcLog {
    if (!this._atcLog) {
      this._atcLog = new AtcLog(this.connection, this.logger);
    }
    return this._atcLog;
  }

  ddicActivation(): DdicActivation {
    if (!this._ddicActivation) {
      this._ddicActivation = new DdicActivation(this.connection, this.logger);
    }
    return this._ddicActivation;
  }

  dumps(): RuntimeDumps {
    if (!this._dumps) {
      this._dumps = new RuntimeDumps(this.connection, this.logger);
    }
    return this._dumps;
  }

  memorySnapshots(): MemorySnapshots {
    if (!this._memorySnapshots) {
      this._memorySnapshots = new MemorySnapshots(this.connection, this.logger);
    }
    return this._memorySnapshots;
  }
}
```

Remove ALL old flat method imports and method bodies. Keep constructor logic intact (accept negotiation setup).

- [ ] **Step 4: Run factory test to verify it passes**

Run: `npx jest --testPathPattern='unit/clients/AdtRuntimeClient.factory' --no-coverage`
Expected: PASS

- [ ] **Step 5: Delete old dumps test file**

Delete `src/__tests__/unit/clients/AdtRuntimeClient.dumps.test.ts` — replaced by `src/__tests__/unit/runtime/RuntimeDumps.test.ts`.

- [ ] **Step 6: Run full type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: Compilation errors from `AdtRuntimeClientExperimental` (extends old surface) and `src/index.ts` (old exports). Fix in next tasks.

- [ ] **Step 7: Commit (WIP — compilation not yet clean)**

```bash
git add src/clients/AdtRuntimeClient.ts src/__tests__/unit/clients/
git commit -m "feat(runtime)!: refactor AdtRuntimeClient to factory pattern

BREAKING CHANGE: all flat methods replaced with noun-style factory methods"
```

---

### Task 11: Refactor AdtRuntimeClientExperimental

**Files:**
- Modify: `src/clients/AdtRuntimeClientExperimental.ts`
- Create: `src/runtime/debugger/AmdpDebugger.ts`

- [ ] **Step 1: Create AmdpDebugger domain object**

```typescript
// src/runtime/debugger/AmdpDebugger.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  startAmdpDebugger,
  resumeAmdpDebugger,
  terminateAmdpDebugger,
  getAmdpDebuggee,
  getAmdpVariable,
  setAmdpVariable,
  lookupAmdp,
  stepOverAmdp,
  stepContinueAmdp,
  getAmdpBreakpoints,
  getAmdpBreakpointsLlang,
  getAmdpBreakpointsTableFunctions,
  type IStartAmdpDebuggerOptions,
} from './amdp';
import {
  getAmdpDataPreview,
  getAmdpCellSubstring,
  type IGetAmdpDataPreviewOptions,
  type IGetAmdpCellSubstringOptions,
} from './amdpDataPreview';

export class AmdpDebugger implements IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async start(options?: IStartAmdpDebuggerOptions): Promise<AxiosResponse> {
    return startAmdpDebugger(this.connection, options);
  }

  async resume(mainId: string): Promise<AxiosResponse> {
    return resumeAmdpDebugger(this.connection, mainId);
  }

  async terminate(mainId: string, hardStop?: boolean): Promise<AxiosResponse> {
    return terminateAmdpDebugger(this.connection, mainId, hardStop);
  }

  async getDebuggee(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return getAmdpDebuggee(this.connection, mainId, debuggeeId);
  }

  async getVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    offset?: number,
    length?: number,
  ): Promise<AxiosResponse> {
    return getAmdpVariable(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      offset,
      length,
    );
  }

  async setVariable(
    mainId: string,
    debuggeeId: string,
    varname: string,
    setNull?: boolean,
  ): Promise<AxiosResponse> {
    return setAmdpVariable(
      this.connection,
      mainId,
      debuggeeId,
      varname,
      setNull,
    );
  }

  async lookup(
    mainId: string,
    debuggeeId: string,
    name?: string,
  ): Promise<AxiosResponse> {
    return lookupAmdp(this.connection, mainId, debuggeeId, name);
  }

  async stepOver(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepOverAmdp(this.connection, mainId, debuggeeId);
  }

  async stepContinue(
    mainId: string,
    debuggeeId: string,
  ): Promise<AxiosResponse> {
    return stepContinueAmdp(this.connection, mainId, debuggeeId);
  }

  async getBreakpoints(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpoints(this.connection, mainId);
  }

  async getBreakpointsLlang(mainId: string): Promise<AxiosResponse> {
    return getAmdpBreakpointsLlang(this.connection, mainId);
  }

  async getBreakpointsTableFunctions(
    mainId: string,
  ): Promise<AxiosResponse> {
    return getAmdpBreakpointsTableFunctions(this.connection, mainId);
  }

  async getDataPreview(
    options?: IGetAmdpDataPreviewOptions,
  ): Promise<AxiosResponse> {
    return getAmdpDataPreview(this.connection, options);
  }

  async getCellSubstring(
    options?: IGetAmdpCellSubstringOptions,
  ): Promise<AxiosResponse> {
    return getAmdpCellSubstring(this.connection, options);
  }
}
```

- [ ] **Step 2: Refactor AdtRuntimeClientExperimental**

```typescript
// src/clients/AdtRuntimeClientExperimental.ts
import { AmdpDebugger } from '../runtime/debugger/AmdpDebugger';
import { AdtRuntimeClient } from './AdtRuntimeClient';

export class AdtRuntimeClientExperimental extends AdtRuntimeClient {
  private _amdpDebugger?: AmdpDebugger;

  amdpDebugger(): AmdpDebugger {
    if (!this._amdpDebugger) {
      this._amdpDebugger = new AmdpDebugger(this.connection, this.logger);
    }
    return this._amdpDebugger;
  }
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: Errors from `src/index.ts` (old exports) — fixed in next task

- [ ] **Step 4: Commit**

```bash
git add src/runtime/debugger/AmdpDebugger.ts src/clients/AdtRuntimeClientExperimental.ts
git commit -m "feat(runtime): add AmdpDebugger domain object and refactor experimental client"
```

---

### Task 12: Update `src/index.ts` exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update exports**

Remove old flat runtime exports. Add domain object and type exports:

```typescript
// Replace the old runtime exports block with:
export { Profiler } from './runtime/traces/Profiler';
export { CrossTrace } from './runtime/traces/CrossTrace';
export { St05Trace } from './runtime/traces/St05Trace';
export { AbapDebugger } from './runtime/debugger/AbapDebugger';
export { AmdpDebugger } from './runtime/debugger/AmdpDebugger';
export { ApplicationLog } from './runtime/applicationLog/ApplicationLog';
export { AtcLog } from './runtime/atc/AtcLog';
export { DdicActivation } from './runtime/ddic/DdicActivation';
export { RuntimeDumps } from './runtime/dumps/RuntimeDumps';
export { MemorySnapshots } from './runtime/memory/MemorySnapshots';
export type {
  IRuntimeAnalysisObject,
  IListableRuntimeObject,
} from './runtime/types';
// Keep re-exporting low-level types that consumers may depend on
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  type IRuntimeDumpReadOptions,
  type IRuntimeDumpReadView,
  type IRuntimeDumpsListOptions,
} from './runtime/dumps';
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint:check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: update public API exports for domain object pattern"
```

---

## Track B: New Feed/Runtime Features

### Task 13: Feed types and IFeedQueryOptions

**Files:**
- Create: `src/runtime/feeds/types.ts`

- [ ] **Step 1: Create feed types**

```typescript
// src/runtime/feeds/types.ts
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

/**
 * Query options for feed-backed runtime objects.
 * Only applies to: FeedRepository, RuntimeDumps, SystemMessages, GatewayErrorLog.
 */
export interface IFeedQueryOptions {
  user?: string;
  maxResults?: number;
  from?: string; // YYYYMMDDHHMMSS
  to?: string; // YYYYMMDDHHMMSS
}

/**
 * Common Atom feed entry structure.
 * Parsed from Atom XML feed responses.
 */
export interface IFeedEntry {
  id: string;
  title: string;
  updated: string;
  link: string;
  content: string;
  author?: string;
  category?: string;
}

/**
 * Feed repository interface — high-level parsed feed access (Level 1).
 */
export interface IFeedRepository {
  list(): Promise<IAdtResponse>;
  variants(): Promise<IAdtResponse>;
  dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  byUrl(feedUrl: string, options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/runtime/feeds/types.ts
git commit -m "feat(feeds): add IFeedQueryOptions, IFeedEntry, IFeedRepository types"
```

---

### Task 14: FeedRepository domain object

**Files:**
- Create: `src/runtime/feeds/FeedRepository.ts`
- Modify: `src/runtime/feeds/read.ts` (add feed-by-URL function)
- Create: `src/__tests__/unit/runtime/FeedRepository.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/FeedRepository.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { FeedRepository } from '../../../runtime/feeds/FeedRepository';

describe('FeedRepository domain object', () => {
  const MOCK_ATOM_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>entry1</id>
    <title>Test Entry</title>
    <updated>2026-04-10T10:00:00Z</updated>
    <link href="/sap/bc/adt/runtime/dumps/DUMP1"/>
    <content>Some content</content>
    <author><name>TESTUSER</name></author>
    <category term="dump"/>
  </entry>
</feed>`;

  function createFeedRepo() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        status: 200,
        data: MOCK_ATOM_FEED,
      }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { feeds: new FeedRepository(connection, logger), connection };
  }

  it('list returns raw response from /sap/bc/adt/feeds', async () => {
    const { feeds, connection } = createFeedRepo();
    await feeds.list();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/feeds' }),
    );
  });

  it('variants returns raw response from /sap/bc/adt/feeds/variants', async () => {
    const { feeds, connection } = createFeedRepo();
    await feeds.variants();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/sap/bc/adt/feeds/variants' }),
    );
  });

  it('byUrl fetches and parses Atom feed', async () => {
    const { feeds } = createFeedRepo();
    const entries = await feeds.byUrl('/sap/bc/adt/runtime/dumps');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry1');
    expect(entries[0].title).toBe('Test Entry');
    expect(entries[0].link).toBe('/sap/bc/adt/runtime/dumps/DUMP1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/FeedRepository' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Add `fetchFeed` low-level function to `read.ts`**

Add to end of `src/runtime/feeds/read.ts`:

```typescript
/**
 * Fetch a specific feed by URL with optional query options.
 */
export async function fetchFeed(
  connection: IAbapConnection,
  feedUrl: string,
  options?: { user?: string; maxResults?: number; from?: string; to?: string },
): Promise<AxiosResponse> {
  const params = new URLSearchParams();

  if (options?.user) {
    params.set('$query', `and( equals( user, ${options.user.trim()} ) )`);
  }
  if (options?.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options?.from) {
    params.set('from', options.from);
  }
  if (options?.to) {
    params.set('to', options.to);
  }

  const query = params.toString();
  const url = `${feedUrl}${query ? `?${query}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}
```

- [ ] **Step 4: Implement FeedRepository**

```typescript
// src/runtime/feeds/FeedRepository.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import type { IRuntimeAnalysisObject } from '../types';
import { getFeeds, getFeedVariants, fetchFeed } from './read';
import type { IFeedEntry, IFeedQueryOptions, IFeedRepository } from './types';

function parseAtomFeed(xmlData: string): IFeedEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xmlData);

  const feed = parsed.feed;
  if (!feed?.entry) {
    return [];
  }

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: Record<string, unknown>) => ({
    id: String(entry.id ?? ''),
    title: String(entry.title ?? ''),
    updated: String(entry.updated ?? ''),
    link:
      typeof entry.link === 'object' && entry.link !== null
        ? String((entry.link as Record<string, unknown>)['@_href'] ?? '')
        : String(entry.link ?? ''),
    content:
      typeof entry.content === 'object' && entry.content !== null
        ? String(
            (entry.content as Record<string, unknown>)['#text'] ??
              JSON.stringify(entry.content),
          )
        : String(entry.content ?? ''),
    author:
      typeof entry.author === 'object' && entry.author !== null
        ? String((entry.author as Record<string, unknown>).name ?? '')
        : undefined,
    category:
      typeof entry.category === 'object' && entry.category !== null
        ? String((entry.category as Record<string, unknown>)['@_term'] ?? '')
        : undefined,
  }));
}

export class FeedRepository implements IFeedRepository, IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(): Promise<AxiosResponse> {
    return getFeeds(this.connection);
  }

  async variants(): Promise<AxiosResponse> {
    return getFeedVariants(this.connection);
  }

  async dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    const response = await fetchFeed(
      this.connection,
      '/sap/bc/adt/runtime/dumps',
      options,
    );
    return parseAtomFeed(String(response.data));
  }

  async systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    const response = await fetchFeed(
      this.connection,
      '/sap/bc/adt/runtime/systemmessages',
      options,
    );
    return parseAtomFeed(String(response.data));
  }

  async gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    const response = await fetchFeed(
      this.connection,
      '/sap/bc/adt/gw/errorlog',
      options,
    );
    return parseAtomFeed(String(response.data));
  }

  async byUrl(
    feedUrl: string,
    options?: IFeedQueryOptions,
  ): Promise<IFeedEntry[]> {
    const response = await fetchFeed(this.connection, feedUrl, options);
    return parseAtomFeed(String(response.data));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/FeedRepository' --no-coverage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/feeds/
git commit -m "feat(feeds): add FeedRepository domain object with Atom XML parsing"
```

---

### Task 15: SystemMessages module

**Files:**
- Create: `src/runtime/systemMessages/types.ts`
- Create: `src/runtime/systemMessages/read.ts`
- Create: `src/runtime/systemMessages/SystemMessages.ts`
- Create: `src/runtime/systemMessages/index.ts`
- Create: `src/__tests__/unit/runtime/SystemMessages.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/SystemMessages.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { SystemMessages } from '../../../runtime/systemMessages/SystemMessages';

describe('SystemMessages domain object', () => {
  function createSystemMessages() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { sm: new SystemMessages(connection, logger), connection };
  }

  it('list delegates to systemmessages endpoint', async () => {
    const { sm, connection } = createSystemMessages();
    await sm.list();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/systemmessages',
      }),
    );
  });

  it('list passes maxResults as $top', async () => {
    const { sm, connection } = createSystemMessages();
    await sm.list({ maxResults: 10 });
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('%24top=10'),
      }),
    );
  });

  it('getById delegates with messageId', async () => {
    const { sm, connection } = createSystemMessages();
    await sm.getById('MSG001');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/systemmessages/MSG001',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/SystemMessages' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Create types**

```typescript
// src/runtime/systemMessages/types.ts
export interface ISystemMessageEntry {
  id: string;
  title: string;
  text: string;
  severity: string;
  validFrom: string;
  validTo: string;
  createdBy: string;
}
```

- [ ] **Step 4: Create read.ts**

```typescript
// src/runtime/systemMessages/read.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { IFeedQueryOptions } from '../feeds/types';

function buildQueryParams(options?: IFeedQueryOptions): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.user) {
    params.set('$query', `and( equals( user, ${options.user.trim()} ) )`);
  }
  if (options.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options.from) {
    params.set('from', options.from);
  }
  if (options.to) {
    params.set('to', options.to);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listSystemMessages(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/systemmessages${buildQueryParams(options)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

export async function getSystemMessage(
  connection: IAbapConnection,
  messageId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/systemmessages/${messageId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
```

- [ ] **Step 5: Create SystemMessages domain object**

```typescript
// src/runtime/systemMessages/SystemMessages.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IFeedQueryOptions } from '../feeds/types';
import type { IListableRuntimeObject } from '../types';
import { listSystemMessages, getSystemMessage } from './read';

export class SystemMessages
  implements IListableRuntimeObject<IFeedQueryOptions>
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<AxiosResponse> {
    return listSystemMessages(this.connection, options);
  }

  async getById(messageId: string): Promise<AxiosResponse> {
    return getSystemMessage(this.connection, messageId);
  }
}
```

- [ ] **Step 6: Create index.ts**

```typescript
// src/runtime/systemMessages/index.ts
export { listSystemMessages, getSystemMessage } from './read';
export { SystemMessages } from './SystemMessages';
export type { ISystemMessageEntry } from './types';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/SystemMessages' --no-coverage`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/runtime/systemMessages/
git commit -m "feat(runtime): add SystemMessages module (SM02)"
```

---

### Task 16: GatewayErrorLog module

**Files:**
- Create: `src/runtime/gatewayErrorLog/types.ts`
- Create: `src/runtime/gatewayErrorLog/read.ts`
- Create: `src/runtime/gatewayErrorLog/GatewayErrorLog.ts`
- Create: `src/runtime/gatewayErrorLog/index.ts`
- Create: `src/__tests__/unit/runtime/GatewayErrorLog.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/unit/runtime/GatewayErrorLog.test.ts
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { GatewayErrorLog } from '../../../runtime/gatewayErrorLog/GatewayErrorLog';

describe('GatewayErrorLog domain object', () => {
  function createGatewayErrorLog() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { gw: new GatewayErrorLog(connection, logger), connection };
  }

  it('list delegates to gateway errorlog endpoint', async () => {
    const { gw, connection } = createGatewayErrorLog();
    await gw.list();
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/gw/errorlog',
      }),
    );
  });

  it('getById delegates with type and id', async () => {
    const { gw, connection } = createGatewayErrorLog();
    await gw.getById('Frontend Error', '66BF65D1A9DD1FD18D97D52042DF3925');
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/gw/errorlog/Frontend%20Error/66BF65D1A9DD1FD18D97D52042DF3925',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='unit/runtime/GatewayErrorLog' --no-coverage`
Expected: FAIL

- [ ] **Step 3: Create types**

```typescript
// src/runtime/gatewayErrorLog/types.ts
export interface IGatewayErrorEntry {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: string;
  username: string;
  client: string;
  requestKind: string;
}

export interface IGatewayErrorDetail extends IGatewayErrorEntry {
  serviceInfo: {
    namespace: string;
    serviceName: string;
    serviceVersion: string;
    groupId: string;
    serviceRepository: string;
    destination: string;
  };
  errorContext: {
    errorInfo: string;
    resolution: Record<string, string>;
    exceptions: IGatewayException[];
  };
  sourceCode: {
    lines: ISourceCodeLine[];
    errorLine: number;
  };
  callStack: ICallStackEntry[];
}

export interface IGatewayException {
  type: string;
  text: string;
  raiseLocation: string;
  attributes?: Record<string, string>;
}

export interface ICallStackEntry {
  number: number;
  event: string;
  program: string;
  name: string;
  line: number;
}

export interface ISourceCodeLine {
  number: number;
  content: string;
  isError: boolean;
}
```

- [ ] **Step 4: Create read.ts**

```typescript
// src/runtime/gatewayErrorLog/read.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { IFeedQueryOptions } from '../feeds/types';

function buildQueryParams(options?: IFeedQueryOptions): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.user) {
    params.set('$query', `and( equals( user, ${options.user.trim()} ) )`);
  }
  if (options.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options.from) {
    params.set('from', options.from);
  }
  if (options.to) {
    params.set('to', options.to);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listGatewayErrors(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/gw/errorlog${buildQueryParams(options)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

export async function getGatewayError(
  connection: IAbapConnection,
  errorType: string,
  errorId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/gw/errorlog/${encodeURIComponent(errorType)}/${errorId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
```

- [ ] **Step 5: Create GatewayErrorLog domain object**

```typescript
// src/runtime/gatewayErrorLog/GatewayErrorLog.ts
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IFeedQueryOptions } from '../feeds/types';
import type { IListableRuntimeObject } from '../types';
import { listGatewayErrors, getGatewayError } from './read';

export class GatewayErrorLog
  implements IListableRuntimeObject<IFeedQueryOptions>
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<AxiosResponse> {
    return listGatewayErrors(this.connection, options);
  }

  async getById(
    errorType: string,
    errorId: string,
  ): Promise<AxiosResponse> {
    return getGatewayError(this.connection, errorType, errorId);
  }
}
```

- [ ] **Step 6: Create index.ts**

```typescript
// src/runtime/gatewayErrorLog/index.ts
export { listGatewayErrors, getGatewayError } from './read';
export { GatewayErrorLog } from './GatewayErrorLog';
export type {
  IGatewayErrorEntry,
  IGatewayErrorDetail,
  IGatewayException,
  ICallStackEntry,
  ISourceCodeLine,
} from './types';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest --testPathPattern='unit/runtime/GatewayErrorLog' --no-coverage`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/runtime/gatewayErrorLog/
git commit -m "feat(runtime): add GatewayErrorLog module (/IWFND/ERROR_LOG)"
```

---

### Task 17: Wire new modules into AdtRuntimeClient and exports

**Files:**
- Modify: `src/clients/AdtRuntimeClient.ts`
- Modify: `src/runtime/index.ts`
- Modify: `src/index.ts`
- Modify: `src/runtime/feeds/index.ts`

- [ ] **Step 1: Add feeds(), systemMessages(), gatewayErrorLog() to AdtRuntimeClient**

Add to `AdtRuntimeClient`:

```typescript
import { FeedRepository } from '../runtime/feeds/FeedRepository';
import { SystemMessages } from '../runtime/systemMessages/SystemMessages';
import { GatewayErrorLog } from '../runtime/gatewayErrorLog/GatewayErrorLog';

// Add fields
private _feeds?: FeedRepository;
private _systemMessages?: SystemMessages;
private _gatewayErrorLog?: GatewayErrorLog;

// Add factory methods
feeds(): FeedRepository {
  if (!this._feeds) {
    this._feeds = new FeedRepository(this.connection, this.logger);
  }
  return this._feeds;
}

systemMessages(): SystemMessages {
  if (!this._systemMessages) {
    this._systemMessages = new SystemMessages(this.connection, this.logger);
  }
  return this._systemMessages;
}

gatewayErrorLog(): GatewayErrorLog {
  if (!this._gatewayErrorLog) {
    this._gatewayErrorLog = new GatewayErrorLog(this.connection, this.logger);
  }
  return this._gatewayErrorLog;
}
```

- [ ] **Step 2: Update `src/runtime/feeds/index.ts`**

```typescript
export { getFeeds, getFeedVariants, fetchFeed } from './read';
export { FeedRepository } from './FeedRepository';
export type { IFeedQueryOptions, IFeedEntry, IFeedRepository } from './types';
```

- [ ] **Step 3: Update `src/runtime/index.ts`**

Add new module exports:

```typescript
export * from './systemMessages';
export * from './gatewayErrorLog';
```

- [ ] **Step 4: Update `src/index.ts`**

Add new exports:

```typescript
export { FeedRepository } from './runtime/feeds/FeedRepository';
export { SystemMessages } from './runtime/systemMessages/SystemMessages';
export { GatewayErrorLog } from './runtime/gatewayErrorLog/GatewayErrorLog';
export type {
  IFeedQueryOptions,
  IFeedEntry,
  IFeedRepository,
} from './runtime/feeds/types';
export type { ISystemMessageEntry } from './runtime/systemMessages/types';
export type {
  IGatewayErrorEntry,
  IGatewayErrorDetail,
  IGatewayException,
  ICallStackEntry,
  ISourceCodeLine,
} from './runtime/gatewayErrorLog/types';
```

- [ ] **Step 5: Run type check and lint**

Run: `npx tsc --noEmit --project tsconfig.json && npm run lint:check`
Expected: No errors

- [ ] **Step 6: Run all unit tests**

Run: `npx jest --testPathPattern='unit/' --no-coverage`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/clients/AdtRuntimeClient.ts src/runtime/ src/index.ts
git commit -m "feat(runtime): wire FeedRepository, SystemMessages, GatewayErrorLog into client"
```

---

### Task 18: Full build and lint verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Run full lint check**

Run: `npm run lint:check`
Expected: No errors

- [ ] **Step 3: Run all unit tests**

Run: `npx jest --testPathPattern='unit/' --no-coverage`
Expected: All pass

- [ ] **Step 4: Fix any issues found, then commit**

```bash
git add -A
git commit -m "chore: fix build and lint issues after runtime refactoring"
```

---

## Migration Reference: Method Name Changes

| Old (AdtRuntimeClient) | New (Domain Object) | Domain |
|---|---|---|
| `listProfilerTraceFiles()` | `profiler().listTraceFiles()` | Profiler |
| `getProfilerTraceParameters()` | `profiler().getParameters()` | Profiler |
| `getProfilerTraceParametersForCallstack()` | `profiler().getParametersForCallstack()` | Profiler |
| `getProfilerTraceParametersForAmdp()` | `profiler().getParametersForAmdp()` | Profiler |
| `buildProfilerTraceParametersXml()` | `profiler().buildParametersXml()` | Profiler |
| `createProfilerTraceParameters()` | `profiler().createParameters()` | Profiler |
| `extractProfilerIdFromResponse()` | `profiler().extractIdFromResponse()` | Profiler |
| `getDefaultProfilerTraceParameters()` | `profiler().getDefaultParameters()` | Profiler |
| `getProfilerTraceHitList()` | `profiler().getHitList()` | Profiler |
| `getProfilerTraceStatements()` | `profiler().getStatements()` | Profiler |
| `getProfilerTraceDbAccesses()` | `profiler().getDbAccesses()` | Profiler |
| `listProfilerTraceRequests()` | `profiler().listRequests()` | Profiler |
| `getProfilerTraceRequestsByUri()` | `profiler().getRequestsByUri()` | Profiler |
| `listProfilerObjectTypes()` | `profiler().listObjectTypes()` | Profiler |
| `listProfilerProcessTypes()` | `profiler().listProcessTypes()` | Profiler |
| `listCrossTraces()` | `crossTrace().list()` | CrossTrace |
| `getCrossTrace()` | `crossTrace().getById()` | CrossTrace |
| `getCrossTraceRecords()` | `crossTrace().getRecords()` | CrossTrace |
| `getCrossTraceRecordContent()` | `crossTrace().getRecordContent()` | CrossTrace |
| `getCrossTraceActivations()` | `crossTrace().getActivations()` | CrossTrace |
| `getSt05TraceState()` | `st05Trace().getState()` | St05Trace |
| `getSt05TraceDirectory()` | `st05Trace().getDirectory()` | St05Trace |
| `launchDebugger()` | `debugger().launch()` | AbapDebugger |
| `stopDebugger()` | `debugger().stop()` | AbapDebugger |
| `getDebugger()` | `debugger().get()` | AbapDebugger |
| `getDebuggerMemorySizes()` | `debugger().getMemorySizes()` | AbapDebugger |
| `getDebuggerSystemArea()` | `debugger().getSystemArea()` | AbapDebugger |
| `synchronizeBreakpoints()` | `debugger().synchronizeBreakpoints()` | AbapDebugger |
| `getBreakpointStatements()` | `debugger().getBreakpointStatements()` | AbapDebugger |
| `getBreakpointMessageTypes()` | `debugger().getBreakpointMessageTypes()` | AbapDebugger |
| `getBreakpointConditions()` | `debugger().getBreakpointConditions()` | AbapDebugger |
| `validateBreakpoints()` | `debugger().validateBreakpoints()` | AbapDebugger |
| `getVitBreakpoints()` | `debugger().getVitBreakpoints()` | AbapDebugger |
| `getVariableMaxLength()` | `debugger().getVariableMaxLength()` | AbapDebugger |
| `getVariableSubcomponents()` | `debugger().getVariableSubcomponents()` | AbapDebugger |
| `getVariableAsCsv()` | `debugger().getVariableAsCsv()` | AbapDebugger |
| `getVariableAsJson()` | `debugger().getVariableAsJson()` | AbapDebugger |
| `getVariableValueStatement()` | `debugger().getVariableValueStatement()` | AbapDebugger |
| `executeDebuggerAction()` | `debugger().executeAction()` | AbapDebugger |
| `getCallStack()` | `debugger().getCallStack()` | AbapDebugger |
| `insertWatchpoint()` | `debugger().insertWatchpoint()` | AbapDebugger |
| `getWatchpoints()` | `debugger().getWatchpoints()` | AbapDebugger |
| `executeBatchRequest()` | `debugger().executeBatchRequest()` | AbapDebugger |
| `buildDebuggerBatchPayload()` | `debugger().buildBatchPayload()` | AbapDebugger |
| `buildDebuggerStepWithStackBatchPayload()` | `debugger().buildStepWithStackBatchPayload()` | AbapDebugger |
| `executeDebuggerStepBatch()` | `debugger().executeStepBatch()` | AbapDebugger |
| `stepIntoDebuggerBatch()` | `debugger().stepIntoBatch()` | AbapDebugger |
| `stepOutDebuggerBatch()` | `debugger().stepOutBatch()` | AbapDebugger |
| `stepContinueDebuggerBatch()` | `debugger().stepContinueBatch()` | AbapDebugger |
| `getApplicationLogObject()` | `applicationLog().getObject()` | ApplicationLog |
| `getApplicationLogSource()` | `applicationLog().getSource()` | ApplicationLog |
| `validateApplicationLogName()` | `applicationLog().validateName()` | ApplicationLog |
| `getAtcCheckFailureLogs()` | `atcLog().getCheckFailureLogs()` | AtcLog |
| `getAtcExecutionLog()` | `atcLog().getExecutionLog()` | AtcLog |
| `getDdicActivationGraph()` | `ddicActivation().getGraph()` | DdicActivation |
| `buildDumpIdPrefix()` | `dumps().buildIdPrefix()` | RuntimeDumps |
| `buildRuntimeDumpsUserQuery()` | `dumps().buildUserQuery()` | RuntimeDumps |
| `listRuntimeDumps()` | `dumps().list()` | RuntimeDumps |
| `listRuntimeDumpsByUser()` | `dumps().listByUser()` | RuntimeDumps |
| `getRuntimeDumpById()` | `dumps().getById()` | RuntimeDumps |
| `getFeeds()` | `feeds().list()` | FeedRepository |
| `getFeedVariants()` | `feeds().variants()` | FeedRepository |
| N/A (new) | `systemMessages().list()` | SystemMessages |
| N/A (new) | `systemMessages().getById()` | SystemMessages |
| N/A (new) | `gatewayErrorLog().list()` | GatewayErrorLog |
| N/A (new) | `gatewayErrorLog().getById()` | GatewayErrorLog |
| N/A (new) | `feeds().dumps()` | FeedRepository |
| N/A (new) | `feeds().systemMessages()` | FeedRepository |
| N/A (new) | `feeds().gatewayErrors()` | FeedRepository |
| N/A (new) | `feeds().byUrl()` | FeedRepository |
