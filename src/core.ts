/**
 * Internal exports for Builders
 *
 * NOTE: This module is for INTERNAL USE ONLY within the package.
 * Only Builders (classes) are exported here.
 * Low-level functions are private to each module.
 *
 * Public API is in src/index.ts - only Client classes are exported externally.
 */

// Builders (low-level API)
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

// Shared operations (to be exposed through Client classes)
export * from './core/shared/search';
export * from './core/shared/sqlQuery';
export * from './core/shared/tableContents';
export * from './core/shared/whereUsed';

// Note: validation, systemInfo, readMetadata, readSource, checkRun, delete, managementOperations are internal utilities

