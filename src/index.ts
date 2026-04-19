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
export type { IAdtClientOptions, IAdtSystemContext } from './clients/AdtClient';
export { AdtClient } from './clients/AdtClient';
export { AdtClientLegacy } from './clients/AdtClientLegacy';
export { AdtClientsWS } from './clients/AdtClientsWS';
export { AdtExecutor } from './clients/AdtExecutor';
export { AdtRuntimeClient } from './clients/AdtRuntimeClient';
export { AdtRuntimeClientExperimental } from './clients/AdtRuntimeClientExperimental';
export { createAdtClient } from './clients/createAdtClient';
export type {
  DebuggerStepAction,
  IDebuggerAttachParams,
  IDebuggerGetVariablesParams,
  IDebuggerListenParams,
  IDebuggerStepParams,
} from './clients/DebuggerSessionClient';
export { DebuggerSessionClient } from './clients/DebuggerSessionClient';
export type {
  AdtAccessControlType,
  IAccessControlConfig,
  IAccessControlState,
} from './core/accessControl';
export type {
  IAuthorizationFieldConfig,
  IAuthorizationFieldState,
} from './core/authorizationField';
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
  FeatureToggleState,
  IFeatureToggleAttribute,
  IFeatureToggleCheckStateResult,
  IFeatureToggleClientLevel,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleRuntimeState,
  IFeatureToggleSource,
  IFeatureToggleState,
  IFeatureToggleUserLevel,
} from './core/featureToggle';
export type {
  AdtFunctionGroupType,
  IFunctionGroupConfig,
  IFunctionGroupState,
} from './core/functionGroup';
export type {
  IFunctionIncludeConfig,
  IFunctionIncludeState,
} from './core/functionInclude';
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
  ServiceBindingVariant,
  ServiceBindingVersion,
} from './core/service';
export {
  AdtService,
  AdtServiceBinding,
  resolveBindingVariant,
  SERVICE_BINDING_VARIANT_MAP,
} from './core/service';
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
export type { IAdtContentTypes, IAdtHeaders } from './core/shared/contentTypes';
export {
  AdtContentTypesBase,
  AdtContentTypesModern,
} from './core/shared/contentTypes';
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
  AdtTransformationType,
  ITransformationConfig,
  ITransformationState,
  TransformationType,
} from './core/transformation';
export type {
  AdtRequestType,
  IListTransportsParams,
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
export { ApplicationLog } from './runtime/applicationLog/ApplicationLog';
export { AtcLog } from './runtime/atc/AtcLog';
export { DdicActivation } from './runtime/ddic/DdicActivation';
export { AbapDebugger } from './runtime/debugger/AbapDebugger';
export { AmdpDebugger } from './runtime/debugger/AmdpDebugger';
export { Debugger } from './runtime/debugger/Debugger';
// Keep low-level dump types/functions (may be used by consumers)
export {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  type IRuntimeDumpReadOptions,
  type IRuntimeDumpReadView,
  type IRuntimeDumpsListOptions,
} from './runtime/dumps';
export { RuntimeDumps } from './runtime/dumps/RuntimeDumps';
export { FeedRepository } from './runtime/feeds/FeedRepository';
export type {
  IFeedEntry,
  IFeedQueryOptions,
  IFeedRepository,
} from './runtime/feeds/types';
export { GatewayErrorLog } from './runtime/gatewayErrorLog/GatewayErrorLog';
export type {
  ICallStackEntry,
  IGatewayErrorDetail,
  IGatewayErrorEntry,
  IGatewayException,
  ISourceCodeLine,
} from './runtime/gatewayErrorLog/types';
// MemorySnapshots is now accessed via getDebugger().getMemorySnapshots()
// The class is still exported for backward compatibility
export { MemorySnapshots } from './runtime/memory/MemorySnapshots';
export { SystemMessages } from './runtime/systemMessages/SystemMessages';
export type { ISystemMessageEntry } from './runtime/systemMessages/types';
export { CrossTrace } from './runtime/traces/CrossTraceDomain';
// Domain objects
export { Profiler } from './runtime/traces/ProfilerDomain';
export { St05Trace } from './runtime/traces/St05Trace';
export type {
  IListableRuntimeObject,
  IRuntimeAnalysisObject,
} from './runtime/types';
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
