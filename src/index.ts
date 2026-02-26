/**
 * ADT Clients Package - Main exports
 *
 * Client APIs (Public API):
 * - AdtClient: High-level CRUD operations (validate/create/read/update/delete/activate/check)
 * - AdtRuntimeClient: Runtime operations (stable APIs)
 * - AdtRuntimeClientExperimental: Runtime APIs in progress (may change)
 *
 * @example
 * ```typescript
 * import { AdtClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtClient(connection);
 * await client.getProgram().create({
 *   programName: 'ZTEST',
 *   packageName: 'ZPACKAGE',
 *   description: 'Test program',
 * });
 * await client.getProgram().read({ programName: 'ZTEST' });
 * ```
 */

// Export supporting types needed by client APIs
export type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtObject,
  IAdtResponse,
  ILogger,
  IWebSocketCloseInfo,
  IWebSocketConnectOptions,
  IWebSocketMessageEnvelope,
  IWebSocketMessageHandler,
  IWebSocketTransport,
} from '@mcp-abap-adt/interfaces';
export { AdtClientBatch } from './batch/AdtClientBatch';
export { AdtRuntimeClientBatch } from './batch/AdtRuntimeClientBatch';
export { BatchRecordingConnection } from './batch/BatchRecordingConnection';
export type {
  IBatchPayload,
  IBatchRequestPart,
  IBatchResponsePart,
} from './batch/types';
export type { IAdtClientOptions } from './clients/AdtClient';
export { AdtClient } from './clients/AdtClient';
export { AdtClientsWS } from './clients/AdtClientsWS';
export { AdtExecutor } from './clients/AdtExecutor';
export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { AdtRuntimeClientExperimental } from './clients/AdtRuntimeClientExperimental';
export type {
  DebuggerStepAction,
  IDebuggerAttachParams,
  IDebuggerGetVariablesParams,
  IDebuggerListenParams,
  IDebuggerStepParams,
} from './clients/DebuggerSessionClient';
export { DebuggerSessionClient } from './clients/DebuggerSessionClient';
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
  AdtServiceBindingType,
  DesiredPublicationState,
  GeneratedServiceType,
  IActivateServiceBindingParams,
  IAdtService,
  IAdtServiceBinding,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
  ICreateServiceBindingParams,
  IDeleteServiceBindingParams,
  IGenerateServiceBindingParams,
  IGetServiceBindingODataParams,
  IPublishODataV2Params,
  IReadServiceBindingParams,
  IServiceBindingConfig,
  IServiceBindingState,
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
  ServiceBindingType,
  ServiceBindingVersion,
} from './core/service';
export { AdtService, AdtServiceBinding } from './core/service';
export type {
  AdtServiceDefinitionType,
  IServiceDefinitionConfig,
  IServiceDefinitionState,
} from './core/serviceDefinition';
export type {
  AdtObjectType,
  AdtSourceObjectType,
  GetPackageHierarchyOptions,
  GetSqlQueryParams,
  GetTableContentsParams,
  GetVirtualFoldersContentsParams,
  GetWhereUsedListParams,
  GetWhereUsedParams,
  InactiveObjectsResponse,
  ObjectReference,
  PackageHierarchyCodeFormat,
  PackageHierarchyNode,
  PackageHierarchySupportedType,
  ReadOptions,
  SearchObjectsParams,
  WhereUsedListResult,
  WhereUsedReference,
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
export type {
  IClassExecuteWithProfilerOptions,
  IClassExecuteWithProfilingOptions,
  IClassExecuteWithProfilingResult,
  IClassExecutionTarget,
  IClassExecutor,
  IExecutor,
  IProgramExecuteWithProfilerOptions,
  IProgramExecuteWithProfilingOptions,
  IProgramExecuteWithProfilingResult,
  IProgramExecutionTarget,
  IProgramExecutor,
} from './executors';
