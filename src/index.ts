/**
 * ADT Clients Package - Main exports
 *
 * Export client classes that provide different levels of access to SAP ADT:
 * - ReadOnlyClient: Read-only operations
 * - CrudClient: Full CRUD operations (extends ReadOnlyClient)
 * - ManagementClient: Activation and syntax checking
 */

export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';
export { ManagementClient } from './clients/ManagementClient';

// Re-export types from connection package for convenience
export type { AbapConnection, AbapRequestOptions } from '@mcp-abap-adt/connection';

// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';

// Export lock/unlock functions for CLI tools
export { lockFunctionGroup, unlockFunctionGroup } from './core/functionGroup/lock';
export { lockClass } from './core/class/lock';
export { unlockClass } from './core/class/unlock';
export { lockProgram } from './core/program/lock';
export { unlockProgram } from './core/program/unlock';
export { lockInterface } from './core/interface/lock';
export { unlockInterface } from './core/interface/unlock';
export { lockFunctionModule } from './core/functionModule/lock';
export { unlockFunctionModule } from './core/functionModule/unlock';
export { unlockDomain } from './core/domain/unlock';
export { unlockDataElement } from './core/dataElement/unlock';

