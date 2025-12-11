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
export { AdtClient } from './clients/AdtClient';

// Export SharedBuilder and AdtUtils
export { SharedBuilder, AdtUtils } from './core/shared';

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
  ICreatePackageParams as CreatePackageParams,
  IPackageConfig as PackageBuilderConfig,
  IPackageState as PackageBuilderState
} from './core/package';

// Export all BuilderConfig types used in client methods
export type { IClassConfig as ClassBuilderConfig, IClassState as ClassBuilderState } from './core/class';
export type { IProgramConfig as ProgramBuilderConfig, IProgramState as ProgramBuilderState } from './core/program';
export type { IInterfaceConfig as InterfaceBuilderConfig, IInterfaceState as InterfaceBuilderState } from './core/interface';
export type { IDataElementConfig as DataElementBuilderConfig, IDataElementState as DataElementBuilderState } from './core/dataElement';
export type { IDomainConfig as DomainBuilderConfig, IDomainState as DomainBuilderState } from './core/domain';
export type { IStructureConfig as StructureBuilderConfig, IStructureState as StructureBuilderState } from './core/structure';
export type { ITableConfig as TableBuilderConfig, ITableState as TableBuilderState } from './core/table';
export type { IViewConfig as ViewBuilderConfig, IViewState as ViewBuilderState } from './core/view';
export type { IFunctionGroupConfig as FunctionGroupBuilderConfig, IFunctionGroupState as FunctionGroupBuilderState } from './core/functionGroup';
export type { IFunctionModuleConfig as FunctionModuleBuilderConfig, IFunctionModuleState as FunctionModuleBuilderState } from './core/functionModule';
export type { IServiceDefinitionConfig as ServiceDefinitionBuilderConfig, IServiceDefinitionState as ServiceDefinitionBuilderState } from './core/serviceDefinition';
export type {
  IBehaviorDefinitionConfig as BehaviorDefinitionBuilderConfig,
  IBehaviorDefinitionState as BehaviorDefinitionBuilderState,
  IBehaviorDefinitionValidationParams as BehaviorDefinitionValidationParams,
  BehaviorDefinitionImplementationType,
  IValidationResult as ValidationResult,
  IBehaviorDefinitionCreateParams as BehaviorDefinitionCreateParams,
  ILockResult as LockResult,
  CheckReporter,
  ICheckMessage as CheckMessage,
  ICheckRunResult as CheckRunResult
} from './core/behaviorDefinition';
export type {
  IBehaviorImplementationConfig as BehaviorImplementationBuilderConfig,
  IBehaviorImplementationState as BehaviorImplementationBuilderState,
  ICreateBehaviorImplementationParams as CreateBehaviorImplementationParams
} from './core/behaviorImplementation';
export type {
  IMetadataExtensionConfig as MetadataExtensionBuilderConfig,
  IMetadataExtensionState as MetadataExtensionBuilderState,
  IMetadataExtensionValidationParams as MetadataExtensionValidationParams,
  IMetadataExtensionCreateParams as MetadataExtensionCreateParams
} from './core/metadataExtension';

// Re-export types from interfaces package for convenience
export type { IAbapConnection, IAbapRequestOptions } from '@mcp-abap-adt/interfaces';

// Export type aliases for high-level Adt classes
export type { AdtClassType } from './core/class';
export type { AdtProgramType } from './core/program';
export type { AdtInterfaceType } from './core/interface';
export type { AdtDomainType } from './core/domain';
export type { AdtDataElementType } from './core/dataElement';
export type { AdtStructureType } from './core/structure';
export type { AdtTableType } from './core/table';
export type { AdtViewType } from './core/view';
export type { AdtFunctionGroupType } from './core/functionGroup';
export type { AdtFunctionModuleType } from './core/functionModule';
export type { AdtPackageType } from './core/package';
export type { AdtServiceDefinitionType } from './core/serviceDefinition';
export type { AdtBehaviorDefinitionType } from './core/behaviorDefinition';
export type { AdtBehaviorImplementationType } from './core/behaviorImplementation';
export type { AdtMetadataExtensionType } from './core/metadataExtension';
export type { AdtUnitTestType } from './core/unitTest';
export type { AdtRequestType } from './core/transport';

// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';
export { type ILogger, emptyLogger } from './utils/logger';
