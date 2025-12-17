# Documentation

Complete documentation for the `@mcp-abap-adt/adt-clients` package.

## Quick Start

- [Main README](../README.md) - Package overview, installation, and quick start guide
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Architecture

- [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) - System architecture, design patterns, and type system organization

## Usage Guides

- [**CLIENT_API_REFERENCE.md**](usage/CLIENT_API_REFERENCE.md) - Complete API reference for `AdtClient`, `ReadOnlyClient`, and `CrudClient`
- [**STATEFUL_SESSION_GUIDE.md**](usage/STATEFUL_SESSION_GUIDE.md) - Guide for stateful session management
- [**CHECK_LOCAL_TEST_CLASS.md**](usage/CHECK_LOCAL_TEST_CLASS.md) - Guide for validating ABAP Unit test classes
- [**DEBUG.md**](usage/DEBUG.md) - Debugging and troubleshooting guide
- [**OPERATION_DELAYS.md**](usage/OPERATION_DELAYS.md) - Detailed guide on operation delays and timing
- [**OPERATION_DELAYS_SUMMARY.md**](usage/OPERATION_DELAYS_SUMMARY.md) - Quick reference for operation delays

## Development

- [**BUILDER_TEST_PATTERN.md**](development/BUILDER_TEST_PATTERN.md) - Testing patterns for Builder classes
- [**TEST_CONFIG_SCHEMA.md**](development/TEST_CONFIG_SCHEMA.md) - Test configuration schema and guidelines
- [**UPDATE_CONTENT_TYPES.md**](development/UPDATE_CONTENT_TYPES.md) - Content types for update operations (text/plain vs XML)
- [**BASE_TESTER_MIGRATION.md**](development/archive/roadmaps/BASE_TESTER_MIGRATION.md) - BaseTester migration status and roadmap (completed, archived)

## Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── architecture/
│   ├── ARCHITECTURE.md               # System architecture and design
│   └── discovery.md                  # ADT Discovery documentation
├── usage/
│   ├── CLIENT_API_REFERENCE.md       # Client API reference
│   ├── STATEFUL_SESSION_GUIDE.md     # Session management
│   ├── CHECK_LOCAL_TEST_CLASS.md     # Local test class validation
│   ├── DEBUG.md                      # Debugging guide
│   ├── OPERATION_DELAYS.md           # Operation delays (detailed)
│   └── OPERATION_DELAYS_SUMMARY.md   # Operation delays (summary)
└── development/
    ├── BUILDER_TEST_PATTERN.md       # Testing patterns
    ├── TEST_CONFIG_SCHEMA.md         # Test configuration
    ├── UPDATE_CONTENT_TYPES.md       # Update content types reference
    └── archive/
        └── roadmaps/
            └── BASE_TESTER_MIGRATION.md  # BaseTester migration status (completed)
```

## Key Concepts

### Client Classes

The package provides three main client classes:

- **AdtClient** - High-level CRUD API with automatic operation chains (recommended)
- **ReadOnlyClient** - For read-only operations (metadata retrieval)
- **CrudClient** - For full CRUD operations with state management (extends ReadOnlyClient)

See [CLIENT_API_REFERENCE.md](usage/CLIENT_API_REFERENCE.md) for complete method documentation.

### Usage Examples

**Using AdtClient (recommended):**
```typescript
const client = new AdtClient(connection, logger);

// CRUD operations via IAdtObject
await client.getClass().create({ className: 'ZCL_TEST', packageName: 'ZPACKAGE', description: 'Test' });

// Utility operations
const utils = client.getUtils();
await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
```

**Using ReadOnlyClient:**
```typescript
const client = new ReadOnlyClient(connection);
const program = await client.readProgram('Z_MY_PROGRAM');
```

### Type System

The package uses a dual naming convention:
- **snake_case** - Low-level ADT parameters
- **camelCase** - Builder configuration and high-level APIs

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
