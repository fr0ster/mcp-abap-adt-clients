# Documentation

Complete documentation for the `@mcp-abap-adt/adt-clients` package.

## Quick Start

- [Main README](../README.md) - Package overview, installation, and quick start guide
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## Architecture

- [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) - System architecture, design patterns, and type system organization

## Usage Guides

- [**CLIENT_API_REFERENCE.md**](usage/CLIENT_API_REFERENCE.md) - Complete API reference for `ReadOnlyClient` and `CrudClient`
- [**STATEFUL_SESSION_GUIDE.md**](usage/STATEFUL_SESSION_GUIDE.md) - Guide for stateful session management
- [**CHECK_LOCAL_TEST_CLASS.md**](usage/CHECK_LOCAL_TEST_CLASS.md) - Guide for validating ABAP Unit test classes
- [**DEBUG.md**](usage/DEBUG.md) - Debugging and troubleshooting guide
- [**OPERATION_DELAYS.md**](usage/OPERATION_DELAYS.md) - Detailed guide on operation delays and timing
- [**OPERATION_DELAYS_SUMMARY.md**](usage/OPERATION_DELAYS_SUMMARY.md) - Quick reference for operation delays

## Development

- [**BUILDER_TEST_PATTERN.md**](development/BUILDER_TEST_PATTERN.md) - Testing patterns for Builder classes
- [**TEST_CONFIG_SCHEMA.md**](development/TEST_CONFIG_SCHEMA.md) - Test configuration schema and guidelines
- [**CHECK_METHODS_COVERAGE.md**](development/CHECK_METHODS_COVERAGE.md) - Complete coverage of check methods across all layers
- [**UPDATE_CONTENT_TYPES.md**](development/UPDATE_CONTENT_TYPES.md) - Content types for update operations (text/plain vs XML)
- [**TESTING_READINESS.md**](development/TESTING_READINESS.md) - Testing readiness status for all object types
- [**ROADMAP.md**](development/ROADMAP.md) - Development roadmap and planned features

## Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── architecture/
│   └── ARCHITECTURE.md               # System architecture and design
├── usage/
│   ├── CLIENT_API_REFERENCE.md       # Client API reference
│   ├── STATEFUL_SESSION_GUIDE.md     # Session management
│   ├── DEBUG.md                      # Debugging guide
│   ├── OPERATION_DELAYS.md           # Operation delays (detailed)
│   └── OPERATION_DELAYS_SUMMARY.md   # Operation delays (summary)
└── development/
    ├── BUILDER_TEST_PATTERN.md       # Testing patterns
    ├── TEST_CONFIG_SCHEMA.md         # Test configuration
    ├── CHECK_METHODS_COVERAGE.md     # Check methods coverage (100%)
    ├── UPDATE_CONTENT_TYPES.md       # Update content types reference
    ├── TESTING_READINESS.md          # Testing readiness status
    └── ROADMAP.md                    # Development roadmap
```

## Key Concepts

### Client Classes

The package provides two main client classes:

- **ReadOnlyClient** - For read-only operations (metadata retrieval)
- **CrudClient** - For full CRUD operations with state management

See [CLIENT_API_REFERENCE.md](usage/CLIENT_API_REFERENCE.md) for complete method documentation.

### Builder Pattern

All operations use Builder classes for flexible, type-safe configuration:

```typescript
const result = await client.readProgram()
  .withName('Z_MY_PROGRAM')
  .execute();
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
