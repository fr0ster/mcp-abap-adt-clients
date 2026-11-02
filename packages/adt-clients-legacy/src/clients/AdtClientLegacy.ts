/**
 * AdtClientLegacy - ADT Client for older SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04), over RFC
 *
 * Supported and measured over RFC only (SAP_BASIS 7.40 SP04); the library does
 * not detect or branch on the wire, and HTTP to a legacy system is unsupported.
 *
 * Extends AdtClient and overrides methods that differ on legacy systems:
 * - Object types absent on legacy answer a refusal from every member, without a request
 * - The class, program, interface, function group, function module and DDL
 *   source delete with a direct DELETE under the object's lock handle (the
 *   caller's, from lock()) instead of /deletion/delete; every checkDeletion,
 *   and the deletes that need /sap/bc/adt/deletion/* (include, function
 *   include, message class, group delete), are refused without a request
 * - Content-Type defaults to v1 (AdtContentTypesBase)
 * - Transport requests use /sap/bc/cts/ instead of /sap/bc/adt/cts/
 *
 * Use createAdtClient() factory to auto-detect and instantiate.
 *
 * Unsupported types are determined by /sap/bc/adt/discovery catalog —
 * endpoints not present in legacy system discovery are blocked here.
 */

import {
  ACCESS_CONTROL,
  type AccessControlValues,
  AdtAccessControl,
  AdtAppendStructure,
  AdtAuthorizationField,
  AdtBehaviorDefinition,
  AdtBehaviorImplementation,
  AdtClient,
  AdtContentTypesBase,
  AdtDataElement,
  AdtDdicTableType,
  AdtDomain,
  AdtEnhancement,
  AdtFeatureToggle,
  AdtMetadataExtension,
  AdtScalarFunction,
  AdtScalarFunctionImplementation,
  type AdtServedBy,
  AdtServiceBinding,
  AdtServiceDefinition,
  AdtStructure,
  AdtTable,
  AdtTransformation,
  type AppendStructureValues,
  AUTHORIZATION_FIELD,
  type AuthorizationFieldValues,
  type accessControlDocuments,
  type appendStructureDocuments,
  type authorizationFieldDocuments,
  BEHAVIOR_DEFINITION,
  type BehaviorDefinitionValues,
  type behaviorDefinitionDocuments,
  type ClassValues,
  classDocuments,
  DATA_ELEMENT,
  type DataElementValues,
  type DdlValues,
  DOMAIN,
  type DomainValues,
  type dataElementDocuments,
  ddlDocuments,
  type domainDocuments,
  ENHANCEMENT,
  type EnhancementValues,
  type enhancementDocuments,
  FEATURE_TOGGLE,
  type FeatureToggleValues,
  type FunctionGroupValues,
  type FunctionIncludeValues,
  type FunctionModuleValues,
  type featureToggleDocuments,
  functionGroupDocuments,
  functionIncludeDocuments,
  functionModuleDocuments,
  type IncludeValues,
  type InterfaceValues,
  includeDocuments,
  interfaceDocuments,
  METADATA_EXTENSION,
  type MessageClassValues,
  type MetadataExtensionValues,
  messageClassDocuments,
  type metadataExtensionDocuments,
  type PackageValues,
  type ProgramValues,
  packageDocuments,
  programDocuments,
  type ResultValuesOf,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  type ScalarFunctionImplementationValues,
  type ScalarFunctionValues,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  type ServiceDefinitionValues,
  type ServiceValues,
  STRUCTURE,
  type StructureValues,
  type scalarFunctionDocuments,
  type scalarFunctionImplementationDocuments,
  type serviceDefinitionDocuments,
  type serviceDocuments,
  type structureDocuments,
  TABLE,
  TABLE_TYPE,
  type TableTypeValues,
  type TableValues,
  TRANSFORMATION,
  type TransformationValues,
  type TransportValues,
  type tableDocuments,
  type tableTypeDocuments,
  type transformationDocuments,
  transportDocuments,
  type UtilValues,
  utilDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAccessControlResults,
  IAdtClientOptions,
  IAppendStructureResults,
  IAuthorizationFieldResults,
  IBehaviorDefinitionResults,
  IClassResults,
  IDataElementResults,
  IDdlResults,
  IDomainResults,
  IEnhancementResults,
  IFeatureToggleResults,
  IFunctionGroupResults,
  IFunctionIncludeResults,
  IFunctionModuleResults,
  IIncludeResults,
  IInterfaceResults,
  IMessageClassResults,
  IMetadataExtensionResults,
  IPackageResults,
  IProgramResults,
  IScalarFunctionImplementationResults,
  IScalarFunctionResults,
  IServiceDefinitionResults,
  IServiceResults,
  IStructureResults,
  ITableResults,
  ITableTypeResults,
  ITransformationResults,
  ITransportResults,
  IUtilResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClassLegacy } from '../core/class/AdtClassLegacy';
import { AdtLocalDefinitionsLegacy } from '../core/class/AdtLocalDefinitionsLegacy';
import { AdtLocalMacrosLegacy } from '../core/class/AdtLocalMacrosLegacy';
import { AdtLocalTestClassLegacy } from '../core/class/AdtLocalTestClassLegacy';
import { AdtLocalTypesLegacy } from '../core/class/AdtLocalTypesLegacy';
import { AdtDdlLegacy } from '../core/ddl/AdtDdlLegacy';
import { AdtFunctionGroupLegacy } from '../core/functionGroup/AdtFunctionGroupLegacy';
import { AdtFunctionIncludeLegacy } from '../core/functionInclude/AdtFunctionIncludeLegacy';
import { AdtFunctionModuleLegacy } from '../core/functionModule/AdtFunctionModuleLegacy';
import { AdtIncludeLegacy } from '../core/include/AdtIncludeLegacy';
import { AdtInterfaceLegacy } from '../core/interface/AdtInterfaceLegacy';
import { AdtMessageClassLegacy } from '../core/messageClass/AdtMessageClassLegacy';
import { AdtPackageLegacy } from '../core/package/AdtPackageLegacy';
import { AdtProgramLegacy } from '../core/program/AdtProgramLegacy';
import { AdtUtilsLegacy } from '../core/shared/AdtUtilsLegacy';
import { AdtRequestLegacy } from '../core/transport/AdtRequestLegacy';
import { absentOnLegacy } from './absentOnLegacy';

export class AdtClientLegacy extends AdtClient<'basis740'> {
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtClientOptions,
  ) {
    super(connection, logger, {
      ...options,
      contentTypes:
        options?.contentTypes ?? new AdtContentTypesBase(options?.unicode),
    });
  }

  // --- Supported types with legacy overrides ---

  override getProgram(
    this: this & AdtServedBy<'program'>,
  ): AdtProgramLegacy<ResultValuesOf<typeof programDocuments>>;
  override getProgram<R extends IProgramResults>(
    this: this & AdtServedBy<'program'>,
    results: R,
  ): AdtProgramLegacy<ResultValuesOf<R>>;
  override getProgram(
    this: this & AdtServedBy<'program'>,
    results: IProgramResults = programDocuments,
  ): AdtProgramLegacy<ProgramValues> {
    this.assertConnected();
    return new AdtProgramLegacy<ProgramValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getClass(
    this: this & AdtServedBy<'class'>,
  ): AdtClassLegacy<ResultValuesOf<typeof classDocuments>>;
  override getClass<R extends IClassResults>(
    this: this & AdtServedBy<'class'>,
    results: R,
  ): AdtClassLegacy<ResultValuesOf<R>>;
  override getClass(
    this: this & AdtServedBy<'class'>,
    results: IClassResults = classDocuments,
  ): AdtClassLegacy<ClassValues> {
    this.assertConnected();
    return new AdtClassLegacy<ClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
  ): AdtFunctionIncludeLegacy<ResultValuesOf<typeof functionIncludeDocuments>>;
  override getFunctionInclude<R extends IFunctionIncludeResults>(
    this: this & AdtServedBy<'functionInclude'>,
    results: R,
  ): AdtFunctionIncludeLegacy<ResultValuesOf<R>>;
  override getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
    results: IFunctionIncludeResults = functionIncludeDocuments,
  ): AdtFunctionIncludeLegacy<FunctionIncludeValues> {
    this.assertConnected();
    return new AdtFunctionIncludeLegacy<FunctionIncludeValues>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        contentTypes: this.contentTypes,
        lockRegistry: this.lockRegistry,
        results,
      },
    );
  }

  override getInclude(
    this: this & AdtServedBy<'include'>,
  ): AdtIncludeLegacy<ResultValuesOf<typeof includeDocuments>>;
  override getInclude<R extends IIncludeResults>(
    this: this & AdtServedBy<'include'>,
    results: R,
  ): AdtIncludeLegacy<ResultValuesOf<R>>;
  override getInclude(
    this: this & AdtServedBy<'include'>,
    results: IIncludeResults = includeDocuments,
  ): AdtIncludeLegacy<IncludeValues> {
    this.assertConnected();
    return new AdtIncludeLegacy<IncludeValues>(this.connection, {
      logger: this.logger,
      contentTypes: this.contentTypes,
      results,
      systemContext: this.systemContext,
    });
  }

  override getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
  ): AdtMessageClassLegacy<ResultValuesOf<typeof messageClassDocuments>>;
  override getMessageClass<R extends IMessageClassResults>(
    this: this & AdtServedBy<'messageClass'>,
    results: R,
  ): AdtMessageClassLegacy<ResultValuesOf<R>>;
  override getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
    results: IMessageClassResults = messageClassDocuments,
  ): AdtMessageClassLegacy<MessageClassValues> {
    this.assertConnected();
    return new AdtMessageClassLegacy<MessageClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
  ): AdtLocalTestClassLegacy<ResultValuesOf<typeof classDocuments>>;
  override getLocalTestClass<R extends IClassResults>(
    this: this & AdtServedBy<'localTestClass'>,
    results: R,
  ): AdtLocalTestClassLegacy<ResultValuesOf<R>>;
  override getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTestClassLegacy<ClassValues> {
    this.assertConnected();
    return new AdtLocalTestClassLegacy<ClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
  ): AdtLocalTypesLegacy<ResultValuesOf<typeof classDocuments>>;
  override getLocalTypes<R extends IClassResults>(
    this: this & AdtServedBy<'localTypes'>,
    results: R,
  ): AdtLocalTypesLegacy<ResultValuesOf<R>>;
  override getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTypesLegacy<ClassValues> {
    this.assertConnected();
    return new AdtLocalTypesLegacy<ClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
  ): AdtLocalDefinitionsLegacy<ResultValuesOf<typeof classDocuments>>;
  override getLocalDefinitions<R extends IClassResults>(
    this: this & AdtServedBy<'localDefinitions'>,
    results: R,
  ): AdtLocalDefinitionsLegacy<ResultValuesOf<R>>;
  override getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
    results: IClassResults = classDocuments,
  ): AdtLocalDefinitionsLegacy<ClassValues> {
    this.assertConnected();
    return new AdtLocalDefinitionsLegacy<ClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
  ): AdtLocalMacrosLegacy<ResultValuesOf<typeof classDocuments>>;
  override getLocalMacros<R extends IClassResults>(
    this: this & AdtServedBy<'localMacros'>,
    results: R,
  ): AdtLocalMacrosLegacy<ResultValuesOf<R>>;
  override getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
    results: IClassResults = classDocuments,
  ): AdtLocalMacrosLegacy<ClassValues> {
    this.assertConnected();
    return new AdtLocalMacrosLegacy<ClassValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getInterface(
    this: this & AdtServedBy<'interface'>,
  ): AdtInterfaceLegacy<ResultValuesOf<typeof interfaceDocuments>>;
  override getInterface<R extends IInterfaceResults>(
    this: this & AdtServedBy<'interface'>,
    results: R,
  ): AdtInterfaceLegacy<ResultValuesOf<R>>;
  override getInterface(
    this: this & AdtServedBy<'interface'>,
    results: IInterfaceResults = interfaceDocuments,
  ): AdtInterfaceLegacy<InterfaceValues> {
    this.assertConnected();
    return new AdtInterfaceLegacy<InterfaceValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
  ): AdtFunctionGroupLegacy<ResultValuesOf<typeof functionGroupDocuments>>;
  override getFunctionGroup<R extends IFunctionGroupResults>(
    this: this & AdtServedBy<'functionGroup'>,
    results: R,
  ): AdtFunctionGroupLegacy<ResultValuesOf<R>>;
  override getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
    results: IFunctionGroupResults = functionGroupDocuments,
  ): AdtFunctionGroupLegacy<FunctionGroupValues> {
    this.assertConnected();
    return new AdtFunctionGroupLegacy<FunctionGroupValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
  ): AdtFunctionModuleLegacy<ResultValuesOf<typeof functionModuleDocuments>>;
  override getFunctionModule<R extends IFunctionModuleResults>(
    this: this & AdtServedBy<'functionModule'>,
    results: R,
  ): AdtFunctionModuleLegacy<ResultValuesOf<R>>;
  override getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
    results: IFunctionModuleResults = functionModuleDocuments,
  ): AdtFunctionModuleLegacy<FunctionModuleValues> {
    this.assertConnected();
    return new AdtFunctionModuleLegacy<FunctionModuleValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getPackage(
    this: this & AdtServedBy<'package'>,
  ): AdtPackageLegacy<ResultValuesOf<typeof packageDocuments>>;
  override getPackage<R extends IPackageResults>(
    this: this & AdtServedBy<'package'>,
    results: R,
  ): AdtPackageLegacy<ResultValuesOf<R>>;
  override getPackage(
    this: this & AdtServedBy<'package'>,
    results: IPackageResults = packageDocuments,
  ): AdtPackageLegacy<PackageValues> {
    this.assertConnected();
    return new AdtPackageLegacy<PackageValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  override getDdl(
    this: this & AdtServedBy<'ddl'>,
  ): AdtDdlLegacy<ResultValuesOf<typeof ddlDocuments>>;
  override getDdl<R extends IDdlResults>(
    this: this & AdtServedBy<'ddl'>,
    results: R,
  ): AdtDdlLegacy<ResultValuesOf<R>>;
  override getDdl(
    this: this & AdtServedBy<'ddl'>,
    results: IDdlResults = ddlDocuments,
  ): AdtDdlLegacy<DdlValues> {
    this.assertConnected();
    return new AdtDdlLegacy<DdlValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  // --- Transport with legacy URL prefix ---

  /**
   * The legacy transport handler.
   *
   * The **type** is the base's contract, and that is all this declaration says.
   * It is not a claim that the two behave alike: the legacy handler serves
   * `list` and `readMetadata` (the user's list from `/sap/bc/cts/`), `create`
   * is refused (measured on 7.40 SP04), and the other twelve members refuse
   * without a request. `list` differs too: no saved-configuration search, and
   * `configUri` is rejected rather than used.
   *
   * Narrowing this to what the handler offers does not compile: an override's
   * return must be assignable to the base's, and offering *less* is the one
   * direction the language refuses. `AdtClientLegacy extends AdtClient` while
   * this handler is not a behavioural subtype — inheritance is what made the
   * mismatch type-check while `AdtRequest` was the declared return.
   *
   * So the declaration is honest about the type and silent about the behaviour,
   * and the gap is tracked rather than papered over: #109.
   */
  override getRequest(
    this: this & AdtServedBy<'request'>,
  ): AdtRequestLegacy<ResultValuesOf<typeof transportDocuments>>;
  override getRequest<R extends ITransportResults>(
    this: this & AdtServedBy<'request'>,
    results: R,
  ): AdtRequestLegacy<ResultValuesOf<R>>;
  override getRequest(
    this: this & AdtServedBy<'request'>,
    results: ITransportResults = transportDocuments,
  ): AdtRequestLegacy<TransportValues> {
    this.assertConnected();
    return new AdtRequestLegacy<TransportValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      results,
    });
  }

  // --- Utilities with legacy restrictions ---

  /**
   * The same contract, a different implementation.
   *
   * **Annotated, not inherited.** An unannotated override infers its own return
   * type — `AdtUtilsLegacy`, the class — so the published `.d.ts` handed out a
   * concrete implementation while the modern client handed out the contract.
   * Nothing failed: the class satisfies the intersection, so the compiler was
   * content, and the legacy surface quietly exposed members the contract does
   * not carry. That is decision 10's whole point, arrived at through the one
   * shape it does not check.
   *
   * What this implementation refuses — `getSqlQuery`, `getTableContents` — it
   * refuses by *answering a failure*, not by throwing. A caller holding this
   * contract branches on `ok` either way, and a legacy system is not a reason to
   * be told about a refusal differently.
   */
  override getUtils(): AdtUtilsLegacy<ResultValuesOf<typeof utilDocuments>>;
  override getUtils<R extends IUtilResults>(
    results: R,
  ): AdtUtilsLegacy<ResultValuesOf<R>>;
  override getUtils(
    results: IUtilResults = utilDocuments,
  ): AdtUtilsLegacy<UtilValues> {
    this.assertConnected();
    return new AdtUtilsLegacy<UtilValues>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  // --- Types absent from legacy /sap/bc/adt/discovery ---
  //
  // Handed out all the same: every member answers a refusal and sends no
  // request (see absentOnLegacy).

  override getDomain(
    this: this & AdtServedBy<'domain'>,
  ): AdtDomain<ResultValuesOf<typeof domainDocuments>>;
  override getDomain<R extends IDomainResults>(
    this: this & AdtServedBy<'domain'>,
    results: R,
  ): AdtDomain<ResultValuesOf<R>>;
  override getDomain(
    this: this & AdtServedBy<'domain'>,
    _results?: IDomainResults,
  ): AdtDomain<DomainValues> {
    this.assertConnected();
    return absentOnLegacy<AdtDomain<DomainValues>>(
      AdtDomain,
      'Domain',
      DOMAIN.collection,
      'measured',
    );
  }

  override getDataElement(
    this: this & AdtServedBy<'dataElement'>,
  ): AdtDataElement<ResultValuesOf<typeof dataElementDocuments>>;
  override getDataElement<R extends IDataElementResults>(
    this: this & AdtServedBy<'dataElement'>,
    results: R,
  ): AdtDataElement<ResultValuesOf<R>>;
  override getDataElement(
    this: this & AdtServedBy<'dataElement'>,
    _results?: IDataElementResults,
  ): AdtDataElement<DataElementValues> {
    this.assertConnected();
    return absentOnLegacy<AdtDataElement<DataElementValues>>(
      AdtDataElement,
      'DataElement',
      DATA_ELEMENT.collection,
      'measured',
    );
  }

  override getStructure(
    this: this & AdtServedBy<'structure'>,
  ): AdtStructure<ResultValuesOf<typeof structureDocuments>, 'basis740'>;
  override getStructure<R extends IStructureResults>(
    this: this & AdtServedBy<'structure'>,
    results: R,
  ): AdtStructure<ResultValuesOf<R>, 'basis740'>;
  override getStructure(
    this: this & AdtServedBy<'structure'>,
    _results?: IStructureResults,
  ): AdtStructure<StructureValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtStructure<StructureValues, 'basis740'>>(
      AdtStructure,
      'Structure',
      STRUCTURE.collection,
      'measured',
    );
  }

  override getTable(
    this: this & AdtServedBy<'table'>,
  ): AdtTable<ResultValuesOf<typeof tableDocuments>, 'basis740'>;
  override getTable<R extends ITableResults>(
    this: this & AdtServedBy<'table'>,
    results: R,
  ): AdtTable<ResultValuesOf<R>, 'basis740'>;
  override getTable(
    this: this & AdtServedBy<'table'>,
    _results?: ITableResults,
  ): AdtTable<TableValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtTable<TableValues, 'basis740'>>(
      AdtTable,
      'Table',
      TABLE.collection,
      'measured',
    );
  }

  override getTableType(
    this: this & AdtServedBy<'tableType'>,
  ): AdtDdicTableType<ResultValuesOf<typeof tableTypeDocuments>>;
  override getTableType<R extends ITableTypeResults>(
    this: this & AdtServedBy<'tableType'>,
    results: R,
  ): AdtDdicTableType<ResultValuesOf<R>>;
  override getTableType(
    this: this & AdtServedBy<'tableType'>,
    _results?: ITableTypeResults,
  ): AdtDdicTableType<TableTypeValues> {
    this.assertConnected();
    return absentOnLegacy<AdtDdicTableType<TableTypeValues>>(
      AdtDdicTableType,
      'TableType',
      TABLE_TYPE.collection,
      'not-advertised',
    );
  }

  override getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
  ): AdtAccessControl<
    ResultValuesOf<typeof accessControlDocuments>,
    'basis740'
  >;
  override getAccessControl<R extends IAccessControlResults>(
    this: this & AdtServedBy<'accessControl'>,
    results: R,
  ): AdtAccessControl<ResultValuesOf<R>, 'basis740'>;
  override getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
    _results?: IAccessControlResults,
  ): AdtAccessControl<AccessControlValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtAccessControl<AccessControlValues, 'basis740'>>(
      AdtAccessControl,
      'AccessControl',
      ACCESS_CONTROL.collection,
      'not-advertised',
    );
  }

  override getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
  ): AdtServiceDefinition<
    ResultValuesOf<typeof serviceDefinitionDocuments>,
    'basis740'
  >;
  override getServiceDefinition<R extends IServiceDefinitionResults>(
    this: this & AdtServedBy<'serviceDefinition'>,
    results: R,
  ): AdtServiceDefinition<ResultValuesOf<R>, 'basis740'>;
  override getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
    _results?: IServiceDefinitionResults,
  ): AdtServiceDefinition<ServiceDefinitionValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtServiceDefinition<ServiceDefinitionValues, 'basis740'>
    >(
      AdtServiceDefinition,
      'ServiceDefinition',
      SERVICE_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
  ): AdtServiceBinding<ResultValuesOf<typeof serviceDocuments>, 'basis740'>;
  override getServiceBinding<R extends IServiceResults>(
    this: this & AdtServedBy<'serviceBinding'>,
    results: R,
  ): AdtServiceBinding<ResultValuesOf<R>, 'basis740'>;
  override getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
    _results?: IServiceResults,
  ): AdtServiceBinding<ServiceValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtServiceBinding<ServiceValues, 'basis740'>>(
      AdtServiceBinding,
      'ServiceBinding',
      SERVICE_BINDING.collection,
      'not-advertised',
    );
  }

  override getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
  ): AdtBehaviorDefinition<
    ResultValuesOf<typeof behaviorDefinitionDocuments>,
    'basis740'
  >;
  override getBehaviorDefinition<R extends IBehaviorDefinitionResults>(
    this: this & AdtServedBy<'behaviorDefinition'>,
    results: R,
  ): AdtBehaviorDefinition<ResultValuesOf<R>, 'basis740'>;
  override getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
    _results?: IBehaviorDefinitionResults,
  ): AdtBehaviorDefinition<BehaviorDefinitionValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtBehaviorDefinition<BehaviorDefinitionValues, 'basis740'>
    >(
      AdtBehaviorDefinition,
      'BehaviorDefinition',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
  ): AdtBehaviorImplementation<ResultValuesOf<typeof classDocuments>>;
  override getBehaviorImplementation<R extends IClassResults>(
    this: this & AdtServedBy<'behaviorImplementation'>,
    results: R,
  ): AdtBehaviorImplementation<ResultValuesOf<R>>;
  override getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
    _results?: IClassResults,
  ): AdtBehaviorImplementation<ClassValues> {
    this.assertConnected();
    return absentOnLegacy<AdtBehaviorImplementation<ClassValues>>(
      AdtBehaviorImplementation,
      'BehaviorImplementation',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
  ): AdtMetadataExtension<
    ResultValuesOf<typeof metadataExtensionDocuments>,
    'basis740'
  >;
  override getMetadataExtension<R extends IMetadataExtensionResults>(
    this: this & AdtServedBy<'metadataExtension'>,
    results: R,
  ): AdtMetadataExtension<ResultValuesOf<R>, 'basis740'>;
  override getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
    _results?: IMetadataExtensionResults,
  ): AdtMetadataExtension<MetadataExtensionValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtMetadataExtension<MetadataExtensionValues, 'basis740'>
    >(
      AdtMetadataExtension,
      'MetadataExtension',
      METADATA_EXTENSION.collection,
      'not-advertised',
    );
  }

  override getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
  ): AdtEnhancement<ResultValuesOf<typeof enhancementDocuments>, 'basis740'>;
  override getEnhancement<R extends IEnhancementResults>(
    this: this & AdtServedBy<'enhancement'>,
    results: R,
  ): AdtEnhancement<ResultValuesOf<R>, 'basis740'>;
  override getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
    _results?: IEnhancementResults,
  ): AdtEnhancement<EnhancementValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtEnhancement<EnhancementValues, 'basis740'>>(
      AdtEnhancement,
      'Enhancement',
      ENHANCEMENT.root,
      'measured',
    );
  }

  override getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
  ): AdtAuthorizationField<ResultValuesOf<typeof authorizationFieldDocuments>>;
  override getAuthorizationField<R extends IAuthorizationFieldResults>(
    this: this & AdtServedBy<'authorizationField'>,
    results: R,
  ): AdtAuthorizationField<ResultValuesOf<R>>;
  override getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
    _results?: IAuthorizationFieldResults,
  ): AdtAuthorizationField<AuthorizationFieldValues> {
    this.assertConnected();
    return absentOnLegacy<AdtAuthorizationField<AuthorizationFieldValues>>(
      AdtAuthorizationField,
      'AuthorizationField',
      AUTHORIZATION_FIELD.collection,
      'not-advertised',
    );
  }

  override getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
  ): AdtFeatureToggle<ResultValuesOf<typeof featureToggleDocuments>>;
  override getFeatureToggle<R extends IFeatureToggleResults>(
    this: this & AdtServedBy<'featureToggle'>,
    results: R,
  ): AdtFeatureToggle<ResultValuesOf<R>>;
  override getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
    _results?: IFeatureToggleResults,
  ): AdtFeatureToggle<FeatureToggleValues> {
    this.assertConnected();
    return absentOnLegacy<AdtFeatureToggle<FeatureToggleValues>>(
      AdtFeatureToggle,
      'FeatureToggle',
      FEATURE_TOGGLE.collection,
      'not-advertised',
    );
  }

  override getTransformation(
    this: this & AdtServedBy<'transformation'>,
  ): AdtTransformation<
    ResultValuesOf<typeof transformationDocuments>,
    'basis740'
  >;
  override getTransformation<R extends ITransformationResults>(
    this: this & AdtServedBy<'transformation'>,
    results: R,
  ): AdtTransformation<ResultValuesOf<R>, 'basis740'>;
  override getTransformation(
    this: this & AdtServedBy<'transformation'>,
    _results?: ITransformationResults,
  ): AdtTransformation<TransformationValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtTransformation<TransformationValues, 'basis740'>>(
      AdtTransformation,
      'Transformation',
      TRANSFORMATION.collection,
      'measured',
    );
  }

  override getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
  ): AdtScalarFunction<
    ResultValuesOf<typeof scalarFunctionDocuments>,
    'basis740'
  >;
  override getScalarFunction<R extends IScalarFunctionResults>(
    this: this & AdtServedBy<'scalarFunction'>,
    results: R,
  ): AdtScalarFunction<ResultValuesOf<R>, 'basis740'>;
  override getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
    _results?: IScalarFunctionResults,
  ): AdtScalarFunction<ScalarFunctionValues, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtScalarFunction<ScalarFunctionValues, 'basis740'>>(
      AdtScalarFunction,
      'ScalarFunction',
      SCALAR_FUNCTION.collection,
      'measured',
    );
  }

  override getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
  ): AdtScalarFunctionImplementation<
    ResultValuesOf<typeof scalarFunctionImplementationDocuments>
  >;
  override getScalarFunctionImplementation<
    R extends IScalarFunctionImplementationResults,
  >(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    results: R,
  ): AdtScalarFunctionImplementation<ResultValuesOf<R>>;
  override getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    _results?: IScalarFunctionImplementationResults,
  ): AdtScalarFunctionImplementation<ScalarFunctionImplementationValues> {
    this.assertConnected();
    return absentOnLegacy<
      AdtScalarFunctionImplementation<ScalarFunctionImplementationValues>
    >(
      AdtScalarFunctionImplementation,
      'ScalarFunctionImplementation',
      SCALAR_FUNCTION_IMPLEMENTATION.collection,
      'not-advertised',
    );
  }

  override getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
  ): AdtAppendStructure<ResultValuesOf<typeof appendStructureDocuments>>;
  override getAppendStructure<R extends IAppendStructureResults>(
    this: this & AdtServedBy<'appendStructure'>,
    results: R,
  ): AdtAppendStructure<ResultValuesOf<R>>;
  override getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
    _results?: IAppendStructureResults,
  ): AdtAppendStructure<AppendStructureValues> {
    this.assertConnected();
    return absentOnLegacy<AdtAppendStructure<AppendStructureValues>>(
      AdtAppendStructure,
      'AppendStructure',
      STRUCTURE.collection,
      'measured',
    );
  }
}
