# Documentation

Complete documentation for the `@mcp-abap-adt/adt-clients` package.

## Quick Start

- [Main README](../README.md) - Package overview, installation, and quick start guide
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Architecture

- [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) - System architecture, design patterns, and type system organization
- [**LEGACY.md**](architecture/LEGACY.md) - Legacy system support (BASIS < 7.50): supported types, RFC transport, endpoint availability
- [**DECISIONS.md**](architecture/DECISIONS.md) - The choices that could have gone the other way, with the problem, the evidence and what would change them

## Usage Guides

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
- [**WORKAROUNDS.md**](usage/WORKAROUNDS.md) — SAP-side behaviour a consumer has to work around (PAK/058, refusals inside a `200`, empty `200` reads, activation flags, transport search, …): symptom, cause, rule, workaround and evidence for each
- [TROUBLESHOOTING.md](usage/TROUBLESHOOTING.md) — what ADT answers when it refuses, and why the message is often accurate about the wrong thing
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
│   ├── LEGACY.md                     # Legacy system support (BASIS < 7.50)
│   ├── discovery.md                  # ADT Discovery documentation
│   └── discovery.xml                 # Pretty-printed ADT discovery XML
├── usage/
│   ├── MIGRATION-23.md               # 22.x → 23.0.0: readings and verdicts became strategies
│   ├── MIGRATION-19.md               # 18.x → 19.0.0
│   ├── MIGRATION-18.0.md             # 17.x → 18.0.0
│   ├── ANSWER_SHAPES.md              # What ADT actually answers (recorded)
│   ├── OBJECT_LIFECYCLE.md           # The create → … → activate flow and its exceptions
│   ├── CLIENT_API_REFERENCE.md       # Client API reference
│   ├── STATEFUL_SESSION_GUIDE.md     # Session management
│   ├── WORKAROUNDS.md                # SAP-side behaviour and its workarounds
│   ├── TROUBLESHOOTING.md            # Refusals that name the wrong cause
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
[`@mcp-abap-adt/adt-strategies`](../packages/adt-strategies).

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
});
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

`lock` sets the session stateful and `unlock` restores stateless; the handle is what `lock` answers, and the sequence between them is yours.

See [STATEFUL_SESSION_GUIDE.md](usage/STATEFUL_SESSION_GUIDE.md) for implementation details.

## Contributing

- [CONTRIBUTORS.md](../CONTRIBUTORS.md) - Contribution guidelines and contributor list
- [LICENSE](../LICENSE) - GNU LGPL v3.0 only (`COPYING` holds the GPL it builds on)

## Support

For issues and questions:
- GitHub Issues: [mcp-abap-adt-clients repository](https://github.com/fr0ster/mcp-abap-adt-clients)
- See [DEBUG.md](usage/DEBUG.md) for troubleshooting common issues
