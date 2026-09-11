/**
 * AdtClient - High-level ADT Object Operations Client
 *
 * Provides simplified CRUD operations with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * AdtClient provides high-level methods that encapsulate complex operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 *
 * Each factory method returns an IAdtObject instance that can be used
 * to perform operations on a specific object type.
 */

import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtClientOptions,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtDataPreview,
  IAdtDeletable,
  IAdtDiscovery,
  IAdtGroupLifecycle,
  IAdtInformationSystem,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtObjectAccess,
  IAdtReadable,
  IAdtRepositoryStructure,
  IAdtRequest,
  IAdtRunnable,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ICdsTestDoubleCheckable,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IIncludeConfig,
  ILogger,
  ISessionLifecycleAware,
  ITestRunInformation,
} from '@mcp-abap-adt/interfaces';
import { ADT_SESSION_ERROR } from '@mcp-abap-adt/interfaces';
import {
  AdtAccessControl,
  accessControlDocuments,
  type IAccessControlConfig,
  type IAccessControlResults,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  appendStructureDocuments,
  type IAppendStructureConfig,
  type IAppendStructureResults,
} from '../core/appendStructure';
import {
  AdtAuthorizationField,
  authorizationFieldDocuments,
  type IAuthorizationFieldConfig,
  type IAuthorizationFieldResults,
} from '../core/authorizationField';
import {
  AdtBehaviorDefinition,
  behaviorDefinitionDocuments,
  type IBehaviorDefinitionConfig,
  type IBehaviorDefinitionResults,
} from '../core/behaviorDefinition';
import {
  AdtBehaviorImplementation,
  classDocuments,
  type IBehaviorImplementationConfig,
  type IClassResults,
} from '../core/behaviorImplementation';
import {
  AdtClass,
  AdtLocalDefinitions,
  AdtLocalMacros,
  AdtLocalTestClass,
  AdtLocalTypes,
  type IClassConfig,
  type ILocalDefinitionsConfig,
  type ILocalMacrosConfig,
  type ILocalTestClassConfig,
  type ILocalTypesConfig,
} from '../core/class';
import {
  AdtDataElement,
  dataElementDocuments,
  type IDataElementConfig,
  type IDataElementResults,
} from '../core/dataElement';
import {
  AdtDdl,
  ddlDocuments,
  type IDdlConfig,
  type IDdlResults,
} from '../core/ddl';
import {
  AdtDomain,
  domainDocuments,
  type IDomainConfig,
  type IDomainResults,
} from '../core/domain';
import {
  AdtEnhancement,
  enhancementDocuments,
  type IEnhancementConfig,
  type IEnhancementResults,
} from '../core/enhancement';
import {
  AdtFeatureToggle,
  featureToggleDocuments,
  type IFeatureToggleConfig,
  type IFeatureToggleResults,
} from '../core/featureToggle';
import {
  AdtFunctionGroup,
  functionGroupDocuments,
  type IFunctionGroupConfig,
  type IFunctionGroupResults,
} from '../core/functionGroup';
import {
  AdtFunctionInclude,
  functionIncludeDocuments,
  type IFunctionIncludeConfig,
  type IFunctionIncludeResults,
} from '../core/functionInclude';
import {
  AdtFunctionModule,
  functionModuleDocuments,
  type IFunctionModuleConfig,
  type IFunctionModuleResults,
} from '../core/functionModule';
import {
  AdtInclude,
  type IIncludeResults,
  includeDocuments,
} from '../core/include';
import {
  AdtInterface,
  type IInterfaceConfig,
  type IInterfaceResults,
  interfaceDocuments,
} from '../core/interface';
import {
  AdtMessageClass,
  AdtMessageClassMessage,
  type IMessageClassConfig,
  type IMessageClassMessageConfig,
  type IMessageClassMessageResults,
  type IMessageClassResults,
  messageClassDocuments,
  messageDocuments,
} from '../core/messageClass';
import {
  AdtMetadataExtension,
  type IMetadataExtensionConfig,
  type IMetadataExtensionResults,
  metadataExtensionDocuments,
} from '../core/metadataExtension';
import {
  AdtPackage,
  type IPackageConfig,
  type IPackageResults,
  packageDocuments,
} from '../core/package';
import {
  AdtProgram,
  type IProgramConfig,
  type IProgramResults,
  programDocuments,
} from '../core/program';
import {
  AdtScalarFunction,
  type IScalarFunctionConfig,
  type IScalarFunctionResults,
  scalarFunctionDocuments,
} from '../core/scalarFunction';
import {
  AdtScalarFunctionImplementation,
  type IScalarFunctionImplementationConfig,
  type IScalarFunctionImplementationResults,
  scalarFunctionImplementationDocuments,
} from '../core/scalarFunctionImplementation';
import {
  AdtServiceBinding,
  type IServiceResults,
  serviceDocuments,
} from '../core/service';
import {
  AdtServiceDefinition,
  type IServiceDefinitionConfig,
  type IServiceDefinitionResults,
  serviceDefinitionDocuments,
} from '../core/serviceDefinition';
import { AdtUtils } from '../core/shared/AdtUtils';
import { type LockFailure, LockRegistry } from '../core/shared/LockRegistry';
import type { ObjectVersion } from '../core/shared/results';
import { type IUtilResults, utilDocuments } from '../core/shared/utilResultSet';
import type {
  IPackageContentItem,
  IWhereUsedListResult,
} from '../core/shared/utilResults';
import {
  AdtStructure,
  type IStructureConfig,
  type IStructureResults,
  structureDocuments,
} from '../core/structure';
import {
  AdtTable,
  type ITableConfig,
  type ITableResults,
  tableDocuments,
} from '../core/table';
import {
  AdtDdicTableType,
  type ITableTypeConfig,
  type ITableTypeResults,
  tableTypeDocuments,
} from '../core/tabletype';
import {
  AdtTransformation,
  type ITransformationConfig,
  type ITransformationResults,
  transformationDocuments,
} from '../core/transformation';
import {
  AdtRequest,
  type ITransportConfig,
  type ITransportResults,
  transportDocuments,
} from '../core/transport';
import {
  AdtCdsUnitTest,
  AdtUnitTest,
  type ICdsUnitTestConfig,
  type IUnitTestConfig,
  type IUnitTestResults,
  unitTestDocuments,
} from '../core/unitTest';
import { withRequestTrace } from '../utils/requestTrace';

/**
 * **What each factory hands back, named once.**
 *
 * These compositions used to be written twice per factory — once in the
 * no-argument overload and once in the parameterised one — and two copies of a
 * type can disagree without anything noticing. One did: `getClass` declared
 * nine atoms while `AdtClass` offered ten, and the missing `IAdtTransportAware`
 * was invisible for as long as the no-argument overload answered the concrete
 * class, because a class trivially offers whatever it implements.
 *
 * One definition per object, both overloads reading it, so that particular
 * disagreement is no longer expressible. `capabilities/shape.ts` checks these
 * against the manifest.
 */
export type IClassContract<R extends IClassResults> = IAdtCreatable<
  IClassConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IClassConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IClassConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IClassConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IClassConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IClassConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IClassConfig, ReturnType<R['check']>> &
  IAdtActivatable<IClassConfig, ReturnType<R['activation']>> &
  IAdtLockable<IClassConfig> &
  IAdtTransportAware<IClassConfig, string> &
  IAdtVersionable<IClassConfig, ObjectVersion[], string>;
export type IProgramContract<R extends IProgramResults> = IAdtCreatable<
  IProgramConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IProgramConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IProgramConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IProgramConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IProgramConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IProgramConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IProgramConfig, ReturnType<R['check']>> &
  IAdtActivatable<IProgramConfig, ReturnType<R['activation']>> &
  IAdtLockable<IProgramConfig> &
  IAdtTransportAware<IProgramConfig, ReturnType<R['transport']>> &
  IAdtVersionable<IProgramConfig, ObjectVersion[], string>;
export type IIncludeContract<R extends IIncludeResults> = IAdtCreatable<
  IIncludeConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IIncludeConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IIncludeConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IIncludeConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IIncludeConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IIncludeConfig, ReturnType<R['validation']>> &
  IAdtActivatable<IIncludeConfig, ReturnType<R['activation']>> &
  IAdtLockable<IIncludeConfig>;
export type IInterfaceContract<R extends IInterfaceResults> = IAdtCreatable<
  IInterfaceConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IInterfaceConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IInterfaceConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IInterfaceConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IInterfaceConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IInterfaceConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IInterfaceConfig, ReturnType<R['check']>> &
  IAdtActivatable<IInterfaceConfig, ReturnType<R['activation']>> &
  IAdtLockable<IInterfaceConfig> &
  IAdtTransportAware<IInterfaceConfig, ReturnType<R['transport']>> &
  IAdtVersionable<IInterfaceConfig, ObjectVersion[], string>;
export type IDomainContract<R extends IDomainResults> = IAdtCreatable<
  IDomainConfig,
  ReturnType<R['created']>
> &
  IAdtMetadataReadable<IDomainConfig, ReturnType<R['metadata']>> &
  IAdtMetadataUpdatable<
    Partial<IDomainConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    IDomainConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IDomainConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IDomainConfig, ReturnType<R['check']>> &
  IAdtActivatable<IDomainConfig, ReturnType<R['activation']>> &
  IAdtLockable<IDomainConfig> &
  IAdtTransportAware<IDomainConfig, ReturnType<R['transport']>>;
export type IDataElementContract<R extends IDataElementResults> = IAdtCreatable<
  IDataElementConfig,
  ReturnType<R['created']>
> &
  IAdtMetadataReadable<IDataElementConfig, ReturnType<R['metadata']>> &
  IAdtMetadataUpdatable<
    Partial<IDataElementConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    IDataElementConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IDataElementConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IDataElementConfig, ReturnType<R['check']>> &
  IAdtActivatable<IDataElementConfig, ReturnType<R['activation']>> &
  IAdtLockable<IDataElementConfig> &
  IAdtTransportAware<IDataElementConfig, ReturnType<R['transport']>>;
export type IAuthorizationFieldContract<R extends IAuthorizationFieldResults> =
  IAdtCreatable<IAuthorizationFieldConfig, ReturnType<R['created']>> &
    IAdtMetadataReadable<IAuthorizationFieldConfig, ReturnType<R['metadata']>> &
    IAdtMetadataUpdatable<
      Partial<IAuthorizationFieldConfig>,
      ReturnType<R['metadataUpdated']>
    > &
    IAdtDeletable<
      IAuthorizationFieldConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IAuthorizationFieldConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IAuthorizationFieldConfig, ReturnType<R['check']>> &
    IAdtActivatable<IAuthorizationFieldConfig, ReturnType<R['activation']>> &
    IAdtLockable<IAuthorizationFieldConfig>;
export type IStructureContract<R extends IStructureResults> = IAdtCreatable<
  IStructureConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IStructureConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IStructureConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IStructureConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IStructureConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IStructureConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IStructureConfig, ReturnType<R['check']>> &
  IAdtActivatable<IStructureConfig, ReturnType<R['activation']>> &
  IAdtLockable<IStructureConfig> &
  IAdtTransportAware<IStructureConfig, ReturnType<R['transport']>> &
  IAdtVersionable<IStructureConfig, ObjectVersion[], string>;
export type ITableContract<R extends ITableResults> = IAdtCreatable<
  ITableConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<ITableConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<ITableConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<ITableConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    ITableConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<ITableConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ITableConfig, ReturnType<R['check']>> &
  IAdtActivatable<ITableConfig, ReturnType<R['activation']>> &
  IAdtLockable<ITableConfig> &
  IAdtTransportAware<ITableConfig, ReturnType<R['transport']>> &
  IAdtVersionable<ITableConfig, ObjectVersion[], string>;
export type ITableTypeContract<R extends ITableTypeResults> = IAdtCreatable<
  ITableTypeConfig,
  ReturnType<R['created']>
> &
  IAdtMetadataReadable<ITableTypeConfig, ReturnType<R['metadata']>> &
  IAdtMetadataUpdatable<
    Partial<ITableTypeConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    ITableTypeConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<ITableTypeConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ITableTypeConfig, ReturnType<R['check']>> &
  IAdtActivatable<ITableTypeConfig, ReturnType<R['activation']>> &
  IAdtLockable<ITableTypeConfig> &
  IAdtTransportAware<ITableTypeConfig, ReturnType<R['transport']>> &
  IAdtVersionable<ITableTypeConfig, ObjectVersion[], string>;
export type IDdlContract<R extends IDdlResults> = IAdtCreatable<
  IDdlConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IDdlConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IDdlConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IDdlConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IDdlConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IDdlConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IDdlConfig, ReturnType<R['check']>> &
  IAdtActivatable<IDdlConfig, ReturnType<R['activation']>> &
  IAdtLockable<IDdlConfig> &
  IAdtTransportAware<IDdlConfig, ReturnType<R['transport']>> &
  IAdtVersionable<IDdlConfig, ObjectVersion[], string>;
export type IFunctionGroupContract<R extends IFunctionGroupResults> =
  IAdtCreatable<IFunctionGroupConfig, ReturnType<R['created']>> &
    IAdtMetadataReadable<IFunctionGroupConfig, ReturnType<R['metadata']>> &
    IAdtMetadataUpdatable<
      Partial<IFunctionGroupConfig>,
      ReturnType<R['metadataUpdated']>
    > &
    IAdtDeletable<
      IFunctionGroupConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IFunctionGroupConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionGroupConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionGroupConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionGroupConfig> &
    IAdtTransportAware<IFunctionGroupConfig, ReturnType<R['transport']>>;
export type IFunctionModuleContract<R extends IFunctionModuleResults> =
  IAdtCreatable<IFunctionModuleConfig, ReturnType<R['created']>> &
    IAdtReadable<IFunctionModuleConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IFunctionModuleConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IFunctionModuleConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IFunctionModuleConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IFunctionModuleConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionModuleConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionModuleConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionModuleConfig> &
    IAdtTransportAware<IFunctionModuleConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IFunctionModuleConfig, ObjectVersion[], string>;
export type IFunctionIncludeContract<R extends IFunctionIncludeResults> =
  IAdtCreatable<IFunctionIncludeConfig, ReturnType<R['created']>> &
    IAdtReadable<IFunctionIncludeConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IFunctionIncludeConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IFunctionIncludeConfig>, ReturnType<R['updated']>> &
    IAdtMetadataUpdatable<
      Partial<IFunctionIncludeConfig>,
      ReturnType<R['metadataUpdated']>
    > &
    IAdtDeletable<
      IFunctionIncludeConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IFunctionIncludeConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionIncludeConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionIncludeConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionIncludeConfig> &
    IAdtVersionable<IFunctionIncludeConfig, ObjectVersion[], string>;
export type IPackageContract<R extends IPackageResults> = IAdtCreatable<
  IPackageConfig,
  ReturnType<R['created']>
> &
  IAdtMetadataReadable<IPackageConfig, ReturnType<R['metadata']>> &
  IAdtMetadataUpdatable<
    Partial<IPackageConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    IPackageConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IPackageConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IPackageConfig, ReturnType<R['check']>> &
  IAdtLockable<IPackageConfig> &
  IAdtTransportAware<IPackageConfig, ReturnType<R['transport']>>;
export type IMessageClassContract<R extends IMessageClassResults> =
  IAdtCreatable<IMessageClassConfig, ReturnType<R['created']>> &
    IAdtMetadataReadable<IMessageClassConfig, ReturnType<R['metadata']>> &
    IAdtMetadataUpdatable<
      Partial<IMessageClassConfig>,
      ReturnType<R['metadataUpdated']>
    > &
    IAdtDeletable<
      IMessageClassConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IMessageClassConfig, ReturnType<R['validation']>> &
    IAdtLockable<IMessageClassConfig>;
export type IMessageClassMessageContract<
  R extends IMessageClassMessageResults,
> = IAdtCreatable<IMessageClassMessageConfig, ReturnType<R['written']>> &
  IAdtReadable<IMessageClassMessageConfig, ReturnType<R['read']>> &
  IAdtUpdatable<Partial<IMessageClassMessageConfig>, ReturnType<R['written']>>;
export type IAccessControlContract<R extends IAccessControlResults> =
  IAdtCreatable<IAccessControlConfig, ReturnType<R['created']>> &
    IAdtReadable<IAccessControlConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IAccessControlConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IAccessControlConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IAccessControlConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IAccessControlConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IAccessControlConfig, ReturnType<R['check']>> &
    IAdtActivatable<IAccessControlConfig, ReturnType<R['activation']>> &
    IAdtLockable<IAccessControlConfig> &
    IAdtTransportAware<IAccessControlConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IAccessControlConfig, ObjectVersion[], string>;
export type ITransformationContract<R extends ITransformationResults> =
  IAdtCreatable<ITransformationConfig, ReturnType<R['created']>> &
    IAdtReadable<ITransformationConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<ITransformationConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<ITransformationConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      ITransformationConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<ITransformationConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ITransformationConfig, ReturnType<R['check']>> &
    IAdtActivatable<ITransformationConfig, ReturnType<R['activation']>> &
    IAdtLockable<ITransformationConfig> &
    IAdtTransportAware<ITransformationConfig, ReturnType<R['transport']>> &
    IAdtVersionable<ITransformationConfig, ObjectVersion[], string>;
export type IServiceDefinitionContract<R extends IServiceDefinitionResults> =
  IAdtCreatable<IServiceDefinitionConfig, ReturnType<R['created']>> &
    IAdtReadable<IServiceDefinitionConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IServiceDefinitionConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IServiceDefinitionConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IServiceDefinitionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IServiceDefinitionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IServiceDefinitionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IServiceDefinitionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IServiceDefinitionConfig> &
    IAdtTransportAware<IServiceDefinitionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IServiceDefinitionConfig, ObjectVersion[], string>;
export type IScalarFunctionContract<R extends IScalarFunctionResults> =
  IAdtCreatable<IScalarFunctionConfig, ReturnType<R['created']>> &
    IAdtReadable<IScalarFunctionConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IScalarFunctionConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IScalarFunctionConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IScalarFunctionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IScalarFunctionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IScalarFunctionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IScalarFunctionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IScalarFunctionConfig> &
    IAdtTransportAware<IScalarFunctionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IScalarFunctionConfig, ObjectVersion[], string>;
export type IScalarFunctionImplementationContract<
  R extends IScalarFunctionImplementationResults,
> = IAdtCreatable<
  IScalarFunctionImplementationConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IScalarFunctionImplementationConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<
    IScalarFunctionImplementationConfig,
    ReturnType<R['metadata']>
  > &
  IAdtUpdatable<
    Partial<IScalarFunctionImplementationConfig>,
    ReturnType<R['updated']>
  > &
  IAdtMetadataUpdatable<
    Partial<IScalarFunctionImplementationConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    IScalarFunctionImplementationConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<
    IScalarFunctionImplementationConfig,
    ReturnType<R['validation']>
  > &
  IAdtCheckable<IScalarFunctionImplementationConfig, ReturnType<R['check']>> &
  IAdtActivatable<
    IScalarFunctionImplementationConfig,
    ReturnType<R['activation']>
  > &
  IAdtLockable<IScalarFunctionImplementationConfig> &
  IAdtTransportAware<
    IScalarFunctionImplementationConfig,
    ReturnType<R['transport']>
  > &
  IAdtVersionable<IScalarFunctionImplementationConfig, ObjectVersion[], string>;
export type IAppendStructureContract<R extends IAppendStructureResults> =
  IAdtCreatable<IAppendStructureConfig, ReturnType<R['created']>> &
    IAdtReadable<IAppendStructureConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IAppendStructureConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IAppendStructureConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IAppendStructureConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IAppendStructureConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IAppendStructureConfig, ReturnType<R['check']>> &
    IAdtActivatable<IAppendStructureConfig, ReturnType<R['activation']>> &
    IAdtLockable<IAppendStructureConfig> &
    IAdtTransportAware<IAppendStructureConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IAppendStructureConfig, ObjectVersion[], string>;
export type IBehaviorDefinitionContract<R extends IBehaviorDefinitionResults> =
  IAdtCreatable<IBehaviorDefinitionConfig, ReturnType<R['created']>> &
    IAdtReadable<IBehaviorDefinitionConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IBehaviorDefinitionConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<
      Partial<IBehaviorDefinitionConfig>,
      ReturnType<R['updated']>
    > &
    IAdtDeletable<
      IBehaviorDefinitionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IBehaviorDefinitionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IBehaviorDefinitionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IBehaviorDefinitionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IBehaviorDefinitionConfig> &
    IAdtTransportAware<IBehaviorDefinitionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IBehaviorDefinitionConfig, ObjectVersion[], string>;
export type IBehaviorImplementationContract<R extends IClassResults> =
  IAdtCreatable<IBehaviorImplementationConfig, ReturnType<R['created']>> &
    IAdtReadable<IBehaviorImplementationConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<
      IBehaviorImplementationConfig,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<
      Partial<IBehaviorImplementationConfig>,
      ReturnType<R['updated']>
    > &
    IAdtDeletable<
      IBehaviorImplementationConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<
      IBehaviorImplementationConfig,
      ReturnType<R['validation']>
    > &
    IAdtCheckable<IBehaviorImplementationConfig, ReturnType<R['check']>> &
    IAdtActivatable<
      IBehaviorImplementationConfig,
      ReturnType<R['activation']>
    > &
    IAdtLockable<IBehaviorImplementationConfig> &
    IAdtTransportAware<IBehaviorImplementationConfig, string> &
    IAdtVersionable<IBehaviorImplementationConfig, ObjectVersion[], string>;
export type IMetadataExtensionContract<R extends IMetadataExtensionResults> =
  IAdtCreatable<IMetadataExtensionConfig, ReturnType<R['created']>> &
    IAdtReadable<IMetadataExtensionConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IMetadataExtensionConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IMetadataExtensionConfig>, ReturnType<R['updated']>> &
    IAdtDeletable<
      IMetadataExtensionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IMetadataExtensionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IMetadataExtensionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IMetadataExtensionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IMetadataExtensionConfig> &
    IAdtTransportAware<IMetadataExtensionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IMetadataExtensionConfig, ObjectVersion[], string>;
export type IEnhancementContract<R extends IEnhancementResults> = IAdtCreatable<
  IEnhancementConfig,
  ReturnType<R['created']>
> &
  IAdtReadable<IEnhancementConfig, ReturnType<R['source']>> &
  IAdtMetadataReadable<IEnhancementConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<IEnhancementConfig>, ReturnType<R['updated']>> &
  IAdtDeletable<
    IEnhancementConfig,
    ReturnType<R['deletion']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtValidatable<IEnhancementConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IEnhancementConfig, ReturnType<R['check']>> &
  IAdtActivatable<IEnhancementConfig, ReturnType<R['activation']>> &
  IAdtLockable<IEnhancementConfig> &
  IAdtTransportAware<IEnhancementConfig, ReturnType<R['transport']>> &
  IAdtVersionable<IEnhancementConfig, ObjectVersion[], string>;
export type IRequestContract<R extends ITransportResults> = IAdtCreatable<
  ITransportConfig,
  ReturnType<R['created']>
> &
  IAdtMetadataReadable<ITransportConfig, ReturnType<R['metadata']>> &
  IAdtMetadataUpdatable<
    Partial<ITransportConfig>,
    ReturnType<R['metadataUpdated']>
  > &
  IAdtDeletable<
    ITransportConfig,
    ReturnType<R['deleted']>,
    ReturnType<R['deletionCheck']>
  > &
  IAdtRequest<ReturnType<R['list']>>;
export type ILocalTestClassContract<R extends IClassResults> = IAdtReadable<
  ILocalTestClassConfig,
  ReturnType<R['source']>
> &
  IAdtMetadataReadable<ILocalTestClassConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<ILocalTestClassConfig>, ReturnType<R['updated']>> &
  IAdtValidatable<ILocalTestClassConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ILocalTestClassConfig, ReturnType<R['check']>> &
  IAdtActivatable<ILocalTestClassConfig, ReturnType<R['activation']>> &
  IAdtLockable<ILocalTestClassConfig> &
  IAdtVersionable<ILocalTestClassConfig, ObjectVersion[], string> &
  IAdtTransportAware<ILocalTestClassConfig, string>;
export type ILocalTypesContract<R extends IClassResults> = IAdtReadable<
  ILocalTypesConfig,
  ReturnType<R['source']>
> &
  IAdtMetadataReadable<ILocalTypesConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<ILocalTypesConfig>, ReturnType<R['updated']>> &
  IAdtValidatable<ILocalTypesConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ILocalTypesConfig, ReturnType<R['check']>> &
  IAdtActivatable<ILocalTypesConfig, ReturnType<R['activation']>> &
  IAdtLockable<ILocalTypesConfig> &
  IAdtVersionable<ILocalTypesConfig, ObjectVersion[], string> &
  IAdtTransportAware<ILocalTypesConfig, string>;
export type ILocalDefinitionsContract<R extends IClassResults> = IAdtReadable<
  ILocalDefinitionsConfig,
  ReturnType<R['source']>
> &
  IAdtMetadataReadable<ILocalDefinitionsConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<ILocalDefinitionsConfig>, ReturnType<R['updated']>> &
  IAdtValidatable<ILocalDefinitionsConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ILocalDefinitionsConfig, ReturnType<R['check']>> &
  IAdtActivatable<ILocalDefinitionsConfig, ReturnType<R['activation']>> &
  IAdtLockable<ILocalDefinitionsConfig> &
  IAdtVersionable<ILocalDefinitionsConfig, ObjectVersion[], string> &
  IAdtTransportAware<ILocalDefinitionsConfig, string>;
export type ILocalMacrosContract<R extends IClassResults> = IAdtReadable<
  ILocalMacrosConfig,
  ReturnType<R['source']>
> &
  IAdtMetadataReadable<ILocalMacrosConfig, ReturnType<R['metadata']>> &
  IAdtUpdatable<Partial<ILocalMacrosConfig>, ReturnType<R['updated']>> &
  IAdtValidatable<ILocalMacrosConfig, ReturnType<R['validation']>> &
  IAdtCheckable<ILocalMacrosConfig, ReturnType<R['check']>> &
  IAdtActivatable<ILocalMacrosConfig, ReturnType<R['activation']>> &
  IAdtLockable<ILocalMacrosConfig> &
  IAdtVersionable<ILocalMacrosConfig, ObjectVersion[], string> &
  IAdtTransportAware<ILocalMacrosConfig, string>;

export class AdtClient {
  protected connection: IAbapConnection;
  protected logger: ILogger;
  protected systemContext: IAdtSystemContext;
  protected contentTypes?: IAdtContentTypes;
  /**
   * Session-scoped registry of locks held by handlers created from this client.
   * All handlers share one stateful session, so all their locks belong here.
   */
  protected readonly lockRegistry: LockRegistry;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtClientOptions,
  ) {
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
    // Pass the connection so unlockAll() can keep the whole batch stateful.
    this.lockRegistry = new LockRegistry(connection);
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.systemContext = {
      masterSystem: options?.masterSystem,
      responsible: options?.responsible,
      masterLanguage: options?.masterLanguage,
    };
    this.contentTypes = options?.contentTypes;
    if (options?.enableAcceptCorrection !== undefined) {
      const {
        setAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
        getAcceptCorrectionEnabled,
      } = require('../utils/acceptNegotiation');
      setAcceptCorrectionEnabled(options.enableAcceptCorrection);
      const shouldWrap =
        options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
      if (shouldWrap) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    } else {
      const {
        getAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
      } = require('../utils/acceptNegotiation');
      if (getAcceptCorrectionEnabled()) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    }
  }

  /**
   * Refuses to hand out a handler over a connection nobody connected.
   *
   * Connecting is the CONSUMER's job and stays that way — this library does not
   * own the connection and must not connect on anyone's behalf. What it can do
   * is catch the case where a connector was injected and `connect()` was never
   * called, which otherwise surfaces deep in an operation chain: the handlers
   * collect failures into `state.errors` rather than stopping, so a missing
   * connection arrives as a state object full of `ADT_NOT_CONNECTED` after the
   * chain has walked its whole length. Failing here turns that into nothing
   * having happened at all.
   *
   * Only asked of a connection that ANSWERS the question. `isConnected()` lives
   * on `ISessionLifecycleAware`, not on `IAbapConnection`: an RFC connection has
   * no HTTP session and no such method, and a transport that cannot answer must
   * not be blocked on its silence. This is a real limit, not an oversight — a
   * transport with no session has no "not connected" state to catch, so the
   * promise this guard makes is necessarily narrower than "every
   * `IAbapConnection`".
   *
   * It checks ONLY `isConnected`, which is the only method it calls. That is a
   * different rule from the one for a type predicate, and the difference is
   * worth stating because the two look alike: a predicate narrows to the WHOLE
   * interface, so it must verify the whole interface or its caller will invoke a
   * method that is not there. This asks one question and calls one method, so
   * demanding the other two would only make it step aside for a connection that
   * could have answered — refusing evidence it was offered.
   */
  private assertConnected(): void {
    const candidate = this.connection as Partial<ISessionLifecycleAware>;
    if (typeof candidate.isConnected !== 'function') return;

    if (!candidate.isConnected()) {
      const error = new Error(
        'AdtClient: the connection is not connected. Call connect() on it before ' +
          'requesting a handler — this library does not connect on your behalf.',
      ) as Error & { code: string };
      error.code = ADT_SESSION_ERROR.NOT_CONNECTED;
      throw error;
    }
  }

  /**
   * A class implementation, answering documents.
   *
   * The result strategy is chosen here rather than per call because a consumer
   * that wants a particular shape wants it for every member it touches, and
   * none of them changes its mind between `create` and `read` of the same
   * object. The return type is this package's — which is why
   * `@mcp-abap-adt/interfaces` needs no parser parameter to make this possible.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getClass(): IClassContract<typeof classDocuments>;
  getClass<R extends IClassResults>(results: R): IClassContract<R>;
  // The implementation is generic too. Erasing R here would build the object at
  // `unknown` while the overload promised `ReturnType<R['source']>` — the
  // factory telling the truth in its signature and lying in its body.
  getClass<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtClass<R> {
    this.assertConnected();
    return new AdtClass<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getProgram(): IProgramContract<typeof programDocuments>;
  getProgram<R extends IProgramResults>(results: R): IProgramContract<R>;
  getProgram<R extends IProgramResults = typeof programDocuments>(
    results: R = programDocuments as unknown as R,
  ): AdtProgram<R> {
    this.assertConnected();
    return new AdtProgram<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Standalone `PROG/I` includes.
   *
   * A different resource from a program and from a function-group include —
   * see `src/core/include/index.ts` for the three-way comparison. The return
   * type names only the capabilities an include has: nothing measured says it
   * is versionable, so it does not claim to be.
   *
   * Creatable on modern on-prem only, where discovery gives the includes
   * collection an `app:accept`.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getInclude(): IIncludeContract<typeof includeDocuments>;
  getInclude<R extends IIncludeResults>(results: R): IIncludeContract<R>;
  getInclude<R extends IIncludeResults = typeof includeDocuments>(
    results: R = includeDocuments as unknown as R,
  ): AdtInclude<R> {
    this.assertConnected();
    return new AdtInclude<R>(
      this.connection,
      this.logger,
      this.contentTypes,
      results,
    );
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getInterface(): IInterfaceContract<typeof interfaceDocuments>;
  getInterface<R extends IInterfaceResults>(results: R): IInterfaceContract<R>;
  getInterface<R extends IInterfaceResults = typeof interfaceDocuments>(
    results: R = interfaceDocuments as unknown as R,
  ): AdtInterface<R> {
    this.assertConnected();
    return new AdtInterface<R>(
      this.connection,
      this.logger,
      this.systemContext,
      undefined,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getDomain(): IDomainContract<typeof domainDocuments>;
  getDomain<R extends IDomainResults>(results: R): IDomainContract<R>;
  getDomain<R extends IDomainResults = typeof domainDocuments>(
    results: R = domainDocuments as unknown as R,
  ): AdtDomain<R> {
    this.assertConnected();
    return new AdtDomain<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Last-resort cleanup: release every lock still held by handlers created from
   * this client. Returns the locks that could not be released.
   *
   * This is a safety net for abandoned locks (a forgot-to-unlock, or a managed
   * flow that threw before its unlock). Preventing a timeout from interrupting a
   * lock→unlock critical section remains the caller's responsibility.
   */
  async unlockAll(): Promise<LockFailure[]> {
    return this.lockRegistry.unlockAll();
  }

  /**
   * Keys of locks currently held by handlers created from this client
   * (e.g. `Domain/ZFOO`, `DataElement/ZBAR`). Lets a consumer inspect whether a
   * session was left with dangling locks before deciding to `unlockAll()`.
   */
  get pendingLocks(): string[] {
    return this.lockRegistry.pending;
  }

  /**
   * Release all held locks when used with `await using`.
   *
   * Best-effort: like {@link unlockAll}, this never throws — a lock whose unlock
   * fails is retained rather than surfaced as an error, so a disposer failure
   * cannot mask the error that ended the `using` scope. Any residual failures
   * are logged as a warning and remain observable via {@link pendingLocks}.
   * Callers that must react to unlock failures should call `unlockAll()`
   * explicitly and inspect the returned `LockFailure[]`.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    const failures = await this.unlockAll();
    if (failures.length > 0) {
      this.logger.warn(
        `[AdtClient] dispose left ${failures.length} lock(s) unreleased: ${failures
          .map((f) => f.key)
          .join(
            ', ',
          )}. They remain in pendingLocks; retry unlockAll() or rely on session-drop.`,
      );
    }
  }

  /**
   * Get high-level operations for DataElement objects
   * @returns IAdtObject instance for DataElement operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getDataElement(): IDataElementContract<typeof dataElementDocuments>;
  getDataElement<R extends IDataElementResults>(
    results: R,
  ): IDataElementContract<R>;
  getDataElement<R extends IDataElementResults = typeof dataElementDocuments>(
    results: R = dataElementDocuments as unknown as R,
  ): AdtDataElement<R> {
    this.assertConnected();
    return new AdtDataElement<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for AuthorizationField objects
   * @returns IAdtObject instance for AuthorizationField operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getAuthorizationField(): IAuthorizationFieldContract<
    typeof authorizationFieldDocuments
  >;
  getAuthorizationField<R extends IAuthorizationFieldResults>(
    results: R,
  ): IAuthorizationFieldContract<R>;
  getAuthorizationField<
    R extends IAuthorizationFieldResults = typeof authorizationFieldDocuments,
  >(
    results: R = authorizationFieldDocuments as unknown as R,
  ): AdtAuthorizationField<R> {
    this.assertConnected();
    return new AdtAuthorizationField<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getStructure(): IStructureContract<typeof structureDocuments>;
  getStructure<R extends IStructureResults>(results: R): IStructureContract<R>;
  getStructure<R extends IStructureResults = typeof structureDocuments>(
    results: R = structureDocuments as unknown as R,
  ): AdtStructure<R> {
    this.assertConnected();
    return new AdtStructure<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getTable(): ITableContract<typeof tableDocuments>;
  getTable<R extends ITableResults>(results: R): ITableContract<R>;
  getTable<R extends ITableResults = typeof tableDocuments>(
    results: R = tableDocuments as unknown as R,
  ): AdtTable<R> {
    this.assertConnected();
    return new AdtTable<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for TableType (DDIC Table Type) objects
   * @returns IAdtObject instance for TableType operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getTableType(): ITableTypeContract<typeof tableTypeDocuments>;
  getTableType<R extends ITableTypeResults>(results: R): ITableTypeContract<R>;
  getTableType<R extends ITableTypeResults = typeof tableTypeDocuments>(
    results: R = tableTypeDocuments as unknown as R,
  ): AdtDdicTableType<R> {
    this.assertConnected();
    return new AdtDdicTableType<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
   * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
   * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
   * (`/ddic/dsfd/sources/`) have their own clients.
   * @returns IAdtObject instance for DDL source operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getDdl(): IDdlContract<typeof ddlDocuments>;
  getDdl<R extends IDdlResults>(results: R): IDdlContract<R>;
  getDdl<R extends IDdlResults = typeof ddlDocuments>(
    results: R = ddlDocuments as unknown as R,
  ): AdtDdl<R> {
    this.assertConnected();
    return new AdtDdl<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getFunctionGroup(): IFunctionGroupContract<typeof functionGroupDocuments>;
  getFunctionGroup<R extends IFunctionGroupResults>(
    results: R,
  ): IFunctionGroupContract<R>;
  getFunctionGroup<
    R extends IFunctionGroupResults = typeof functionGroupDocuments,
  >(results: R = functionGroupDocuments as unknown as R): AdtFunctionGroup<R> {
    this.assertConnected();
    return new AdtFunctionGroup<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getFunctionModule(): IFunctionModuleContract<typeof functionModuleDocuments>;
  getFunctionModule<R extends IFunctionModuleResults>(
    results: R,
  ): IFunctionModuleContract<R>;
  getFunctionModule<
    R extends IFunctionModuleResults = typeof functionModuleDocuments,
  >(
    results: R = functionModuleDocuments as unknown as R,
  ): AdtFunctionModule<R> {
    this.assertConnected();
    return new AdtFunctionModule<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionInclude objects
   * @returns IAdtObject instance for FunctionInclude operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getFunctionInclude(): IFunctionIncludeContract<
    typeof functionIncludeDocuments
  >;
  getFunctionInclude<R extends IFunctionIncludeResults>(
    results: R,
  ): IFunctionIncludeContract<R>;
  getFunctionInclude<
    R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
  >(
    results: R = functionIncludeDocuments as unknown as R,
  ): AdtFunctionInclude<R> {
    this.assertConnected();
    return new AdtFunctionInclude<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getPackage(): IPackageContract<typeof packageDocuments>;
  getPackage<R extends IPackageResults>(results: R): IPackageContract<R>;
  getPackage<R extends IPackageResults = typeof packageDocuments>(
    results: R = packageDocuments as unknown as R,
  ): AdtPackage<R> {
    this.assertConnected();
    return new AdtPackage<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for MessageClass (MSAG/N) objects
   * @returns IAdtObject instance for MessageClass operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getMessageClass(): IMessageClassContract<typeof messageClassDocuments>;
  getMessageClass<R extends IMessageClassResults>(
    results: R,
  ): IMessageClassContract<R>;
  getMessageClass<
    R extends IMessageClassResults = typeof messageClassDocuments,
  >(results: R = messageClassDocuments as unknown as R): AdtMessageClass<R> {
    this.assertConnected();
    return new AdtMessageClass<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a single message within a MessageClass.
   *
   * A message class (MSAG) is not an ABAP class, whatever the name suggests,
   * and a message inside one is an entity that is genuinely created: it does
   * not exist until someone adds it. So this keeps `create` — unlike a class's
   * includes, which exist because their class does.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getMessageClassMessage(): IMessageClassMessageContract<
    typeof messageDocuments
  >;
  getMessageClassMessage<R extends IMessageClassMessageResults>(
    results: R,
  ): IMessageClassMessageContract<R>;
  getMessageClassMessage<
    R extends IMessageClassMessageResults = typeof messageDocuments,
  >(results: R = messageDocuments as unknown as R): AdtMessageClassMessage<R> {
    this.assertConnected();
    return new AdtMessageClassMessage<R>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for AccessControl objects
   * @returns IAdtObject instance for AccessControl operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getAccessControl(): IAccessControlContract<typeof accessControlDocuments>;
  getAccessControl<R extends IAccessControlResults>(
    results: R,
  ): IAccessControlContract<R>;
  getAccessControl<
    R extends IAccessControlResults = typeof accessControlDocuments,
  >(results: R = accessControlDocuments as unknown as R): AdtAccessControl<R> {
    this.assertConnected();
    return new AdtAccessControl<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Transformation objects (XSLT)
   * Supports both SimpleTransformation and XSLTProgram types
   * @returns IAdtObject instance for Transformation operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getTransformation(): ITransformationContract<typeof transformationDocuments>;
  getTransformation<R extends ITransformationResults>(
    results: R,
  ): ITransformationContract<R>;
  getTransformation<
    R extends ITransformationResults = typeof transformationDocuments,
  >(
    results: R = transformationDocuments as unknown as R,
  ): AdtTransformation<R> {
    this.assertConnected();
    return new AdtTransformation<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getServiceDefinition(): IServiceDefinitionContract<
    typeof serviceDefinitionDocuments
  >;
  getServiceDefinition<R extends IServiceDefinitionResults>(
    results: R,
  ): IServiceDefinitionContract<R>;
  getServiceDefinition<
    R extends IServiceDefinitionResults = typeof serviceDefinitionDocuments,
  >(
    results: R = serviceDefinitionDocuments as unknown as R,
  ): AdtServiceDefinition<R> {
    this.assertConnected();
    return new AdtServiceDefinition<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getScalarFunction(): IScalarFunctionContract<typeof scalarFunctionDocuments>;
  getScalarFunction<R extends IScalarFunctionResults>(
    results: R,
  ): IScalarFunctionContract<R>;
  getScalarFunction<
    R extends IScalarFunctionResults = typeof scalarFunctionDocuments,
  >(
    results: R = scalarFunctionDocuments as unknown as R,
  ): AdtScalarFunction<R> {
    this.assertConnected();
    return new AdtScalarFunction<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getScalarFunctionImplementation(): IScalarFunctionImplementationContract<
    typeof scalarFunctionImplementationDocuments
  >;
  getScalarFunctionImplementation<
    R extends IScalarFunctionImplementationResults,
  >(results: R): IScalarFunctionImplementationContract<R>;
  getScalarFunctionImplementation<
    R extends
      IScalarFunctionImplementationResults = typeof scalarFunctionImplementationDocuments,
  >(
    results: R = scalarFunctionImplementationDocuments as unknown as R,
  ): AdtScalarFunctionImplementation<R> {
    this.assertConnected();
    return new AdtScalarFunctionImplementation<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Append Structure (TABL/DS) objects
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getAppendStructure(): IAppendStructureContract<
    typeof appendStructureDocuments
  >;
  getAppendStructure<R extends IAppendStructureResults>(
    results: R,
  ): IAppendStructureContract<R>;
  getAppendStructure<
    R extends IAppendStructureResults = typeof appendStructureDocuments,
  >(
    results: R = appendStructureDocuments as unknown as R,
  ): AdtAppendStructure<R> {
    this.assertConnected();
    return new AdtAppendStructure<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for ServiceBinding objects
   * @returns a ServiceBinding handler — CRUD and lifecycle, as the atoms
   */
  getServiceBinding(): AdtServiceBinding;
  getServiceBinding<R extends IServiceResults>(
    results: R,
  ): AdtServiceBinding<R>;
  getServiceBinding<R extends IServiceResults = typeof serviceDocuments>(
    results: R = serviceDocuments as unknown as R,
  ): AdtServiceBinding<R> {
    this.assertConnected();
    return new AdtServiceBinding<R>(
      this.connection,
      this.logger,
      this.systemContext,
      results,
    );
  }

  /**
   * @deprecated Use getServiceBinding() instead.
   */
  getService(): AdtServiceBinding {
    return this.getServiceBinding();
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getBehaviorDefinition(): IBehaviorDefinitionContract<
    typeof behaviorDefinitionDocuments
  >;
  getBehaviorDefinition<R extends IBehaviorDefinitionResults>(
    results: R,
  ): IBehaviorDefinitionContract<R>;
  getBehaviorDefinition<
    R extends IBehaviorDefinitionResults = typeof behaviorDefinitionDocuments,
  >(
    results: R = behaviorDefinitionDocuments as unknown as R,
  ): AdtBehaviorDefinition<R> {
    this.assertConnected();
    return new AdtBehaviorDefinition<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getBehaviorImplementation(): IBehaviorImplementationContract<
    typeof classDocuments
  >;
  getBehaviorImplementation<R extends IClassResults>(
    results: R,
  ): IBehaviorImplementationContract<R>;
  getBehaviorImplementation<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtBehaviorImplementation<R> {
    this.assertConnected();
    return new AdtBehaviorImplementation<R>(
      this.connection,
      this.logger,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getMetadataExtension(): IMetadataExtensionContract<
    typeof metadataExtensionDocuments
  >;
  getMetadataExtension<R extends IMetadataExtensionResults>(
    results: R,
  ): IMetadataExtensionContract<R>;
  getMetadataExtension<
    R extends IMetadataExtensionResults = typeof metadataExtensionDocuments,
  >(
    results: R = metadataExtensionDocuments as unknown as R,
  ): AdtMetadataExtension<R> {
    this.assertConnected();
    return new AdtMetadataExtension<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Enhancement objects
   * Supports multiple enhancement types:
   * - Enhancement Implementation (ENHO)
   * - BAdI Implementation
   * - Source Code Plugin (with source code)
   * - Enhancement Spot (ENHS)
   * - BAdI Enhancement Spot
   * @returns IAdtObject instance for Enhancement operations
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getEnhancement(): IEnhancementContract<typeof enhancementDocuments>;
  getEnhancement<R extends IEnhancementResults>(
    results: R,
  ): IEnhancementContract<R>;
  getEnhancement<R extends IEnhancementResults = typeof enhancementDocuments>(
    results: R = enhancementDocuments as unknown as R,
  ): AdtEnhancement<R> {
    this.assertConnected();
    return new AdtEnhancement<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FeatureToggle objects
   * @returns IFeatureToggleObject instance for FeatureToggle operations
   */
  // **These two still answer the concrete class, and that is a finding rather
  // than an omission.** Their declared contracts are narrower than the classes
  // offer — `getPackageHierarchy`, `getPackageContentsList`, and the feature
  // toggle's own members are not in them — so composing them would take away
  // members this package's own tests and scripts call. What is incomplete is
  // the contract; widening it is issue #109's subject, not this change's.
  getFeatureToggle(): AdtFeatureToggle;
  getFeatureToggle<R extends IFeatureToggleResults>(
    results: R,
  ): IAdtCreatable<IFeatureToggleConfig, ReturnType<R['created']>> &
    IAdtReadable<IFeatureToggleConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IFeatureToggleConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IFeatureToggleConfig>, ReturnType<R['updated']>> &
    IAdtMetadataUpdatable<
      Partial<IFeatureToggleConfig>,
      ReturnType<R['metadataUpdated']>
    > &
    IAdtDeletable<
      IFeatureToggleConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    > &
    IAdtValidatable<IFeatureToggleConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFeatureToggleConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFeatureToggleConfig, ReturnType<R['activation']>> &
    // Not `IFeatureToggleObject<TState>`: that contract types all five domain
    // members with one `TState`, and they answer three different things — a
    // runtime state, a check verdict, and the toggle's source document. Naming
    // it here would be this factory promising a shape the implementation
    // cannot honour. Recorded rather than worked around; the contract's own
    // decision 24 is the rule it collides with.
    IAdtLockable<IFeatureToggleConfig>;
  getFeatureToggle<
    R extends IFeatureToggleResults = typeof featureToggleDocuments,
  >(results: R = featureToggleDocuments as unknown as R): AdtFeatureToggle<R> {
    this.assertConnected();
    return new AdtFeatureToggle<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for UnitTest objects.
   *
   * A test run is created and read, never edited: ADT exposes no update,
   * delete, activate, check, lock or version resource for one. The declared
   * type says so rather than promising thirteen methods of which nine throw.
   *
   * It also carries {@link IAdtTestRunnable} — starting a run and collecting
   * its outcome is the reason this handler exists, and until interfaces 13.1.0
   * no contract described it, so callers cast past the type to reach it.
   */
  // Concrete, like `getUtils` and `getFeatureToggle` above and for the same
  // reason: a unit test handler runs its tests and reads their results, and
  // the composition names none of that. Handing back the contract would take
  // those members away from callers who have them today.
  getUnitTest(): AdtUnitTest;
  getUnitTest<R extends IUnitTestResults>(
    results: R,
  ): IAdtCreatable<IUnitTestConfig, ReturnType<R['created']>> &
    IAdtReadable<IUnitTestConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<IUnitTestConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<IUnitTestConfig>, ReturnType<R['updated']>> &
    IAdtValidatable<IUnitTestConfig, ReturnType<R['validation']>> &
    IAdtLockable<IUnitTestConfig> &
    IAdtRunnable<
      IClassUnitTestDefinition[],
      ReturnType<R['run']>,
      IClassUnitTestRunOptions
    > &
    ITestRunInformation<ReturnType<R['status']>, ReturnType<R['result']>>;
  getUnitTest<R extends IUnitTestResults = typeof unitTestDocuments>(
    results: R = unitTestDocuments as unknown as R,
  ): AdtUnitTest<R> {
    this.assertConnected();
    return new AdtUnitTest<R>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for CDS UnitTest objects.
   *
   * Same capability set as {@link getUnitTest}; the CDS-specific surface
   * (`checkCdsTestDoubles`, `getCdsViewName`) is on the concrete class.
   */
  // Concrete, like `getUtils` and `getFeatureToggle` above and for the same
  // reason: a unit test handler runs its tests and reads their results, and
  // the composition names none of that. Handing back the contract would take
  // those members away from callers who have them today.
  getCdsUnitTest(): AdtCdsUnitTest;
  getCdsUnitTest<R extends IUnitTestResults>(
    results: R,
  ): IAdtCreatable<ICdsUnitTestConfig, ReturnType<R['created']>> &
    IAdtReadable<ICdsUnitTestConfig, ReturnType<R['source']>> &
    IAdtMetadataReadable<ICdsUnitTestConfig, ReturnType<R['metadata']>> &
    IAdtUpdatable<Partial<ICdsUnitTestConfig>, ReturnType<R['updated']>> &
    IAdtValidatable<ICdsUnitTestConfig, ReturnType<R['validation']>> &
    IAdtLockable<ICdsUnitTestConfig> &
    IAdtRunnable<
      IClassUnitTestDefinition[] | string,
      ReturnType<R['run']>,
      IClassUnitTestRunOptions
    > &
    ITestRunInformation<ReturnType<R['status']>, ReturnType<R['result']>> &
    ICdsTestDoubleCheckable<ReturnType<R['cdsCheck']>>;
  getCdsUnitTest<R extends IUnitTestResults = typeof unitTestDocuments>(
    results: R = unitTestDocuments as unknown as R,
  ): AdtCdsUnitTest<R> {
    this.assertConnected();
    return new AdtCdsUnitTest<R>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for Request (Transport Request) objects.
   *
   * Declared as `IAdtRequest`, not as the class, so the compiler checks the
   * handler here. `AdtRequest` has to satisfy the contract at this line: remove
   * a method from it and the build fails *here*, rather than only where
   * something happens to call it — and a method with no internal caller could
   * otherwise vanish while every consumer lost it.
   *
   * A consumer can also substitute their own handler and compose the contract
   * with their own types, neither of which is possible against a class.
   *
   * Not because the capability guard could not see the concrete return: it
   * could. Its check is structural and fails identically either way — see
   * decision 10 in `docs/architecture/DECISIONS.md`, which keeps that wrong
   * reason beside the right one.
   *
   * @returns the transport request contract
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getRequest(): IRequestContract<typeof transportDocuments>;
  getRequest<R extends ITransportResults>(results: R): IRequestContract<R>;
  getRequest<R extends ITransportResults = typeof transportDocuments>(
    results: R = transportDocuments as unknown as R,
  ): AdtRequest<R> {
    this.assertConnected();
    return new AdtRequest<R>(
      this.connection,
      this.logger,
      this.systemContext,
      results,
    );
  }

  /**
   * Get utility functions (NOT CRUD operations)
   * Provides access to cross-cutting ADT utility functions:
   * - Search operations
   * - Where-used analysis
   * - Inactive objects management
   * - Group activation/deletion
   * - Object metadata and source code reading
   * - SQL queries and table contents
   *
   * Returns the seven atoms, spelled as an intersection rather than named —
   * there is no composite for "all of them", because a composite would be a
   * capability claim nobody makes: a consumer takes the family they need.
   *
   * A contract and not `AdtUtils`, for the reason decision 10 gives: a class as a
   * return type satisfies itself by definition, so the factory compiles whatever
   * the class happens to be that day. This makes the compiler check the handler
   * where it is handed out — and it caught two members returning the envelope
   * while the contract promised a parsed result.
   *
   * Narrower than the class on purpose — and the gap is wider than this comment
   * used to admit. `searchObjects`, `getWhereUsed` and `getPackageContents` are
   * not here because each issues the same request as a sibling that has a
   * contract, and one endpoint is one member (decision 16 in
   * `@mcp-abap-adt/interfaces`).
   *
   * The sentence that stood here — "a caller who needs the raw document passes a
   * parser to the sibling" — described an API that no longer exists: the parser
   * overloads went in 30.0.0, when the reading became something injected once
   * rather than passed per call. There is no way to ask these members for
   * another shape today, and saying otherwise was worse than saying nothing.
   *
   * @returns The cross-cutting operations, as contracts
   */
  // **These two still answer the concrete class, and that is a finding rather
  // than an omission.** Their declared contracts are narrower than the classes
  // offer — `getPackageHierarchy`, `getPackageContentsList`, and the feature
  // toggle's own members are not in them — so composing them would take away
  // members this package's own tests and scripts call. What is incomplete is
  // the contract; widening it is issue #109's subject, not this change's.
  getUtils(): AdtUtils;
  getUtils<R extends IUtilResults>(
    results: R,
  ): IAdtInformationSystem<
    ReturnType<R['search']>,
    IWhereUsedListResult,
    ReturnType<R['types']>
  > &
    IAdtRepositoryStructure<ReturnType<R['node']>> &
    IAdtGroupLifecycle<ReturnType<R['inactive']>> &
    IAdtDataPreview &
    IAdtDiscovery &
    IAdtObjectAccess;
  getUtils<R extends IUtilResults = typeof utilDocuments>(
    results: R = utilDocuments as unknown as R,
  ): AdtUtils<R> {
    this.assertConnected();
    return new AdtUtils<R>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for a class's `testclasses` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getLocalTestClass(): ILocalTestClassContract<typeof classDocuments>;
  getLocalTestClass<R extends IClassResults>(
    results: R,
  ): ILocalTestClassContract<R>;
  getLocalTestClass<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalTestClass<R> {
    this.assertConnected();
    return new AdtLocalTestClass<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `localtypes` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getLocalTypes(): ILocalTypesContract<typeof classDocuments>;
  getLocalTypes<R extends IClassResults>(results: R): ILocalTypesContract<R>;
  getLocalTypes<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalTypes<R> {
    this.assertConnected();
    return new AdtLocalTypes<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `definitions` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getLocalDefinitions(): ILocalDefinitionsContract<typeof classDocuments>;
  getLocalDefinitions<R extends IClassResults>(
    results: R,
  ): ILocalDefinitionsContract<R>;
  getLocalDefinitions<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalDefinitions<R> {
    this.assertConnected();
    return new AdtLocalDefinitions<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `macros` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  // The no-argument overload answers the same composition the other one does,
  // not the concrete class. A consumer holding `AdtXxx` gets its members'
  // looser signatures — `activate<E>(config)` with no strategy compiles there
  // and promises a failure nothing will produce — and the contract closed that
  // in 32.0.0 with two call signatures per member. This is where a consumer
  // arrives, so this is where the contract has to be. Written from the other
  // overload rather than by hand: the first hand-written one dropped an atom,
  // and `capabilities/shape.ts` caught it.
  getLocalMacros(): ILocalMacrosContract<typeof classDocuments>;
  getLocalMacros<R extends IClassResults>(results: R): ILocalMacrosContract<R>;
  getLocalMacros<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalMacros<R> {
    this.assertConnected();
    return new AdtLocalMacros<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }
}
