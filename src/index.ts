/**
 * ADT Clients Package - Main exports
 *
 * Client APIs (Public API):
 * - ReadOnlyClient: Read-only operations (read* methods)
 * - CrudClient: Full CRUD operations (read* + create*, lock*, unlock*, update*, activate*, check*, validate*)
 *
 * Use Builders directly from core for fine-grained control and method chaining.
 * Builders are exported from './core' entry point.
 *
 * @example
 * ```typescript
 * import { ReadOnlyClient, CrudClient } from '@mcp-abap-adt/adt-clients';
 * import { InterfaceBuilder } from '@mcp-abap-adt/adt-clients/core';
 *
 * // Using ReadOnlyClient for read operations
 * const readClient = new ReadOnlyClient(connection);
 * await readClient.readProgram('ZTEST');
 *
 * // Using CrudClient for CRUD operations
 * const crudClient = new CrudClient(connection);
 * await crudClient.createProgram('ZTEST', 'Test program', 'ZPACKAGE');
 * const lockHandle = await crudClient.lockProgram('ZTEST');
 * await crudClient.updateProgram('ZTEST', 'WRITE: / "Hello".', lockHandle);
 * await crudClient.unlockProgram('ZTEST', lockHandle);
 * await crudClient.activateProgram('ZTEST');
 *
 * // Using Builder for complex workflows with chaining
 * const builder = new InterfaceBuilder(connection, {}, { interfaceName: 'ZIF_TEST', description: 'Test' });
 * await builder.create().lock().setCode('INTERFACE zif_test. ENDINTERFACE.').update().unlock().activate();
 * ```
 */

// Client APIs (Public API)
export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';

// Export SharedBuilder
export { SharedBuilder } from './core/shared';

// Export shared types
export type { 
  InactiveObjectsResponse,
  ObjectReference,
  SearchObjectsParams,
  GetSqlQueryParams,
  GetTableContentsParams,
  GetWhereUsedParams
} from './core/shared';

// Export package types
export type {
  CreatePackageParams,
  PackageBuilderConfig,
  PackageBuilderState
} from './core/package';

// Export all BuilderConfig types used in client methods
export type { ClassBuilderConfig, ClassBuilderState } from './core/class';
export type { ProgramBuilderConfig, ProgramBuilderState } from './core/program';
export type { InterfaceBuilderConfig, InterfaceBuilderState } from './core/interface';
export type { DataElementBuilderConfig, DataElementBuilderState } from './core/dataElement';
export type { DomainBuilderConfig, DomainBuilderState } from './core/domain';
export type { StructureBuilderConfig, StructureBuilderState } from './core/structure';
export type { TableBuilderConfig, TableBuilderState } from './core/table';
export type { ViewBuilderConfig, ViewBuilderState } from './core/view';
export type { FunctionGroupBuilderConfig, FunctionGroupBuilderState } from './core/functionGroup';
export type { FunctionModuleBuilderConfig, FunctionModuleBuilderState } from './core/functionModule';
export type { ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderState } from './core/serviceDefinition';
export type { 
  BehaviorDefinitionBuilderConfig, 
  BehaviorDefinitionBuilderState, 
  BehaviorDefinitionValidationParams,
  BehaviorDefinitionImplementationType,
  ValidationResult,
  BehaviorDefinitionCreateParams,
  LockResult,
  CheckReporter,
  CheckMessage,
  CheckRunResult
} from './core/behaviorDefinition';
export type { 
  BehaviorImplementationBuilderConfig, 
  BehaviorImplementationBuilderState,
  CreateBehaviorImplementationParams
} from './core/behaviorImplementation';
export type { 
  MetadataExtensionBuilderConfig, 
  MetadataExtensionBuilderState,
  MetadataExtensionValidationParams,
  MetadataExtensionCreateParams
} from './core/metadataExtension';

// Export class unit test types
export type { ClassUnitTestDefinition, ClassUnitTestRunOptions } from './core/class';

// Re-export types from connection package for convenience
export type { AbapConnection, AbapRequestOptions } from '@mcp-abap-adt/connection';

// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';
export { type IAdtLogger, emptyLogger } from './utils/logger';
