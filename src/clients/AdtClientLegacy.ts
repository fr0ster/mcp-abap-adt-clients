/**
 * AdtClientLegacy - ADT Client for older SAP systems (BASIS < 7.50)
 *
 * Extends AdtClient and overrides methods that differ on legacy systems:
 * - Unsupported object types throw clear errors
 * - Supported types use legacy-compatible deletion (direct DELETE vs /deletion/delete)
 * - Content-Type defaults to v1 (AdtContentTypesBase)
 * - Transport requests use /sap/bc/cts/ instead of /sap/bc/adt/cts/
 *
 * Use createAdtClient() factory to auto-detect and instantiate.
 *
 * Unsupported types are determined by /sap/bc/adt/discovery catalog —
 * endpoints not present in legacy system discovery are blocked here.
 */

import type {
  IAbapConnection,
  IAdtClientOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { classDocuments, type IClassResults } from '../core/class';
import { AdtClassLegacy } from '../core/class/AdtClassLegacy';
import { ddlDocuments, type IDdlResults } from '../core/ddl';
import { AdtDdlLegacy } from '../core/ddl/AdtDdlLegacy';
import {
  functionGroupDocuments,
  type IFunctionGroupResults,
} from '../core/functionGroup';
import { AdtFunctionGroupLegacy } from '../core/functionGroup/AdtFunctionGroupLegacy';
import {
  functionModuleDocuments,
  type IFunctionModuleResults,
} from '../core/functionModule';
import { AdtFunctionModuleLegacy } from '../core/functionModule/AdtFunctionModuleLegacy';
import { type IInterfaceResults, interfaceDocuments } from '../core/interface';
import { AdtInterfaceLegacy } from '../core/interface/AdtInterfaceLegacy';
import { type IPackageResults, packageDocuments } from '../core/package';
import { AdtPackageLegacy } from '../core/package/AdtPackageLegacy';
import { type IProgramResults, programDocuments } from '../core/program';
import { AdtProgramLegacy } from '../core/program/AdtProgramLegacy';
import { AdtUtilsLegacy } from '../core/shared/AdtUtilsLegacy';
import { AdtContentTypesBase } from '../core/shared/contentTypes';
import { type IUtilResults, utilDocuments } from '../core/shared/utilResultSet';
import { type ITransportResults, transportDocuments } from '../core/transport';
import { AdtRequestLegacy } from '../core/transport/AdtRequestLegacy';
import { type IUnitTestResults, unitTestDocuments } from '../core/unitTest';
import { AdtUnitTestLegacy } from '../core/unitTest/AdtUnitTestLegacy';
import { AdtClient } from './AdtClient';

/**
 * Error message for unsupported object types on legacy systems.
 * The endpoint is not present in the /sap/bc/adt/discovery catalog.
 */
function unsupportedError(objectType: string, endpoint: string): string {
  return (
    `${objectType} is not supported on this SAP system. ` +
    `The required endpoint ${endpoint} was not found in the system's ` +
    `ADT discovery catalog (/sap/bc/adt/discovery). ` +
    `This typically means the system's BASIS version is too old.`
  );
}

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

  override getProgram<
    R extends IProgramResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IProgramResults,
  >(results: R = programDocuments as unknown as R): AdtProgramLegacy<R> {
    return new AdtProgramLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getClass<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtClassLegacy<R> {
    return new AdtClassLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  override getInterface<
    R extends IInterfaceResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IInterfaceResults,
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
    R extends IFunctionGroupResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IFunctionGroupResults,
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
    R extends IFunctionModuleResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IFunctionModuleResults,
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

  override getPackage<
    R extends IPackageResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IPackageResults,
  >(results: R = packageDocuments as unknown as R): AdtPackageLegacy<R> {
    return new AdtPackageLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  override getDdl<
    R extends IDdlResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IDdlResults,
  >(results: R = ddlDocuments as unknown as R): AdtDdlLegacy<R> {
    return new AdtDdlLegacy<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  // --- Unit tests with legacy endpoints ---

  override getUnitTest<
    R extends IUnitTestResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IUnitTestResults,
  >(results: R = unitTestDocuments as unknown as R): AdtUnitTestLegacy<R> {
    return new AdtUnitTestLegacy<R>(this.connection, this.logger, results);
  }

  // --- Transport with legacy URL prefix ---

  /**
   * The legacy transport handler.
   *
   * The **type** is the base's contract, and that is all this declaration says.
   * It is not a claim that the two behave alike: a legacy CTS endpoint serves
   * `read` and `list`, while `create`, `update`, `delete` and `listNodes` refuse
   * at runtime — `create` because the endpoint accepts no POST that creates a
   * request, the rest because nobody has captured whether it supports them and
   * guessing against the modern shape is not a contract. `list` differs too: no
   * saved-configuration search, and `configUri` is rejected rather than used.
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
  override getRequest<
    R extends ITransportResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = ITransportResults,
  >(results: R = transportDocuments as unknown as R): AdtRequestLegacy<R> {
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
  override getUtils<
    R extends IUtilResults<unknown, unknown, unknown> = IUtilResults,
  >(results: R = utilDocuments as unknown as R): AdtUtilsLegacy<R> {
    return new AdtUtilsLegacy<R>(this.connection, this.logger, results);
  }

  // --- CDS Unit Test: requires modern CDS endpoints ---

  override getCdsUnitTest(): never {
    throw new Error(
      unsupportedError(
        'CDS Unit Test',
        '/sap/bc/adt/ddic/ddl/sources (CDS framework)',
      ),
    );
  }

  // --- Unsupported types: endpoints absent from legacy /sap/bc/adt/discovery ---

  override getDomain(): never {
    throw new Error(unsupportedError('Domain', '/sap/bc/adt/ddic/domains'));
  }

  override getDataElement(): never {
    throw new Error(
      unsupportedError('DataElement', '/sap/bc/adt/ddic/dataelements'),
    );
  }

  override getStructure(): never {
    throw new Error(
      unsupportedError('Structure', '/sap/bc/adt/ddic/structures'),
    );
  }

  override getTable(): never {
    throw new Error(unsupportedError('Table', '/sap/bc/adt/ddic/tables'));
  }

  override getTableType(): never {
    throw new Error(
      unsupportedError('TableType', '/sap/bc/adt/ddic/tabletypes'),
    );
  }

  override getAccessControl(): never {
    throw new Error(
      unsupportedError('AccessControl', '/sap/bc/adt/acm/dcl/sources'),
    );
  }

  override getServiceDefinition(): never {
    throw new Error(
      unsupportedError('ServiceDefinition', '/sap/bc/adt/ddic/srvd/sources'),
    );
  }

  override getServiceBinding(): never {
    throw new Error(
      unsupportedError(
        'ServiceBinding',
        '/sap/bc/adt/businessservices/bindings',
      ),
    );
  }

  override getService(): never {
    throw new Error(
      unsupportedError(
        'ServiceBinding',
        '/sap/bc/adt/businessservices/bindings',
      ),
    );
  }

  override getBehaviorDefinition(): never {
    throw new Error(
      unsupportedError(
        'BehaviorDefinition',
        '/sap/bc/adt/bo/behaviordefinitions',
      ),
    );
  }

  override getBehaviorImplementation(): never {
    throw new Error(
      unsupportedError(
        'BehaviorImplementation',
        '/sap/bc/adt/bo/behaviordefinitions',
      ),
    );
  }

  override getMetadataExtension(): never {
    throw new Error(
      unsupportedError('MetadataExtension', '/sap/bc/adt/ddic/ddlx/sources'),
    );
  }

  override getEnhancement(): never {
    throw new Error(
      unsupportedError('Enhancement', '/sap/bc/adt/enhancements'),
    );
  }
}
