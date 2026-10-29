# Documentation

> **Since adt-clients 36.0.0** every call below to one of the 32 members that
> take `options.headers` (`create`, `update`, `updateMetadata`, `delete`,
> `checkDeletion`, `check`, `activate` and the others listed in
> [A request's own headers](../README.md#a-requests-own-headers)) passes the request's own `Accept` / `Content-Type` pair.
> In these samples `headers` stands for that pair, an `IAdtHeaders`
> (`{ accept, contentType }`); the member sends exactly it.

Complete documentation for the `@mcp-abap-adt/adt-clients` package.

## Quick Start

- [Main README](../README.md) - Package overview, installation, and quick start guide
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Architecture

- [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) - System architecture, design patterns, and type system organization
- [**LEGACY.md**](../../adt-clients-legacy/docs/LEGACY.md) - Legacy system support (SAP_BASIS 7.40, measured on 7.40 SP04), in the separate package `@mcp-abap-adt/adt-clients-legacy` ([README](../../adt-clients-legacy/README.md)): what each member does on 7.40, RFC transport, endpoint availability
- [**DECISIONS.md**](architecture/DECISIONS.md) - The choices that could have gone the other way, with the problem, the evidence and what would change them

## Usage Guides

- [**MIGRATION-38.md**](usage/MIGRATION-38.md) — what a consumer on 37.x has to change: the result-set contracts come from `@mcp-abap-adt/interfaces-adt`, and each factory answers its class, so a consumer composes the contract it accepts from interfaces-adt
- [**MIGRATION-37.md**](usage/MIGRATION-37.md) — what a consumer on 36.x has to change: `getSystemInformation` answers an `IAdtResponse`, and `IUtilResults` has the required `objectProperties` slot; and, in 37.4.0, the legacy classes live in `@mcp-abap-adt/adt-clients-legacy`
- [**MIGRATION-36.md**](usage/MIGRATION-36.md) — what a consumer on 35.x has to change: a request's `Accept` and `Content-Type` are the caller's
- [**MIGRATION-23.md**](usage/MIGRATION-23.md) — what a consumer on 22.x has to change: every reading and verdict the library applied is a strategy in `@mcp-abap-adt/adt-strategies`, with the replacing code for each
- [**MIGRATION-19.md**](usage/MIGRATION-19.md) — what a consumer on 18.x has to change: one member, one endpoint call
- [**MIGRATION-18.0.md**](usage/MIGRATION-18.0.md) — what a consumer on 17.x has to change, and why the compiler is right
- [**ANSWER_SHAPES.md**](usage/ANSWER_SHAPES.md) — what ADT actually answers: recorded exchanges, so a failure strategy is chosen from measurements
- [**OBJECT_LIFECYCLE.md**](usage/OBJECT_LIFECYCLE.md) — create → lock → update → unlock → activate: the calls you make, what each one does, where the flow does not hold
- [**CLIENT_API_REFERENCE.md**](usage/CLIENT_API_REFERENCE.md) - Complete API reference for `AdtClient`
- [**RFC_CONNECTION.md**](usage/RFC_CONNECTION.md) - RFC connection guide for legacy systems
- [**STATEFUL_SESSION_GUIDE.md**](usage/STATEFUL_SESSION_GUIDE.md) - Guide for stateful session management
- [**CHECK_LOCAL_TEST_CLASS.md**](usage/CHECK_LOCAL_TEST_CLASS.md) - Guide for validating ABAP Unit test classes
- [**DEBUG.md**](usage/DEBUG.md) - Debugging and troubleshooting guide
- [**ERRATA.md**](usage/ERRATA.md) — what SAP ADT answers that a caller would misread
- [**OPERATION_DELAYS.md**](usage/OPERATION_DELAYS.md) - Detailed guide on operation delays and timing
- [**OPERATION_DELAYS_SUMMARY.md**](usage/OPERATION_DELAYS_SUMMARY.md) - Quick reference for operation delays

## Development
- [**RUNNING_TESTS.md**](development/RUNNING_TESTS.md) — how to run the suite, why an agent CLI must run it detached, and what order things go in
- [**TEST_CONFIG_SCHEMA.md**](development/TEST_CONFIG_SCHEMA.md) - Test configuration schema and guidelines
- [**UPDATE_CONTENT_TYPES.md**](development/UPDATE_CONTENT_TYPES.md) - Content types for update operations (text/plain vs XML)
- [**RFC_TESTING.md**](development/RFC_TESTING.md) - RFC testing setup and environment variables

## Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── architecture/
│   ├── ARCHITECTURE.md               # System architecture and design
│   ├── DECISIONS.md                  # Decisions, and why
│   ├── discovery.md                  # ADT Discovery documentation
│   └── discovery.xml                 # Pretty-printed ADT discovery XML
├── usage/
│   ├── MIGRATION-37.md               # 36.x → 37.0.0: getSystemInformation's answer, the objectProperties slot
│   ├── MIGRATION-36.md               # 35.x → 36.0.0: a request's own headers
│   ├── MIGRATION-23.md               # 22.x → 23.0.0: readings and verdicts became strategies
│   ├── MIGRATION-19.md               # 18.x → 19.0.0
│   ├── MIGRATION-18.0.md             # 17.x → 18.0.0
│   ├── ANSWER_SHAPES.md              # What ADT actually answers (recorded)
│   ├── OBJECT_LIFECYCLE.md           # The create → … → activate flow and its exceptions
│   ├── CLIENT_API_REFERENCE.md       # Client API reference
│   ├── STATEFUL_SESSION_GUIDE.md     # Session management
│   ├── ERRATA.md                # SAP ADT errata
│   ├── CHECK_LOCAL_TEST_CLASS.md     # Local test class validation
│   ├── DEBUG.md                      # Debugging guide
│   ├── OPERATION_DELAYS.md           # Operation delays (detailed)
│   └── OPERATION_DELAYS_SUMMARY.md   # Operation delays (summary)
└── development/
    ├── TEST_CONFIG_SCHEMA.md         # Test configuration
    ├── UPDATE_CONTENT_TYPES.md       # Update content types reference
    └── BUILDER_TEST_PATTERN.md       # Integration test pattern (AdtClient/BaseTester)
```

## Key Concepts

### Client Classes

The package provides the main client classes:

- **AdtClient** - High-level CRUD API; one member, one ADT request (recommended)
- **AdtRuntimeClient** - Runtime operations (traces, dumps, logs, feeds, ATC check runs)
- **AdtExecutor** - Class and program execution, under the profiler if asked
- **AdtAbapGitClient** - ADT-integrated abapGit, constructed directly

Every one of them answers what SAP sent. What the answer *becomes* is the result
set you build an implementation with; whether it *failed* is the `analyse` you
pass with the call. The readings and verdicts are in
[`@mcp-abap-adt/adt-strategies`](../../adt-strategies).

See [CLIENT_API_REFERENCE.md](usage/CLIENT_API_REFERENCE.md) for complete method documentation.

### Usage Examples

**Using AdtClient (recommended):**
```typescript
import { AdtClient, utilDocuments } from '@mcp-abap-adt/adt-clients';
import { utilSearchHits } from '@mcp-abap-adt/adt-strategies';

const client = new AdtClient(connection, logger);

// Every member answers a contract: a result or a failure, never both.
const created = await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test',
}, { headers });
if (!created.ok) throw new Error(created.getError().message);

// Utility operations. The search hits are a reading you choose, once.
const utils = client.getUtils({ ...utilDocuments, search: utilSearchHits });
const found = await utils.search({ query: 'Z*', objectType: 'CLAS' });
if (found.ok) found.getResult().value;   // ISearchResult[]; the document without utilSearchHits
```

### Type System

The package uses a dual naming convention:
- **snake_case** - Low-level ADT parameters
- **camelCase** - Adt* configuration and high-level APIs

See [ARCHITECTURE.md](architecture/ARCHITECTURE.md#type-system-organization) for details.

### Session Management

Only the `LOCK` and the `UNLOCK` request are stateful — `lock` and `unlock` each switch for their own request and back; everything between them goes stateless. The handle is what `lock` answers, and the sequence between them is yours.

See [STATEFUL_SESSION_GUIDE.md](usage/STATEFUL_SESSION_GUIDE.md) for implementation details.

## Contributing

- [CONTRIBUTORS.md](../CONTRIBUTORS.md) - Contribution guidelines and contributor list
- [LICENSE](../LICENSE) - GNU LGPL v3.0 only (`COPYING` holds the GPL it builds on)

## Support

For issues and questions:
- GitHub Issues: [mcp-abap-adt-clients repository](https://github.com/fr0ster/mcp-abap-adt-clients)
- See [DEBUG.md](usage/DEBUG.md) for troubleshooting common issues
