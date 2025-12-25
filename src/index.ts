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

export { AdtClient } from './clients/AdtClient';
export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { CrudClient } from './clients/CrudClient';
// Client APIs (Public API)
export { ReadOnlyClient } from './clients/ReadOnlyClient';

// Export SharedBuilder and AdtUtils
export { AdtUtils, SharedBuilder } from './core/shared';

// AdtRuntimeClient is exported from clients above

// Re-export types from interfaces package for convenience
export type {
  IAbapConnection,
  IAbapRequestOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
export type {
  AdtBehaviorDefinitionType,
  BehaviorDefinitionImplementationType,
  CheckReporter,
  IBehaviorDefinitionConfig as BehaviorDefinitionBuilderConfig,
  IBehaviorDefinitionCreateParams as BehaviorDefinitionCreateParams,
  IBehaviorDefinitionState as BehaviorDefinitionBuilderState,
  IBehaviorDefinitionValidationParams as BehaviorDefinitionValidationParams,
  ICheckMessage as CheckMessage,
  ICheckRunResult as CheckRunResult,
  ILockResult as LockResult,
  IValidationResult as ValidationResult,
} from './core/behaviorDefinition';
export type {
  AdtBehaviorImplementationType,
  IBehaviorImplementationConfig as BehaviorImplementationBuilderConfig,
  IBehaviorImplementationState as BehaviorImplementationBuilderState,
  ICreateBehaviorImplementationParams as CreateBehaviorImplementationParams,
} from './core/behaviorImplementation';
// Export all BuilderConfig types used in client methods
// Export type aliases for high-level Adt classes
export type {
  AdtClassType,
  IClassConfig as ClassBuilderConfig,
  IClassState as ClassBuilderState,
} from './core/class';
export type {
  AdtDataElementType,
  IDataElementConfig as DataElementBuilderConfig,
  IDataElementState as DataElementBuilderState,
} from './core/dataElement';
export type {
  AdtDomainType,
  IDomainConfig as DomainBuilderConfig,
  IDomainState as DomainBuilderState,
} from './core/domain';
export type {
  AdtEnhancement as AdtEnhancementType,
  EnhancementType,
  ICreateEnhancementParams as CreateEnhancementParams,
  IEnhancementConfig as EnhancementBuilderConfig,
  IEnhancementMetadata,
  IEnhancementState as EnhancementBuilderState,
} from './core/enhancement';
export type {
  AdtFunctionGroupType,
  IFunctionGroupConfig as FunctionGroupBuilderConfig,
  IFunctionGroupState as FunctionGroupBuilderState,
} from './core/functionGroup';
export type {
  AdtFunctionModuleType,
  IFunctionModuleConfig as FunctionModuleBuilderConfig,
  IFunctionModuleState as FunctionModuleBuilderState,
} from './core/functionModule';
export type {
  AdtInterfaceType,
  IInterfaceConfig as InterfaceBuilderConfig,
  IInterfaceState as InterfaceBuilderState,
} from './core/interface';
export type {
  AdtMetadataExtensionType,
  IMetadataExtensionConfig as MetadataExtensionBuilderConfig,
  IMetadataExtensionCreateParams as MetadataExtensionCreateParams,
  IMetadataExtensionState as MetadataExtensionBuilderState,
  IMetadataExtensionValidationParams as MetadataExtensionValidationParams,
} from './core/metadataExtension';
// Export package types
export type {
  AdtPackageType,
  ICreatePackageParams as CreatePackageParams,
  IPackageConfig as PackageBuilderConfig,
  IPackageState as PackageBuilderState,
} from './core/package';
export type {
  AdtProgramType,
  IProgramConfig as ProgramBuilderConfig,
  IProgramState as ProgramBuilderState,
} from './core/program';
export type {
  AdtServiceDefinitionType,
  IServiceDefinitionConfig as ServiceDefinitionBuilderConfig,
  IServiceDefinitionState as ServiceDefinitionBuilderState,
} from './core/serviceDefinition';
// Export shared types
export type {
  GetSqlQueryParams,
  GetTableContentsParams,
  GetVirtualFoldersContentsParams,
  GetWhereUsedParams,
  InactiveObjectsResponse,
  ObjectReference,
  SearchObjectsParams,
} from './core/shared';
export type {
  AdtStructureType,
  IStructureConfig as StructureBuilderConfig,
  IStructureState as StructureBuilderState,
} from './core/structure';
export type {
  AdtTableType,
  ITableConfig as TableBuilderConfig,
  ITableState as TableBuilderState,
} from './core/table';
export type {
  AdtDdicTableTypeAlias,
  ITableTypeConfig as TableTypeBuilderConfig,
  ITableTypeState as TableTypeBuilderState,
} from './core/tabletype';
export { AdtDdicTableType } from './core/tabletype';
export type { AdtRequestType } from './core/transport';
export type { AdtUnitTestType } from './core/unitTest';
export type {
  AdtViewType,
  IViewConfig as ViewBuilderConfig,
  IViewState as ViewBuilderState,
} from './core/view';
// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';
