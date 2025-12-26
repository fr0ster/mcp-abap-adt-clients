/**
 * ADT Clients Package - Main exports
 *
 * Client APIs (Public API):
 * - ReadOnlyClient: Read-only operations (read* methods)
 * - CrudClient: Full CRUD operations (read* + create*, lock*, unlock*, update*, activate*, check*, validate*)
 *
 * @example
 * ```typescript
 * import { ReadOnlyClient, CrudClient } from '@mcp-abap-adt/adt-clients';
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
 * ```
 */

// Export supporting types needed by client APIs
export type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtObject,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
export { AdtClient } from './clients/AdtClient';
export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { CrudClient } from './clients/CrudClient';
// Client APIs (Public API)
export { ReadOnlyClient } from './clients/ReadOnlyClient';
export type {
  AdtBehaviorDefinitionType,
  BehaviorDefinitionImplementationType,
  CheckReporter,
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionCreateParams,
  IBehaviorDefinitionState,
  IBehaviorDefinitionValidationParams,
  ICheckMessage,
  ICheckRunResult,
  ILockResult,
  IValidationResult,
} from './core/behaviorDefinition';
export type {
  AdtBehaviorImplementationType,
  IBehaviorImplementationConfig,
  IBehaviorImplementationState,
  ICreateBehaviorImplementationParams,
} from './core/behaviorImplementation';
export type {
  AdtClassType,
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions,
  IClassBuilderConfig,
  IClassBuilderState,
  IClassConfig,
  IClassState,
  ILocalDefinitionsConfig,
  ILocalMacrosConfig,
  ILocalTestClassConfig,
  ILocalTypesConfig,
} from './core/class';
export type {
  AdtDataElementType,
  IDataElementConfig,
  IDataElementState,
} from './core/dataElement';
export type { AdtDomainType, IDomainConfig, IDomainState } from './core/domain';
export type {
  AdtEnhancement as AdtEnhancementType,
  EnhancementType,
  ICreateEnhancementParams,
  IEnhancementConfig,
  IEnhancementMetadata,
  IEnhancementState,
} from './core/enhancement';
export type {
  AdtFunctionGroupType,
  IFunctionGroupConfig,
  IFunctionGroupState,
} from './core/functionGroup';
export type {
  AdtFunctionModuleType,
  IFunctionModuleConfig,
  IFunctionModuleState,
} from './core/functionModule';
export type {
  AdtInterfaceType,
  IInterfaceConfig,
  IInterfaceState,
} from './core/interface';
export type {
  AdtMetadataExtensionType,
  IMetadataExtensionConfig,
  IMetadataExtensionCreateParams,
  IMetadataExtensionState,
  IMetadataExtensionValidationParams,
} from './core/metadataExtension';
export type {
  AdtPackageType,
  ICreatePackageParams,
  IPackageConfig,
  IPackageState,
} from './core/package';
export type {
  AdtProgramType,
  IProgramConfig,
  IProgramState,
} from './core/program';
export type {
  AdtServiceDefinitionType,
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from './core/serviceDefinition';
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
  IStructureConfig,
  IStructureState,
} from './core/structure';
export type { AdtTableType, ITableConfig, ITableState } from './core/table';
export type {
  AdtDdicTableTypeAlias,
  ITableTypeConfig,
  ITableTypeState,
} from './core/tabletype';
export type {
  AdtRequestType,
  ITransportConfig,
  ITransportState,
} from './core/transport';
export type {
  AdtUnitTestType,
  ICdsUnitTestConfig,
  ICdsUnitTestState,
  IUnitTestConfig,
  IUnitTestState,
} from './core/unitTest';
export type { AdtViewType, IViewConfig, IViewState } from './core/view';
