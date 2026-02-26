# ADT Batch Request Support

## Analysis Date
2026-02-26

## Motivation

SAP ADT supports multipart/mixed batch requests, allowing multiple independent HTTP operations to be sent in a single round-trip. This significantly reduces network latency when multiple operations need to execute within the same stateful session.

**Current state:** Batch support exists only in the debugger module (`src/runtime/debugger/abap.ts`) as a hardcoded pattern (step + getStack). There is no reusable batch infrastructure across the library.

**Goal:** Provide a general-purpose batch execution layer that:
1. Allows any ADT operation to be collected without immediate execution
2. Sends all collected operations in a single `multipart/mixed` batch request
3. Maps batch responses back to individual callers

---

## Experiment: Batch Endpoint Scope (2026-02-26)

### Question

Is `/sap/bc/adt/debugger/batch` limited to debugger-specific inner requests, or does it act as a general ADT router?

### Test

Sent non-debugger requests through `/sap/bc/adt/debugger/batch`:

**Test 1:** `GET /sap/bc/adt/discovery` (service document)
**Test 2:** Two inner requests — `GET /sap/bc/adt/oo/classes/cl_abap_typedescr` + `GET /sap/bc/adt/programs/programs/sapmhttp`

### Results

| Test | Outer Status | Inner Status | Content Returned |
|------|-------------|-------------|-----------------|
| Discovery | 202 Accepted | 200 OK | Full `application/atomsvc+xml` discovery document |
| Class metadata | 202 Accepted | 200 OK | `application/vnd.sap.adt.oo.classes.v4+xml` with ETag, Last-Modified, full class XML |
| Program metadata | 202 Accepted | 200 OK | `application/vnd.sap.adt.programs.programs.v2+xml` with full program metadata |

### Conclusion

**`/sap/bc/adt/debugger/batch` is a general-purpose ADT batch router.** It dispatches inner requests to the appropriate ICF handlers regardless of the URL path. No separate batch endpoint is needed.

Tested on: SAP BTP ABAP Environment (S/4HANA Cloud)

### Critical Format Requirement

Inner HTTP requests **MUST** end with an empty line (`\r\n\r\n`) after headers, even for bodyless GET requests. Without this, SAP returns:

```
HTTP 400: An empty line is necessary after header section
ExceptionBatchParsingErroneousData
```

**Note:** The existing `buildDebuggerBatchPayload()` in `src/runtime/debugger/abap.ts` has a latent bug — `.trim()` on inner request strings strips the trailing `\r\n`, removing the required empty line. This must be fixed when building the generic batch infrastructure.

### Test file

`src/__tests__/integration/runtime/debugger/BatchEndpointScope.test.ts`

---

## SAP ADT Batch Protocol

### Endpoint

`POST /sap/bc/adt/debugger/batch` — accepts any ADT inner requests (confirmed experimentally)

### Request Format

```http
POST /sap/bc/adt/debugger/batch HTTP/1.1
Content-Type: multipart/mixed; boundary=batch_<uuid>
Accept: multipart/mixed

--batch_<uuid>
Content-Type: application/http
content-transfer-encoding: binary

GET /sap/bc/adt/oo/classes/cl_abap_typedescr HTTP/1.1
Accept:application/vnd.sap.adt.oo.classes.v4+xml

--batch_<uuid>
Content-Type: application/http
content-transfer-encoding: binary

GET /sap/bc/adt/programs/programs/sapmhttp HTTP/1.1
Accept:application/vnd.sap.adt.programs.programs.v2+xml

--batch_<uuid>--
```

### Response Format

```http
HTTP/1.1 202 Accepted
Content-Type: multipart/mixed; boundary=batch_<response-boundary>

--batch_<response-boundary>
content-type: application/http
content-transfer-encoding: binary

HTTP/1.1 200  OK
Content-Type: application/vnd.sap.adt.oo.classes.v4+xml; charset=utf-8

<?xml version="1.0" encoding="utf-8"?>
<class:abapClass .../>

--batch_<response-boundary>
content-type: application/http
content-transfer-encoding: binary

HTTP/1.1 200  OK
Content-Type: application/vnd.sap.adt.programs.programs.v2+xml; charset=utf-8

<?xml version="1.0" encoding="utf-8"?>
<program:abapProgram .../>

--batch_<response-boundary>--
```

### Key Protocol Details

- Each inner request is a full HTTP request with method, path, headers, and optional body
- Inner requests are wrapped in `Content-Type: application/http` with `binary` transfer encoding
- Parts are delimited by `--<boundary>` with `--<boundary>--` as the final delimiter
- **Inner requests MUST end with `\r\n\r\n`** (empty line after headers, even with no body)
- Each inner request can have its own `sap-adt-request-id` header for correlation
- Session headers (`sap-contextid`, `x-csrf-token`, etc.) are set on the outer request, not inner requests

---

## Proposed Architecture

### Overview

Two-layer design:

1. **Request Descriptor Layer** — captures HTTP request parameters as data objects instead of executing them
2. **Batch Client Layer** — collects request descriptors and executes them as a single batch

### Layer 1: Request Descriptors (IBatchRequestPart)

A lightweight data structure describing a single HTTP request:

```typescript
/**
 * Describes a single HTTP request that can be included in a batch
 */
export interface IBatchRequestPart {
  /** HTTP method (GET, POST, PUT, DELETE) */
  method: string;
  /** Request URL path (e.g., /sap/bc/adt/oo/classes/zcl_test/source/main) */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Optional request body */
  data?: string;
  /** Optional query parameters (appended to URL) */
  params?: Record<string, string>;
}
```

### Layer 2: Recording Connection (BatchRecordingConnection)

Instead of creating separate "batch" implementations for every object type (20+ classes), use a **recording proxy** for `IAbapConnection`:

```typescript
/**
 * IAbapConnection proxy that records requests instead of executing them.
 * Existing IAdtObject implementations work unchanged — they call
 * connection.makeAdtRequest() which this proxy intercepts and records.
 */
export class BatchRecordingConnection implements IAbapConnection {
  private parts: IBatchRequestPart[] = [];
  private deferreds: Array<{
    resolve: (value: IAdtResponse) => void;
    reject: (error: Error) => void;
  }> = [];

  async getBaseUrl(): Promise<string> {
    return this.realConnection.getBaseUrl();
  }

  getSessionId(): string | null {
    return this.realConnection.getSessionId();
  }

  setSessionType(type: 'stateful' | 'stateless'): void {
    // No-op in recording mode; session type is managed by the outer batch request
  }

  async makeAdtRequest<T>(options: IAbapRequestOptions): Promise<IAdtResponse<T>> {
    // Record the request instead of executing
    this.parts.push({
      method: options.method,
      url: options.url,
      headers: options.headers ?? {},
      data: typeof options.data === 'string' ? options.data : undefined,
    });

    // Return a deferred promise that will be resolved after batchExecute()
    return new Promise((resolve, reject) => {
      this.deferreds.push({ resolve, reject });
    });
  }

  /** Get all recorded request parts */
  getRecordedParts(): IBatchRequestPart[] {
    return [...this.parts];
  }

  /** Resolve all deferred promises with parsed batch responses */
  resolveAll(responses: IAdtResponse[]): void { ... }

  /** Reset recorded state */
  reset(): void { ... }
}
```

**Key advantage:** All existing `AdtClass`, `AdtProgram`, `AdtDomain`, etc. work as-is because they depend only on `IAbapConnection`. No need to create 20+ duplicate classes.

### Layer 3: AdtClientBatch

```typescript
export class AdtClientBatch {
  private connection: IAbapConnection;
  private recorder: BatchRecordingConnection;
  private innerClient: AdtClient;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.recorder = new BatchRecordingConnection(connection);
    // AdtClient uses the recording connection — all calls are intercepted
    this.innerClient = new AdtClient(this.recorder, logger);
  }

  /**
   * Access object handlers in batch mode.
   * Method calls on returned objects do NOT execute HTTP requests.
   * Instead, requests are collected for later batch execution.
   */
  getClass(): IAdtObject<IClassConfig, IClassState> {
    return this.innerClient.getClass();
  }

  getProgram(): IAdtObject<IProgramConfig, IProgramState> {
    return this.innerClient.getProgram();
  }

  // ... same factory methods as AdtClient ...

  /**
   * Execute all collected requests as a single multipart/mixed batch.
   * Resolves all deferred promises returned by previous method calls.
   *
   * @returns Array of individual ADT responses in the same order as calls
   */
  async batchExecute(): Promise<IAdtResponse[]> {
    const parts = this.recorder.getRecordedParts();
    if (parts.length === 0) return [];

    // Build multipart body
    const payload = buildBatchPayload(parts);

    // Execute single batch request on the real connection
    const batchResponse = await this.connection.makeAdtRequest({
      url: '/sap/bc/adt/debugger/batch',
      method: 'POST',
      timeout: getTimeout('batch'),
      data: payload.body,
      headers: {
        'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
        'Accept': 'multipart/mixed',
      },
    });

    // Parse multipart response into individual responses
    const responses = parseMultipartResponse(batchResponse);

    // Resolve deferred promises
    this.recorder.resolveAll(responses);
    this.recorder.reset();

    return responses;
  }
}
```

### Usage Examples

```typescript
// === Example 1: Read multiple objects in one round-trip ===
const batch = new AdtClientBatch(connection, logger);

// These calls return deferred promises (do NOT execute HTTP requests yet)
const classPromise  = batch.getClass().read({ className: 'ZCL_TEST' });
const progPromise   = batch.getProgram().read({ programName: 'ZTEST_PROG' });
const ifacePromise  = batch.getInterface().read({ interfaceName: 'ZIF_TEST' });

// Execute all 3 reads as a single HTTP request
await batch.batchExecute();

// Now the deferred promises are resolved
const classState = await classPromise;
const progState  = await progPromise;
const ifaceState = await ifacePromise;


// === Example 2: Debugger step + multiple variable reads ===
const batch = new AdtClientBatch(connection, logger);
const runtime = new AdtRuntimeClientBatch(batch.getRecorder());

runtime.stepIntoDebugger();
runtime.getCallStack();
runtime.getVariableAsJson('LV_RESULT', 'LOCAL');
runtime.getVariableAsJson('LT_DATA', 'LOCAL');

const responses = await batch.batchExecute();
```

---

## Implementation Plan

### Phase 1: Core Batch Infrastructure

**Files to create:**

| File | Purpose |
|------|---------|
| `src/batch/types.ts` | `IBatchRequestPart`, `IBatchPayload`, `IBatchResponse` |
| `src/batch/buildBatchPayload.ts` | Build `multipart/mixed` body from `IBatchRequestPart[]` |
| `src/batch/parseMultipartResponse.ts` | Parse `multipart/mixed` response into individual `IAdtResponse` objects |
| `src/batch/BatchRecordingConnection.ts` | Recording `IAbapConnection` proxy |
| `src/batch/index.ts` | Exports |

**Refactoring:**

- Extract `createBatchBoundary()` and `createRequestId()` from `src/runtime/debugger/abap.ts` into `src/batch/buildBatchPayload.ts`
- Refactor existing `buildDebuggerBatchPayload()` to use the new generic `buildBatchPayload()`
- **Fix the `.trim()` bug** that strips the required empty line after inner request headers

### Phase 2: AdtClientBatch

**Files to create:**

| File | Purpose |
|------|---------|
| `src/clients/AdtClientBatch.ts` | Batch-capable AdtClient with `batchExecute()` |

**Design decisions:**

- `AdtClientBatch` wraps `AdtClient` with a `BatchRecordingConnection`
- Same factory method signatures (`getClass()`, `getProgram()`, etc.)
- Adds `batchExecute(): Promise<IAdtResponse[]>` to flush collected requests
- Adds `reset(): void` to clear pending requests without executing

### Phase 3: AdtRuntimeClientBatch (Optional)

Extend batch support to `AdtRuntimeClient` operations (debugger, traces):

| File | Purpose |
|------|---------|
| `src/clients/AdtRuntimeClientBatch.ts` | Batch-capable runtime client |

This would replace the hardcoded `buildDebuggerStepWithStackBatchPayload()` with the generic batch pattern.

### Phase 4: Response Type Safety (Optional)

Add generic response mapping so each deferred promise resolves with the correct type:

```typescript
// Each call returns a typed promise
const classResult: Promise<IClassState> = batch.getClass().read({ className: 'ZCL_TEST' });
```

This already works naturally because `BatchRecordingConnection.makeAdtRequest()` returns the same `Promise<IAdtResponse<T>>` type — the deferred promise just resolves later.

---

## Design Considerations

### Why Recording Connection Over Separate Implementations

| Approach | Pros | Cons |
|----------|------|------|
| **Recording Connection (chosen)** | Zero duplication; all 20+ object types work immediately; low maintenance | Less explicit; methods with side effects (session management, error handling) may behave differently |
| **Separate batch IAdtObject classes** | Explicit control; can optimize per object type | 20+ duplicate classes; high maintenance; drift risk with main implementations |
| **Dual-mode flag in existing classes** | Single codebase | Violates SRP; complex branching in every method |

### Limitations and Constraints

1. **Sequential operations cannot be batched**: Operations like `lock → update → unlock` depend on the result of the previous step (lock handle). These must remain sequential or be handled as a "changeset" (sub-batch with ordering guarantees).

2. **Error handling**: If one inner request fails, the batch response still includes all results. Each inner response has its own HTTP status. Need per-request error handling.

3. **Session management**: `setSessionType()` calls in recording mode are no-ops. The outer batch request must set the correct session type. This works for read-only batches but may need special handling for stateful operations.

4. **Request body serialization**: Some operations send XML or plain text bodies. The `IBatchRequestPart.data` field must preserve these payloads exactly.

5. **Response size limits**: Large batches may exceed server response size limits. Consider configurable maximum batch size.

### Compatibility with Existing Code

- `AdtClient` is **not modified** — existing consumers are unaffected
- `AdtClientBatch` is a new, separate entry point
- Existing debugger batch functions remain functional but can optionally delegate to the new infrastructure
- `IAbapConnection` interface is unchanged — no breaking changes in `@mcp-abap-adt/interfaces`

---

## Resolved Questions

1. ~~**General batch endpoint**: Does SAP expose a generic batch endpoint beyond `/sap/bc/adt/debugger/batch`?~~
   **RESOLVED:** No separate endpoint needed. `/sap/bc/adt/debugger/batch` accepts ANY ADT inner requests (confirmed experimentally on SAP BTP ABAP Environment). It acts as a general ICF dispatcher.

4. ~~**Error semantics**: Does the batch endpoint return 202 even if individual requests fail?~~
   **PARTIALLY RESOLVED:** The outer response returns 202 Accepted. Each inner response has its own HTTP status line (confirmed: `HTTP/1.1 200  OK`). Need to test error cases.

5. ~~**Header propagation**: Which outer request headers are inherited by inner requests?~~
   **PARTIALLY RESOLVED:** Session headers (`x-csrf-token`, `sap-client`, `sap-language`) are set on the outer request and inherited. Inner requests only need operation-specific headers (e.g., `Accept`).

## Open Questions

1. **Changeset support**: OData batch supports changesets (`multipart/mixed` within `multipart/mixed`) for transactional grouping. Does ADT batch support changesets for sequential operations?

2. **Maximum batch size**: What is the practical limit on the number of inner requests per batch?

3. **POST with body**: Do write operations (POST/PUT with XML body) work correctly in batch? Need to test create/update operations.

4. **Stateful session in batch**: Do lock/unlock operations maintain session state within a batch context?

---

## Migration Path for Existing Debugger Batch

After Phase 1, the existing debugger batch code in `src/runtime/debugger/abap.ts` (lines 758–862) can be refactored to use the shared infrastructure:

```typescript
// Before (current)
export function buildDebuggerBatchPayload(requests: string[]): IDebuggerBatchPayload { ... }

// After (using shared batch module)
import { buildBatchPayload } from '../batch';

export function buildDebuggerBatchPayload(requests: IBatchRequestPart[]): IBatchPayload {
  return buildBatchPayload(requests);
}
```

This reduces duplication and ensures consistent multipart formatting across the library.
