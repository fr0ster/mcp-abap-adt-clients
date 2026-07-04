/**
 * ADT Clients — core barrel
 * Covers: AdtClient, AdtClientLegacy, createAdtClient, all core/** object types,
 * core/shared utilities, and the @mcp-abap-adt/interfaces re-export block (back-compat).
 * Ambiguous utils (discoveryEndpoints, systemInfo) are placed here per the "ambiguous → core" rule.
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
export type { IAdtClientOptions, IAdtSystemContext } from './clients/AdtClient';
export { AdtClient } from './clients/AdtClient';
export { AdtClientLegacy } from './clients/AdtClientLegacy';
export { createAdtClient } from './clients/createAdtClient';
export type {
  AdtAccessControlType,
  IAccessControlConfig,
  IAccessControlState,
} from './core/accessControl';
export type {
  AdtAppendStructureType,
  IAppendStructureConfig,
  IAppendStructureState,
} from './core/appendStructure';
export { AdtAppendStructure } from './core/appendStructure';
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
export type { AdtDdlType, IDdlConfig, IDdlState } from './core/ddl';
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
  AdtMessageClassMessageType,
  AdtMessageClassType,
  IMessageClassConfig,
  IMessageClassMessageConfig,
  IMessageClassMessageState,
  IMessageClassState,
} from './core/messageClass';
export { AdtMessageClass, AdtMessageClassMessage } from './core/messageClass';
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
  AdtScalarFunctionType,
  IScalarFunctionConfig,
  IScalarFunctionState,
} from './core/scalarFunction';
export { AdtScalarFunction } from './core/scalarFunction';
export type {
  AdtScalarFunctionImplementationType,
  IScalarFunctionImplementationConfig,
  IScalarFunctionImplementationState,
} from './core/scalarFunctionImplementation';
export { AdtScalarFunctionImplementation } from './core/scalarFunctionImplementation';
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
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
