/**
 * ADT Clients Package - Main exports
 *
 * High-level API:
 * - ReadOnlyClient: Read-only operations
 * - CrudClient: Full CRUD operations (extends ReadOnlyClient)
 * - ManagementClient: Activation and syntax checking
 * - ClassBuilder: Fluent API for class operations with Promise chaining
 *
 * For low-level functions, import from '@mcp-abap-adt/adt-clients/core'
 * @example
 * ```typescript
 * import { ClassBuilder } from '@mcp-abap-adt/adt-clients';
 * import { createClass, lockClass, updateClass } from '@mcp-abap-adt/adt-clients/core';
 * ```
 */

export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';
export { ManagementClient } from './clients/ManagementClient';

// Export Builders for high-level operations
export { ClassBuilder, type ClassBuilderConfig, type ClassBuilderLogger, type ClassBuilderState } from './core/class/ClassBuilder';
export { DomainBuilder, type DomainBuilderConfig, type DomainBuilderLogger, type DomainBuilderState } from './core/domain/DomainBuilder';
export { DataElementBuilder, type DataElementBuilderConfig, type DataElementBuilderLogger, type DataElementBuilderState } from './core/dataElement/DataElementBuilder';
export { ProgramBuilder, type ProgramBuilderConfig, type ProgramBuilderLogger, type ProgramBuilderState } from './core/program/ProgramBuilder';
export { InterfaceBuilder, type InterfaceBuilderConfig, type InterfaceBuilderLogger, type InterfaceBuilderState } from './core/interface/InterfaceBuilder';
export { FunctionGroupBuilder, type FunctionGroupBuilderConfig, type FunctionGroupBuilderLogger, type FunctionGroupBuilderState } from './core/functionGroup/FunctionGroupBuilder';
export { FunctionModuleBuilder, type FunctionModuleBuilderConfig, type FunctionModuleBuilderLogger, type FunctionModuleBuilderState } from './core/functionModule/FunctionModuleBuilder';
export { StructureBuilder, type StructureBuilderConfig, type StructureBuilderLogger, type StructureBuilderState } from './core/structure/StructureBuilder';
export { TableBuilder, type TableBuilderConfig, type TableBuilderLogger, type TableBuilderState } from './core/table/TableBuilder';
export { ViewBuilder, type ViewBuilderConfig, type ViewBuilderLogger, type ViewBuilderState } from './core/view/ViewBuilder';
export { TransportBuilder, type TransportBuilderConfig, type TransportBuilderLogger, type TransportBuilderState } from './core/transport/TransportBuilder';
export { PackageBuilder, type PackageBuilderConfig, type PackageBuilderLogger, type PackageBuilderState } from './core/package/PackageBuilder';

// Re-export types from connection package for convenience
export type { AbapConnection, AbapRequestOptions } from '@mcp-abap-adt/connection';

// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';
