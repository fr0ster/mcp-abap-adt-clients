/**
 * AdtClientLegacy - ADT Client for older SAP systems (BASIS < 7.50), over RFC
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

import type { IAdtClientOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  AdtAccessControl,
  type accessControlDocuments,
  type IAccessControlResults,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  type appendStructureDocuments,
  type IAppendStructureResults,
} from '../core/appendStructure';
import {
  AdtAuthorizationField,
  type authorizationFieldDocuments,
  type IAuthorizationFieldResults,
} from '../core/authorizationField';
import {
  AdtBehaviorDefinition,
  type behaviorDefinitionDocuments,
  type IBehaviorDefinitionResults,
} from '../core/behaviorDefinition';
import { AdtBehaviorImplementation } from '../core/behaviorImplementation';
import { classDocuments, type IClassResults } from '../core/class';
import { AdtClassLegacy } from '../core/class/AdtClassLegacy';
import {
  AdtDataElement,
  type dataElementDocuments,
  type IDataElementResults,
} from '../core/dataElement';
import { ddlDocuments, type IDdlResults } from '../core/ddl';
import { AdtDdlLegacy } from '../core/ddl/AdtDdlLegacy';
import {
  AdtDomain,
  type domainDocuments,
  type IDomainResults,
} from '../core/domain';
import {
  AdtEnhancement,
  type enhancementDocuments,
  type IEnhancementResults,
} from '../core/enhancement';
import {
  AdtFeatureToggle,
  type featureToggleDocuments,
  type IFeatureToggleResults,
} from '../core/featureToggle';
import {
  functionGroupDocuments,
  type IFunctionGroupResults,
} from '../core/functionGroup';
import { AdtFunctionGroupLegacy } from '../core/functionGroup/AdtFunctionGroupLegacy';
import {
  functionIncludeDocuments,
  type IFunctionIncludeResults,
} from '../core/functionInclude';
import { AdtFunctionIncludeLegacy } from '../core/functionInclude/AdtFunctionIncludeLegacy';
import {
  functionModuleDocuments,
  type IFunctionModuleResults,
} from '../core/functionModule';
import { AdtFunctionModuleLegacy } from '../core/functionModule/AdtFunctionModuleLegacy';
import { type IIncludeResults, includeDocuments } from '../core/include';
import { AdtIncludeLegacy } from '../core/include/AdtIncludeLegacy';
import { type IInterfaceResults, interfaceDocuments } from '../core/interface';
import { AdtInterfaceLegacy } from '../core/interface/AdtInterfaceLegacy';
import {
  type IMessageClassResults,
  messageClassDocuments,
} from '../core/messageClass';
import { AdtMessageClassLegacy } from '../core/messageClass/AdtMessageClassLegacy';
import {
  AdtMetadataExtension,
  type IMetadataExtensionResults,
  type metadataExtensionDocuments,
} from '../core/metadataExtension';
import { type IPackageResults, packageDocuments } from '../core/package';
import { AdtPackageLegacy } from '../core/package/AdtPackageLegacy';
import { type IProgramResults, programDocuments } from '../core/program';
import { AdtProgramLegacy } from '../core/program/AdtProgramLegacy';
import {
  AdtScalarFunction,
  type IScalarFunctionResults,
  type scalarFunctionDocuments,
} from '../core/scalarFunction';
import {
  AdtScalarFunctionImplementation,
  type IScalarFunctionImplementationResults,
  type scalarFunctionImplementationDocuments,
} from '../core/scalarFunctionImplementation';
import {
  AdtServiceBinding,
  type IServiceResults,
  type serviceDocuments,
} from '../core/service';
import {
  AdtServiceDefinition,
  type IServiceDefinitionResults,
  type serviceDefinitionDocuments,
} from '../core/serviceDefinition';
import { AdtUtilsLegacy } from '../core/shared/AdtUtilsLegacy';
import { AdtContentTypesBase } from '../core/shared/contentTypes';
import { type IUtilResults, utilDocuments } from '../core/shared/utilResultSet';
import {
  AdtStructure,
  type IStructureResults,
  type structureDocuments,
} from '../core/structure';
import {
  AdtTable,
  type ITableResults,
  type tableDocuments,
} from '../core/table';
import {
  AdtDdicTableType,
  type ITableTypeResults,
  type tableTypeDocuments,
} from '../core/tabletype';
import {
  AdtTransformation,
  type ITransformationResults,
  type transformationDocuments,
} from '../core/transformation';
import { type ITransportResults, transportDocuments } from '../core/transport';
import { AdtRequestLegacy } from '../core/transport/AdtRequestLegacy';
import {
  ACCESS_CONTROL,
  AUTHORIZATION_FIELD,
  BEHAVIOR_DEFINITION,
  DATA_ELEMENT,
  DOMAIN,
  ENHANCEMENT,
  FEATURE_TOGGLE,
  METADATA_EXTENSION,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  TRANSFORMATION,
} from '../endpoints/objects';
import { AdtClient } from './AdtClient';
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
    return new AdtMessageClassLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getInterface<
    R extends IInterfaceResults = typeof interfaceDocuments,
  >(results: R = interfaceDocuments as unknown as R): AdtInterfaceLegacy<R> {
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
    return new AdtUtilsLegacy<R>(this.connection, this.logger, results);
  }

  // --- Types absent from legacy /sap/bc/adt/discovery ---
  //
  // Handed out all the same: every member answers a refusal and sends no
  // request (see absentOnLegacy).

  override getDomain<R extends IDomainResults = typeof domainDocuments>(
    _results?: R,
  ): AdtDomain<R> {
    return absentOnLegacy<AdtDomain<R>>(AdtDomain, 'Domain', DOMAIN.collection);
  }

  override getDataElement<
    R extends IDataElementResults = typeof dataElementDocuments,
  >(_results?: R): AdtDataElement<R> {
    return absentOnLegacy<AdtDataElement<R>>(
      AdtDataElement,
      'DataElement',
      DATA_ELEMENT.collection,
    );
  }

  override getStructure<
    R extends IStructureResults = typeof structureDocuments,
  >(_results?: R): AdtStructure<R> {
    return absentOnLegacy<AdtStructure<R>>(
      AdtStructure,
      'Structure',
      STRUCTURE.collection,
    );
  }

  override getTable<R extends ITableResults = typeof tableDocuments>(
    _results?: R,
  ): AdtTable<R> {
    return absentOnLegacy<AdtTable<R>>(AdtTable, 'Table', TABLE.collection);
  }

  override getTableType<
    R extends ITableTypeResults = typeof tableTypeDocuments,
  >(_results?: R): AdtDdicTableType<R> {
    return absentOnLegacy<AdtDdicTableType<R>>(
      AdtDdicTableType,
      'TableType',
      TABLE_TYPE.collection,
    );
  }

  override getAccessControl<
    R extends IAccessControlResults = typeof accessControlDocuments,
  >(_results?: R): AdtAccessControl<R> {
    return absentOnLegacy<AdtAccessControl<R>>(
      AdtAccessControl,
      'AccessControl',
      ACCESS_CONTROL.collection,
    );
  }

  override getServiceDefinition<
    R extends IServiceDefinitionResults = typeof serviceDefinitionDocuments,
  >(_results?: R): AdtServiceDefinition<R> {
    return absentOnLegacy<AdtServiceDefinition<R>>(
      AdtServiceDefinition,
      'ServiceDefinition',
      SERVICE_DEFINITION.collection,
    );
  }

  override getServiceBinding<
    R extends IServiceResults = typeof serviceDocuments,
  >(_results?: R): AdtServiceBinding<R> {
    return absentOnLegacy<AdtServiceBinding<R>>(
      AdtServiceBinding,
      'ServiceBinding',
      SERVICE_BINDING.collection,
    );
  }

  override getBehaviorDefinition<
    R extends IBehaviorDefinitionResults = typeof behaviorDefinitionDocuments,
  >(_results?: R): AdtBehaviorDefinition<R> {
    return absentOnLegacy<AdtBehaviorDefinition<R>>(
      AdtBehaviorDefinition,
      'BehaviorDefinition',
      BEHAVIOR_DEFINITION.collection,
    );
  }

  override getBehaviorImplementation<
    R extends IClassResults = typeof classDocuments,
  >(_results?: R): AdtBehaviorImplementation<R> {
    return absentOnLegacy<AdtBehaviorImplementation<R>>(
      AdtBehaviorImplementation,
      'BehaviorImplementation',
      BEHAVIOR_DEFINITION.collection,
    );
  }

  override getMetadataExtension<
    R extends IMetadataExtensionResults = typeof metadataExtensionDocuments,
  >(_results?: R): AdtMetadataExtension<R> {
    return absentOnLegacy<AdtMetadataExtension<R>>(
      AdtMetadataExtension,
      'MetadataExtension',
      METADATA_EXTENSION.collection,
    );
  }

  override getEnhancement<
    R extends IEnhancementResults = typeof enhancementDocuments,
  >(_results?: R): AdtEnhancement<R> {
    return absentOnLegacy<AdtEnhancement<R>>(
      AdtEnhancement,
      'Enhancement',
      ENHANCEMENT.root,
    );
  }

  override getAuthorizationField<
    R extends IAuthorizationFieldResults = typeof authorizationFieldDocuments,
  >(_results?: R): AdtAuthorizationField<R> {
    return absentOnLegacy<AdtAuthorizationField<R>>(
      AdtAuthorizationField,
      'AuthorizationField',
      AUTHORIZATION_FIELD.collection,
    );
  }

  override getFeatureToggle<
    R extends IFeatureToggleResults = typeof featureToggleDocuments,
  >(_results?: R): AdtFeatureToggle<R> {
    return absentOnLegacy<AdtFeatureToggle<R>>(
      AdtFeatureToggle,
      'FeatureToggle',
      FEATURE_TOGGLE.collection,
    );
  }

  override getTransformation<
    R extends ITransformationResults = typeof transformationDocuments,
  >(_results?: R): AdtTransformation<R> {
    return absentOnLegacy<AdtTransformation<R>>(
      AdtTransformation,
      'Transformation',
      TRANSFORMATION.collection,
    );
  }

  override getScalarFunction<
    R extends IScalarFunctionResults = typeof scalarFunctionDocuments,
  >(_results?: R): AdtScalarFunction<R> {
    return absentOnLegacy<AdtScalarFunction<R>>(
      AdtScalarFunction,
      'ScalarFunction',
      SCALAR_FUNCTION.collection,
    );
  }

  override getScalarFunctionImplementation<
    R extends
      IScalarFunctionImplementationResults = typeof scalarFunctionImplementationDocuments,
  >(_results?: R): AdtScalarFunctionImplementation<R> {
    return absentOnLegacy<AdtScalarFunctionImplementation<R>>(
      AdtScalarFunctionImplementation,
      'ScalarFunctionImplementation',
      SCALAR_FUNCTION_IMPLEMENTATION.collection,
    );
  }

  override getAppendStructure<
    R extends IAppendStructureResults = typeof appendStructureDocuments,
  >(_results?: R): AdtAppendStructure<R> {
    return absentOnLegacy<AdtAppendStructure<R>>(
      AdtAppendStructure,
      'AppendStructure',
      STRUCTURE.collection,
    );
  }
}
