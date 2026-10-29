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
  AUTHORIZATION_FIELD,
  type accessControlDocuments,
  type appendStructureDocuments,
  type authorizationFieldDocuments,
  BEHAVIOR_DEFINITION,
  type behaviorDefinitionDocuments,
  classDocuments,
  DATA_ELEMENT,
  DOMAIN,
  type dataElementDocuments,
  ddlDocuments,
  type domainDocuments,
  ENHANCEMENT,
  type enhancementDocuments,
  FEATURE_TOGGLE,
  type featureToggleDocuments,
  functionGroupDocuments,
  functionIncludeDocuments,
  functionModuleDocuments,
  includeDocuments,
  interfaceDocuments,
  METADATA_EXTENSION,
  messageClassDocuments,
  type metadataExtensionDocuments,
  packageDocuments,
  programDocuments,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  STRUCTURE,
  type scalarFunctionDocuments,
  type scalarFunctionImplementationDocuments,
  type serviceDefinitionDocuments,
  type serviceDocuments,
  type structureDocuments,
  TABLE,
  TABLE_TYPE,
  TRANSFORMATION,
  type tableDocuments,
  type tableTypeDocuments,
  type transformationDocuments,
  transportDocuments,
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
  ): AdtProgramLegacy<typeof programDocuments>;
  override getProgram<R extends IProgramResults>(
    this: this & AdtServedBy<'program'>,
    results: R,
  ): AdtProgramLegacy<R>;
  override getProgram(
    this: this & AdtServedBy<'program'>,
    results: IProgramResults = programDocuments,
  ): AdtProgramLegacy<IProgramResults> {
    this.assertConnected();
    return new AdtProgramLegacy<IProgramResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getClass(
    this: this & AdtServedBy<'class'>,
  ): AdtClassLegacy<typeof classDocuments>;
  override getClass<R extends IClassResults>(
    this: this & AdtServedBy<'class'>,
    results: R,
  ): AdtClassLegacy<R>;
  override getClass(
    this: this & AdtServedBy<'class'>,
    results: IClassResults = classDocuments,
  ): AdtClassLegacy<IClassResults> {
    this.assertConnected();
    return new AdtClassLegacy<IClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
  ): AdtFunctionIncludeLegacy<typeof functionIncludeDocuments>;
  override getFunctionInclude<R extends IFunctionIncludeResults>(
    this: this & AdtServedBy<'functionInclude'>,
    results: R,
  ): AdtFunctionIncludeLegacy<R>;
  override getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
    results: IFunctionIncludeResults = functionIncludeDocuments,
  ): AdtFunctionIncludeLegacy<IFunctionIncludeResults> {
    this.assertConnected();
    return new AdtFunctionIncludeLegacy<IFunctionIncludeResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getInclude(
    this: this & AdtServedBy<'include'>,
  ): AdtIncludeLegacy<typeof includeDocuments>;
  override getInclude<R extends IIncludeResults>(
    this: this & AdtServedBy<'include'>,
    results: R,
  ): AdtIncludeLegacy<R>;
  override getInclude(
    this: this & AdtServedBy<'include'>,
    results: IIncludeResults = includeDocuments,
  ): AdtIncludeLegacy<IIncludeResults> {
    this.assertConnected();
    return new AdtIncludeLegacy<IIncludeResults>(
      this.connection,
      this.logger,
      this.contentTypes,
      results,
      this.systemContext,
    );
  }

  override getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
  ): AdtMessageClassLegacy<typeof messageClassDocuments>;
  override getMessageClass<R extends IMessageClassResults>(
    this: this & AdtServedBy<'messageClass'>,
    results: R,
  ): AdtMessageClassLegacy<R>;
  override getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
    results: IMessageClassResults = messageClassDocuments,
  ): AdtMessageClassLegacy<IMessageClassResults> {
    this.assertConnected();
    return new AdtMessageClassLegacy<IMessageClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
  ): AdtLocalTestClassLegacy<typeof classDocuments>;
  override getLocalTestClass<R extends IClassResults>(
    this: this & AdtServedBy<'localTestClass'>,
    results: R,
  ): AdtLocalTestClassLegacy<R>;
  override getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTestClassLegacy<IClassResults> {
    this.assertConnected();
    return new AdtLocalTestClassLegacy<IClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
  ): AdtLocalTypesLegacy<typeof classDocuments>;
  override getLocalTypes<R extends IClassResults>(
    this: this & AdtServedBy<'localTypes'>,
    results: R,
  ): AdtLocalTypesLegacy<R>;
  override getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTypesLegacy<IClassResults> {
    this.assertConnected();
    return new AdtLocalTypesLegacy<IClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
  ): AdtLocalDefinitionsLegacy<typeof classDocuments>;
  override getLocalDefinitions<R extends IClassResults>(
    this: this & AdtServedBy<'localDefinitions'>,
    results: R,
  ): AdtLocalDefinitionsLegacy<R>;
  override getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
    results: IClassResults = classDocuments,
  ): AdtLocalDefinitionsLegacy<IClassResults> {
    this.assertConnected();
    return new AdtLocalDefinitionsLegacy<IClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
  ): AdtLocalMacrosLegacy<typeof classDocuments>;
  override getLocalMacros<R extends IClassResults>(
    this: this & AdtServedBy<'localMacros'>,
    results: R,
  ): AdtLocalMacrosLegacy<R>;
  override getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
    results: IClassResults = classDocuments,
  ): AdtLocalMacrosLegacy<IClassResults> {
    this.assertConnected();
    return new AdtLocalMacrosLegacy<IClassResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getInterface(
    this: this & AdtServedBy<'interface'>,
  ): AdtInterfaceLegacy<typeof interfaceDocuments>;
  override getInterface<R extends IInterfaceResults>(
    this: this & AdtServedBy<'interface'>,
    results: R,
  ): AdtInterfaceLegacy<R>;
  override getInterface(
    this: this & AdtServedBy<'interface'>,
    results: IInterfaceResults = interfaceDocuments,
  ): AdtInterfaceLegacy<IInterfaceResults> {
    this.assertConnected();
    return new AdtInterfaceLegacy<IInterfaceResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
  ): AdtFunctionGroupLegacy<typeof functionGroupDocuments>;
  override getFunctionGroup<R extends IFunctionGroupResults>(
    this: this & AdtServedBy<'functionGroup'>,
    results: R,
  ): AdtFunctionGroupLegacy<R>;
  override getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
    results: IFunctionGroupResults = functionGroupDocuments,
  ): AdtFunctionGroupLegacy<IFunctionGroupResults> {
    this.assertConnected();
    return new AdtFunctionGroupLegacy<IFunctionGroupResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
  ): AdtFunctionModuleLegacy<typeof functionModuleDocuments>;
  override getFunctionModule<R extends IFunctionModuleResults>(
    this: this & AdtServedBy<'functionModule'>,
    results: R,
  ): AdtFunctionModuleLegacy<R>;
  override getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
    results: IFunctionModuleResults = functionModuleDocuments,
  ): AdtFunctionModuleLegacy<IFunctionModuleResults> {
    this.assertConnected();
    return new AdtFunctionModuleLegacy<IFunctionModuleResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getPackage(
    this: this & AdtServedBy<'package'>,
  ): AdtPackageLegacy<typeof packageDocuments>;
  override getPackage<R extends IPackageResults>(
    this: this & AdtServedBy<'package'>,
    results: R,
  ): AdtPackageLegacy<R>;
  override getPackage(
    this: this & AdtServedBy<'package'>,
    results: IPackageResults = packageDocuments,
  ): AdtPackageLegacy<IPackageResults> {
    this.assertConnected();
    return new AdtPackageLegacy<IPackageResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getDdl(
    this: this & AdtServedBy<'ddl'>,
  ): AdtDdlLegacy<typeof ddlDocuments>;
  override getDdl<R extends IDdlResults>(
    this: this & AdtServedBy<'ddl'>,
    results: R,
  ): AdtDdlLegacy<R>;
  override getDdl(
    this: this & AdtServedBy<'ddl'>,
    results: IDdlResults = ddlDocuments,
  ): AdtDdlLegacy<IDdlResults> {
    this.assertConnected();
    return new AdtDdlLegacy<IDdlResults>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
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
  ): AdtRequestLegacy<typeof transportDocuments>;
  override getRequest<R extends ITransportResults>(
    this: this & AdtServedBy<'request'>,
    results: R,
  ): AdtRequestLegacy<R>;
  override getRequest(
    this: this & AdtServedBy<'request'>,
    results: ITransportResults = transportDocuments,
  ): AdtRequestLegacy<ITransportResults> {
    this.assertConnected();
    return new AdtRequestLegacy<ITransportResults>(
      this.connection,
      this.logger,
      this.systemContext,
      results,
    );
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
  override getUtils(): AdtUtilsLegacy<typeof utilDocuments>;
  override getUtils<R extends IUtilResults>(results: R): AdtUtilsLegacy<R>;
  override getUtils(
    results: IUtilResults = utilDocuments,
  ): AdtUtilsLegacy<IUtilResults> {
    this.assertConnected();
    return new AdtUtilsLegacy<IUtilResults>(
      this.connection,
      this.logger,
      results,
    );
  }

  // --- Types absent from legacy /sap/bc/adt/discovery ---
  //
  // Handed out all the same: every member answers a refusal and sends no
  // request (see absentOnLegacy).

  override getDomain(
    this: this & AdtServedBy<'domain'>,
  ): AdtDomain<typeof domainDocuments>;
  override getDomain<R extends IDomainResults>(
    this: this & AdtServedBy<'domain'>,
    results: R,
  ): AdtDomain<R>;
  override getDomain(
    this: this & AdtServedBy<'domain'>,
    _results?: IDomainResults,
  ): AdtDomain<IDomainResults> {
    this.assertConnected();
    return absentOnLegacy<AdtDomain<IDomainResults>>(
      AdtDomain,
      'Domain',
      DOMAIN.collection,
      'measured',
    );
  }

  override getDataElement(
    this: this & AdtServedBy<'dataElement'>,
  ): AdtDataElement<typeof dataElementDocuments>;
  override getDataElement<R extends IDataElementResults>(
    this: this & AdtServedBy<'dataElement'>,
    results: R,
  ): AdtDataElement<R>;
  override getDataElement(
    this: this & AdtServedBy<'dataElement'>,
    _results?: IDataElementResults,
  ): AdtDataElement<IDataElementResults> {
    this.assertConnected();
    return absentOnLegacy<AdtDataElement<IDataElementResults>>(
      AdtDataElement,
      'DataElement',
      DATA_ELEMENT.collection,
      'measured',
    );
  }

  override getStructure(
    this: this & AdtServedBy<'structure'>,
  ): AdtStructure<typeof structureDocuments, 'basis740'>;
  override getStructure<R extends IStructureResults>(
    this: this & AdtServedBy<'structure'>,
    results: R,
  ): AdtStructure<R, 'basis740'>;
  override getStructure(
    this: this & AdtServedBy<'structure'>,
    _results?: IStructureResults,
  ): AdtStructure<IStructureResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtStructure<IStructureResults, 'basis740'>>(
      AdtStructure,
      'Structure',
      STRUCTURE.collection,
      'measured',
    );
  }

  override getTable(
    this: this & AdtServedBy<'table'>,
  ): AdtTable<typeof tableDocuments, 'basis740'>;
  override getTable<R extends ITableResults>(
    this: this & AdtServedBy<'table'>,
    results: R,
  ): AdtTable<R, 'basis740'>;
  override getTable(
    this: this & AdtServedBy<'table'>,
    _results?: ITableResults,
  ): AdtTable<ITableResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtTable<ITableResults, 'basis740'>>(
      AdtTable,
      'Table',
      TABLE.collection,
      'measured',
    );
  }

  override getTableType(
    this: this & AdtServedBy<'tableType'>,
  ): AdtDdicTableType<typeof tableTypeDocuments>;
  override getTableType<R extends ITableTypeResults>(
    this: this & AdtServedBy<'tableType'>,
    results: R,
  ): AdtDdicTableType<R>;
  override getTableType(
    this: this & AdtServedBy<'tableType'>,
    _results?: ITableTypeResults,
  ): AdtDdicTableType<ITableTypeResults> {
    this.assertConnected();
    return absentOnLegacy<AdtDdicTableType<ITableTypeResults>>(
      AdtDdicTableType,
      'TableType',
      TABLE_TYPE.collection,
      'not-advertised',
    );
  }

  override getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
  ): AdtAccessControl<typeof accessControlDocuments, 'basis740'>;
  override getAccessControl<R extends IAccessControlResults>(
    this: this & AdtServedBy<'accessControl'>,
    results: R,
  ): AdtAccessControl<R, 'basis740'>;
  override getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
    _results?: IAccessControlResults,
  ): AdtAccessControl<IAccessControlResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtAccessControl<IAccessControlResults, 'basis740'>>(
      AdtAccessControl,
      'AccessControl',
      ACCESS_CONTROL.collection,
      'not-advertised',
    );
  }

  override getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
  ): AdtServiceDefinition<typeof serviceDefinitionDocuments, 'basis740'>;
  override getServiceDefinition<R extends IServiceDefinitionResults>(
    this: this & AdtServedBy<'serviceDefinition'>,
    results: R,
  ): AdtServiceDefinition<R, 'basis740'>;
  override getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
    _results?: IServiceDefinitionResults,
  ): AdtServiceDefinition<IServiceDefinitionResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtServiceDefinition<IServiceDefinitionResults, 'basis740'>
    >(
      AdtServiceDefinition,
      'ServiceDefinition',
      SERVICE_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
  ): AdtServiceBinding<typeof serviceDocuments, 'basis740'>;
  override getServiceBinding<R extends IServiceResults>(
    this: this & AdtServedBy<'serviceBinding'>,
    results: R,
  ): AdtServiceBinding<R, 'basis740'>;
  override getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
    _results?: IServiceResults,
  ): AdtServiceBinding<IServiceResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtServiceBinding<IServiceResults, 'basis740'>>(
      AdtServiceBinding,
      'ServiceBinding',
      SERVICE_BINDING.collection,
      'not-advertised',
    );
  }

  override getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
  ): AdtBehaviorDefinition<typeof behaviorDefinitionDocuments, 'basis740'>;
  override getBehaviorDefinition<R extends IBehaviorDefinitionResults>(
    this: this & AdtServedBy<'behaviorDefinition'>,
    results: R,
  ): AdtBehaviorDefinition<R, 'basis740'>;
  override getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
    _results?: IBehaviorDefinitionResults,
  ): AdtBehaviorDefinition<IBehaviorDefinitionResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtBehaviorDefinition<IBehaviorDefinitionResults, 'basis740'>
    >(
      AdtBehaviorDefinition,
      'BehaviorDefinition',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
  ): AdtBehaviorImplementation<typeof classDocuments>;
  override getBehaviorImplementation<R extends IClassResults>(
    this: this & AdtServedBy<'behaviorImplementation'>,
    results: R,
  ): AdtBehaviorImplementation<R>;
  override getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
    _results?: IClassResults,
  ): AdtBehaviorImplementation<IClassResults> {
    this.assertConnected();
    return absentOnLegacy<AdtBehaviorImplementation<IClassResults>>(
      AdtBehaviorImplementation,
      'BehaviorImplementation',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
  ): AdtMetadataExtension<typeof metadataExtensionDocuments, 'basis740'>;
  override getMetadataExtension<R extends IMetadataExtensionResults>(
    this: this & AdtServedBy<'metadataExtension'>,
    results: R,
  ): AdtMetadataExtension<R, 'basis740'>;
  override getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
    _results?: IMetadataExtensionResults,
  ): AdtMetadataExtension<IMetadataExtensionResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtMetadataExtension<IMetadataExtensionResults, 'basis740'>
    >(
      AdtMetadataExtension,
      'MetadataExtension',
      METADATA_EXTENSION.collection,
      'not-advertised',
    );
  }

  override getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
  ): AdtEnhancement<typeof enhancementDocuments, 'basis740'>;
  override getEnhancement<R extends IEnhancementResults>(
    this: this & AdtServedBy<'enhancement'>,
    results: R,
  ): AdtEnhancement<R, 'basis740'>;
  override getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
    _results?: IEnhancementResults,
  ): AdtEnhancement<IEnhancementResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<AdtEnhancement<IEnhancementResults, 'basis740'>>(
      AdtEnhancement,
      'Enhancement',
      ENHANCEMENT.root,
      'measured',
    );
  }

  override getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
  ): AdtAuthorizationField<typeof authorizationFieldDocuments>;
  override getAuthorizationField<R extends IAuthorizationFieldResults>(
    this: this & AdtServedBy<'authorizationField'>,
    results: R,
  ): AdtAuthorizationField<R>;
  override getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
    _results?: IAuthorizationFieldResults,
  ): AdtAuthorizationField<IAuthorizationFieldResults> {
    this.assertConnected();
    return absentOnLegacy<AdtAuthorizationField<IAuthorizationFieldResults>>(
      AdtAuthorizationField,
      'AuthorizationField',
      AUTHORIZATION_FIELD.collection,
      'not-advertised',
    );
  }

  override getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
  ): AdtFeatureToggle<typeof featureToggleDocuments>;
  override getFeatureToggle<R extends IFeatureToggleResults>(
    this: this & AdtServedBy<'featureToggle'>,
    results: R,
  ): AdtFeatureToggle<R>;
  override getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
    _results?: IFeatureToggleResults,
  ): AdtFeatureToggle<IFeatureToggleResults> {
    this.assertConnected();
    return absentOnLegacy<AdtFeatureToggle<IFeatureToggleResults>>(
      AdtFeatureToggle,
      'FeatureToggle',
      FEATURE_TOGGLE.collection,
      'not-advertised',
    );
  }

  override getTransformation(
    this: this & AdtServedBy<'transformation'>,
  ): AdtTransformation<typeof transformationDocuments, 'basis740'>;
  override getTransformation<R extends ITransformationResults>(
    this: this & AdtServedBy<'transformation'>,
    results: R,
  ): AdtTransformation<R, 'basis740'>;
  override getTransformation(
    this: this & AdtServedBy<'transformation'>,
    _results?: ITransformationResults,
  ): AdtTransformation<ITransformationResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtTransformation<ITransformationResults, 'basis740'>
    >(
      AdtTransformation,
      'Transformation',
      TRANSFORMATION.collection,
      'measured',
    );
  }

  override getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
  ): AdtScalarFunction<typeof scalarFunctionDocuments, 'basis740'>;
  override getScalarFunction<R extends IScalarFunctionResults>(
    this: this & AdtServedBy<'scalarFunction'>,
    results: R,
  ): AdtScalarFunction<R, 'basis740'>;
  override getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
    _results?: IScalarFunctionResults,
  ): AdtScalarFunction<IScalarFunctionResults, 'basis740'> {
    this.assertConnected();
    return absentOnLegacy<
      AdtScalarFunction<IScalarFunctionResults, 'basis740'>
    >(
      AdtScalarFunction,
      'ScalarFunction',
      SCALAR_FUNCTION.collection,
      'measured',
    );
  }

  override getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
  ): AdtScalarFunctionImplementation<
    typeof scalarFunctionImplementationDocuments
  >;
  override getScalarFunctionImplementation<
    R extends IScalarFunctionImplementationResults,
  >(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    results: R,
  ): AdtScalarFunctionImplementation<R>;
  override getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    _results?: IScalarFunctionImplementationResults,
  ): AdtScalarFunctionImplementation<IScalarFunctionImplementationResults> {
    this.assertConnected();
    return absentOnLegacy<
      AdtScalarFunctionImplementation<IScalarFunctionImplementationResults>
    >(
      AdtScalarFunctionImplementation,
      'ScalarFunctionImplementation',
      SCALAR_FUNCTION_IMPLEMENTATION.collection,
      'not-advertised',
    );
  }

  override getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
  ): AdtAppendStructure<typeof appendStructureDocuments>;
  override getAppendStructure<R extends IAppendStructureResults>(
    this: this & AdtServedBy<'appendStructure'>,
    results: R,
  ): AdtAppendStructure<R>;
  override getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
    _results?: IAppendStructureResults,
  ): AdtAppendStructure<IAppendStructureResults> {
    this.assertConnected();
    return absentOnLegacy<AdtAppendStructure<IAppendStructureResults>>(
      AdtAppendStructure,
      'AppendStructure',
      STRUCTURE.collection,
      'measured',
    );
  }
}
