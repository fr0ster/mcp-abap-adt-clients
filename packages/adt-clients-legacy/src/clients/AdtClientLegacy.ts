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

export class AdtClientLegacy extends AdtClient {
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

  override getProgram<R extends IProgramResults = typeof programDocuments>(
    results: R = programDocuments as unknown as R,
  ): AdtProgramLegacy<R> {
    this.assertConnected();
    return new AdtProgramLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getClass<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtClassLegacy<R> {
    this.assertConnected();
    return new AdtClassLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionInclude<
    R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
  >(
    results: R = functionIncludeDocuments as unknown as R,
  ): AdtFunctionIncludeLegacy<R> {
    this.assertConnected();
    return new AdtFunctionIncludeLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getInclude<R extends IIncludeResults = typeof includeDocuments>(
    results: R = includeDocuments as unknown as R,
  ): AdtIncludeLegacy<R> {
    this.assertConnected();
    return new AdtIncludeLegacy<R>(
      this.connection,
      this.logger,
      this.contentTypes,
      results,
      this.systemContext,
    );
  }

  override getMessageClass<
    R extends IMessageClassResults = typeof messageClassDocuments,
  >(
    results: R = messageClassDocuments as unknown as R,
  ): AdtMessageClassLegacy<R> {
    this.assertConnected();
    return new AdtMessageClassLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getLocalTestClass<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalTestClassLegacy<R> {
    this.assertConnected();
    return new AdtLocalTestClassLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalTypes<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalTypesLegacy<R> {
    this.assertConnected();
    return new AdtLocalTypesLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalDefinitions<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalDefinitionsLegacy<R> {
    this.assertConnected();
    return new AdtLocalDefinitionsLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getLocalMacros<R extends IClassResults = typeof classDocuments>(
    results: R = classDocuments as unknown as R,
  ): AdtLocalMacrosLegacy<R> {
    this.assertConnected();
    return new AdtLocalMacrosLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getInterface<
    R extends IInterfaceResults = typeof interfaceDocuments,
  >(results: R = interfaceDocuments as unknown as R): AdtInterfaceLegacy<R> {
    this.assertConnected();
    return new AdtInterfaceLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionGroup<
    R extends IFunctionGroupResults = typeof functionGroupDocuments,
  >(
    results: R = functionGroupDocuments as unknown as R,
  ): AdtFunctionGroupLegacy<R> {
    this.assertConnected();
    return new AdtFunctionGroupLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getFunctionModule<
    R extends IFunctionModuleResults = typeof functionModuleDocuments,
  >(
    results: R = functionModuleDocuments as unknown as R,
  ): AdtFunctionModuleLegacy<R> {
    this.assertConnected();
    return new AdtFunctionModuleLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getPackage<R extends IPackageResults = typeof packageDocuments>(
    results: R = packageDocuments as unknown as R,
  ): AdtPackageLegacy<R> {
    this.assertConnected();
    return new AdtPackageLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getDdl<R extends IDdlResults = typeof ddlDocuments>(
    results: R = ddlDocuments as unknown as R,
  ): AdtDdlLegacy<R> {
    this.assertConnected();
    return new AdtDdlLegacy<R>(
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
  override getRequest<R extends ITransportResults = typeof transportDocuments>(
    results: R = transportDocuments as unknown as R,
  ): AdtRequestLegacy<R> {
    this.assertConnected();
    return new AdtRequestLegacy<R>(
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
  override getUtils<R extends IUtilResults = typeof utilDocuments>(
    results: R = utilDocuments as unknown as R,
  ): AdtUtilsLegacy<R> {
    this.assertConnected();
    return new AdtUtilsLegacy<R>(this.connection, this.logger, results);
  }

  // --- Types absent from legacy /sap/bc/adt/discovery ---
  //
  // Handed out all the same: every member answers a refusal and sends no
  // request (see absentOnLegacy).

  override getDomain<R extends IDomainResults = typeof domainDocuments>(
    _results?: R,
  ): AdtDomain<R> {
    this.assertConnected();
    return absentOnLegacy<AdtDomain<R>>(
      AdtDomain,
      'Domain',
      DOMAIN.collection,
      'measured',
    );
  }

  override getDataElement<
    R extends IDataElementResults = typeof dataElementDocuments,
  >(_results?: R): AdtDataElement<R> {
    this.assertConnected();
    return absentOnLegacy<AdtDataElement<R>>(
      AdtDataElement,
      'DataElement',
      DATA_ELEMENT.collection,
      'measured',
    );
  }

  override getStructure<
    R extends IStructureResults = typeof structureDocuments,
  >(_results?: R): AdtStructure<R> {
    this.assertConnected();
    return absentOnLegacy<AdtStructure<R>>(
      AdtStructure,
      'Structure',
      STRUCTURE.collection,
      'measured',
    );
  }

  override getTable<R extends ITableResults = typeof tableDocuments>(
    _results?: R,
  ): AdtTable<R> {
    this.assertConnected();
    return absentOnLegacy<AdtTable<R>>(
      AdtTable,
      'Table',
      TABLE.collection,
      'measured',
    );
  }

  override getTableType<
    R extends ITableTypeResults = typeof tableTypeDocuments,
  >(_results?: R): AdtDdicTableType<R> {
    this.assertConnected();
    return absentOnLegacy<AdtDdicTableType<R>>(
      AdtDdicTableType,
      'TableType',
      TABLE_TYPE.collection,
      'not-advertised',
    );
  }

  override getAccessControl<
    R extends IAccessControlResults = typeof accessControlDocuments,
  >(_results?: R): AdtAccessControl<R> {
    this.assertConnected();
    return absentOnLegacy<AdtAccessControl<R>>(
      AdtAccessControl,
      'AccessControl',
      ACCESS_CONTROL.collection,
      'not-advertised',
    );
  }

  override getServiceDefinition<
    R extends IServiceDefinitionResults = typeof serviceDefinitionDocuments,
  >(_results?: R): AdtServiceDefinition<R> {
    this.assertConnected();
    return absentOnLegacy<AdtServiceDefinition<R>>(
      AdtServiceDefinition,
      'ServiceDefinition',
      SERVICE_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getServiceBinding<
    R extends IServiceResults = typeof serviceDocuments,
  >(_results?: R): AdtServiceBinding<R> {
    this.assertConnected();
    return absentOnLegacy<AdtServiceBinding<R>>(
      AdtServiceBinding,
      'ServiceBinding',
      SERVICE_BINDING.collection,
      'not-advertised',
    );
  }

  override getBehaviorDefinition<
    R extends IBehaviorDefinitionResults = typeof behaviorDefinitionDocuments,
  >(_results?: R): AdtBehaviorDefinition<R> {
    this.assertConnected();
    return absentOnLegacy<AdtBehaviorDefinition<R>>(
      AdtBehaviorDefinition,
      'BehaviorDefinition',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getBehaviorImplementation<
    R extends IClassResults = typeof classDocuments,
  >(_results?: R): AdtBehaviorImplementation<R> {
    this.assertConnected();
    return absentOnLegacy<AdtBehaviorImplementation<R>>(
      AdtBehaviorImplementation,
      'BehaviorImplementation',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override getMetadataExtension<
    R extends IMetadataExtensionResults = typeof metadataExtensionDocuments,
  >(_results?: R): AdtMetadataExtension<R> {
    this.assertConnected();
    return absentOnLegacy<AdtMetadataExtension<R>>(
      AdtMetadataExtension,
      'MetadataExtension',
      METADATA_EXTENSION.collection,
      'not-advertised',
    );
  }

  override getEnhancement<
    R extends IEnhancementResults = typeof enhancementDocuments,
  >(_results?: R): AdtEnhancement<R> {
    this.assertConnected();
    return absentOnLegacy<AdtEnhancement<R>>(
      AdtEnhancement,
      'Enhancement',
      ENHANCEMENT.root,
      'measured',
    );
  }

  override getAuthorizationField<
    R extends IAuthorizationFieldResults = typeof authorizationFieldDocuments,
  >(_results?: R): AdtAuthorizationField<R> {
    this.assertConnected();
    return absentOnLegacy<AdtAuthorizationField<R>>(
      AdtAuthorizationField,
      'AuthorizationField',
      AUTHORIZATION_FIELD.collection,
      'not-advertised',
    );
  }

  override getFeatureToggle<
    R extends IFeatureToggleResults = typeof featureToggleDocuments,
  >(_results?: R): AdtFeatureToggle<R> {
    this.assertConnected();
    return absentOnLegacy<AdtFeatureToggle<R>>(
      AdtFeatureToggle,
      'FeatureToggle',
      FEATURE_TOGGLE.collection,
      'not-advertised',
    );
  }

  override getTransformation<
    R extends ITransformationResults = typeof transformationDocuments,
  >(_results?: R): AdtTransformation<R> {
    this.assertConnected();
    return absentOnLegacy<AdtTransformation<R>>(
      AdtTransformation,
      'Transformation',
      TRANSFORMATION.collection,
      'measured',
    );
  }

  override getScalarFunction<
    R extends IScalarFunctionResults = typeof scalarFunctionDocuments,
  >(_results?: R): AdtScalarFunction<R> {
    this.assertConnected();
    return absentOnLegacy<AdtScalarFunction<R>>(
      AdtScalarFunction,
      'ScalarFunction',
      SCALAR_FUNCTION.collection,
      'measured',
    );
  }

  override getScalarFunctionImplementation<
    R extends
      IScalarFunctionImplementationResults = typeof scalarFunctionImplementationDocuments,
  >(_results?: R): AdtScalarFunctionImplementation<R> {
    this.assertConnected();
    return absentOnLegacy<AdtScalarFunctionImplementation<R>>(
      AdtScalarFunctionImplementation,
      'ScalarFunctionImplementation',
      SCALAR_FUNCTION_IMPLEMENTATION.collection,
      'not-advertised',
    );
  }

  override getAppendStructure<
    R extends IAppendStructureResults = typeof appendStructureDocuments,
  >(_results?: R): AdtAppendStructure<R> {
    this.assertConnected();
    return absentOnLegacy<AdtAppendStructure<R>>(
      AdtAppendStructure,
      'AppendStructure',
      STRUCTURE.collection,
      'measured',
    );
  }
}
