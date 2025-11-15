/**
 * Low-level functions export
 *
 * This module exports all low-level functions for direct use.
 * For high-level API, use ClassBuilder from the main package.
 *
 * @example
 * ```typescript
 * import { createClass, lockClass, updateClass, unlockClass, activateClass } from '@mcp-abap-adt/adt-clients/core';
 * ```
 */

// Class operations
export * from './core/class/create';
export * from './core/class/update';
export * from './core/class/read';
export * from './core/class/lock';
export * from './core/class/unlock';
export * from './core/class/activation';
export * from './core/class/check';
export * from './core/class/run';
export * from './core/class/validation';

// Domain operations
export * from './core/domain/create';
export * from './core/domain/read';
export * from './core/domain/update';
export * from './core/domain/delete';
export * from './core/domain/lock';
export * from './core/domain/unlock';
export * from './core/domain/activation';
export * from './core/domain/check';

// Data Element operations
export * from './core/dataElement/create';
export * from './core/dataElement/read';
export * from './core/dataElement/update';
export * from './core/dataElement/delete';
export * from './core/dataElement/lock';
export * from './core/dataElement/unlock';
export * from './core/dataElement/activation';
export * from './core/dataElement/check';

// Function Group operations
export * from './core/functionGroup/create';
export * from './core/functionGroup/read';
export * from './core/functionGroup/update';
export * from './core/functionGroup/delete';
export * from './core/functionGroup/lock';
export * from './core/functionGroup/unlock';
export * from './core/functionGroup/activation';
export * from './core/functionGroup/check';
export * from './core/functionGroup/validation';

// Function Module operations
export * from './core/functionModule/create';
export * from './core/functionModule/read';
export * from './core/functionModule/update';
export * from './core/functionModule/delete';
export * from './core/functionModule/lock';
export * from './core/functionModule/unlock';
export * from './core/functionModule/activation';
export * from './core/functionModule/check';
export * from './core/functionModule/validation';

// Program operations
export * from './core/program/create';
export * from './core/program/read';
export * from './core/program/update';
export * from './core/program/delete';
export * from './core/program/lock';
export * from './core/program/unlock';
export * from './core/program/activation';
export * from './core/program/check';
export * from './core/program/validation';

// Interface operations
export * from './core/interface/create';
export * from './core/interface/read';
export * from './core/interface/update';
export * from './core/interface/delete';
export * from './core/interface/lock';
export * from './core/interface/unlock';
export * from './core/interface/activation';
export * from './core/interface/check';
export * from './core/interface/validation';

// Builders (low-level API)
export { ClassBuilder, type ClassBuilderConfig, type ClassBuilderLogger, type ClassBuilderState } from './core/class/ClassBuilder';
export { DomainBuilder, type DomainBuilderConfig, type DomainBuilderLogger, type DomainBuilderState } from './core/domain/DomainBuilder';
export { DataElementBuilder, type DataElementBuilderConfig, type DataElementBuilderLogger, type DataElementBuilderState } from './core/dataElement/DataElementBuilder';
export { ProgramBuilder, type ProgramBuilderConfig, type ProgramBuilderLogger, type ProgramBuilderState } from './core/program/ProgramBuilder';
export { InterfaceBuilder, type InterfaceBuilderConfig, type InterfaceBuilderLogger, type InterfaceBuilderState } from './core/interface/InterfaceBuilder';
export { FunctionGroupBuilder, type FunctionGroupBuilderConfig, type FunctionGroupBuilderLogger, type FunctionGroupBuilderState } from './core/functionGroup/FunctionGroupBuilder';
export { FunctionModuleBuilder, type FunctionModuleBuilderConfig, type FunctionModuleBuilderLogger, type FunctionModuleBuilderState } from './core/functionModule/FunctionModuleBuilder';

// Shared utilities
export * from './core/shared/validation';
export * from './core/shared/systemInfo';
export * from './core/delete';

