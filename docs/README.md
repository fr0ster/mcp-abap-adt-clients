# Documentation

Complete documentation for the `@mcp-abap-adt/adt-clients` package.

## Quick Start

- [Main README](../README.md) - Package overview, installation, and quick start guide
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Architecture

- [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) - System architecture, design patterns, and type system organization
- [**LEGACY.md**](architecture/LEGACY.md) - Legacy system support (BASIS < 7.50): supported types, RFC transport, endpoint availability

## Usage Guides

- [**CLIENT_API_REFERENCE.md**](usage/CLIENT_API_REFERENCE.md) - Complete API reference for `AdtClient`
- [**RFC_CONNECTION.md**](usage/RFC_CONNECTION.md) - RFC connection guide for legacy systems
- [**STATEFUL_SESSION_GUIDE.md**](usage/STATEFUL_SESSION_GUIDE.md) - Guide for stateful session management
- [**CHECK_LOCAL_TEST_CLASS.md**](usage/CHECK_LOCAL_TEST_CLASS.md) - Guide for validating ABAP Unit test classes
- [**DEBUG.md**](usage/DEBUG.md) - Debugging and troubleshooting guide
- [TROUBLESHOOTING.md](usage/TROUBLESHOOTING.md) — what ADT answers when it refuses, and why the message is often accurate about the wrong thing
- [**OPERATION_DELAYS.md**](usage/OPERATION_DELAYS.md) - Detailed guide on operation delays and timing
- [**OPERATION_DELAYS_SUMMARY.md**](usage/OPERATION_DELAYS_SUMMARY.md) - Quick reference for operation delays

## Development
- [**TEST_CONFIG_SCHEMA.md**](development/TEST_CONFIG_SCHEMA.md) - Test configuration schema and guidelines
- [**UPDATE_CONTENT_TYPES.md**](development/UPDATE_CONTENT_TYPES.md) - Content types for update operations (text/plain vs XML)
- [**RFC_TESTING.md**](development/RFC_TESTING.md) - RFC testing setup and environment variables

## Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── architecture/
│   ├── ARCHITECTURE.md               # System architecture and design
│   ├── LEGACY.md                     # Legacy system support (BASIS < 7.50)
│   ├── discovery.md                  # ADT Discovery documentation
│   └── discovery.xml                 # Pretty-printed ADT discovery XML
├── usage/
│   ├── CLIENT_API_REFERENCE.md       # Client API reference
│   ├── STATEFUL_SESSION_GUIDE.md     # Session management
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

- **AdtClient** - High-level CRUD API with automatic operation chains (recommended)
- **AdtRuntimeClient** - Runtime operations (ABAP debugger, traces, dumps, logs, feeds, ATC check runs)

See [CLIENT_API_REFERENCE.md](usage/CLIENT_API_REFERENCE.md) for complete method documentation.

### Usage Examples

**Using AdtClient (recommended):**
```typescript
const client = new AdtClient(connection, logger);

// Every member answers a contract: a result or a failure, never both.
const created = await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test',
});
if (!created.ok) throw new Error(created.getError().message);

// Utility operations
const found = await client.getUtils().search({ query: 'Z*', objectType: 'CLAS' });
if (found.ok) found.getResult().value;   // ISearchResult[]
```

### Type System

The package uses a dual naming convention:
- **snake_case** - Low-level ADT parameters
- **camelCase** - Adt* configuration and high-level APIs

See [ARCHITECTURE.md](architecture/ARCHITECTURE.md#type-system-organization) for details.

### Session Management

The package supports stateful sessions with automatic lock handle tracking and session persistence.

See [STATEFUL_SESSION_GUIDE.md](usage/STATEFUL_SESSION_GUIDE.md) for implementation details.

## Contributing

- [CONTRIBUTORS.md](../CONTRIBUTORS.md) - Contribution guidelines and contributor list
- [LICENSE](../LICENSE) - MIT License

## Support

For issues and questions:
- GitHub Issues: [mcp-abap-adt-clients repository](https://github.com/fr0ster/mcp-abap-adt-clients)
- See [DEBUG.md](usage/DEBUG.md) for troubleshooting common issues
