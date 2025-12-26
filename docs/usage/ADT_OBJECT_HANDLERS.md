# ADT Object Handlers

This document maps ADT object types to the core classes and `AdtClient` accessors.

## Core Objects and Client Accessors

- Behavior Definition: `AdtBehaviorDefinition` → `client.getBehaviorDefinition()`
- Behavior Implementation: `AdtBehaviorImplementation` → `client.getBehaviorImplementation()`
- Class: `AdtClass` → `client.getClass()`
- Local Definitions: `AdtLocalDefinitions` → `client.getLocalDefinitions()`
- Local Macros: `AdtLocalMacros` → `client.getLocalMacros()`
- Local Test Class: `AdtLocalTestClass` → `client.getLocalTestClass()`
- Local Types: `AdtLocalTypes` → `client.getLocalTypes()`
- Data Element: `AdtDataElement` → `client.getDataElement()`
- Domain: `AdtDomain` → `client.getDomain()`
- Function Group: `AdtFunctionGroup` → `client.getFunctionGroup()`
- Function Module: `AdtFunctionModule` → `client.getFunctionModule()`
- Interface: `AdtInterface` → `client.getInterface()`
- Metadata Extension: `AdtMetadataExtension` → `client.getMetadataExtension()`
- Package: `AdtPackage` → `client.getPackage()`
- Program: `AdtProgram` → `client.getProgram()`
- Service Definition: `AdtServiceDefinition` → `client.getServiceDefinition()`
- Structure: `AdtStructure` → `client.getStructure()`
- Table: `AdtTable` → `client.getTable()`
- Table Type: `AdtDdicTableType` → `client.getTableType()`
- Transport: `AdtRequest` → `client.getRequest()`
- Unit Tests: `AdtUnitTest`/`AdtCdsUnitTest` → `client.getUnitTest()`, `client.getCdsUnitTest()`
- View (DDLS): `AdtView` → `client.getView()`

## Utilities

Shared utilities are accessed via `client.getUtils()`:

- search, where-used, discovery
- object structure, node structure
- SQL query, table contents, virtual folders
