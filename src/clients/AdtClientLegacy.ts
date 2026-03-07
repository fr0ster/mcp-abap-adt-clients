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
  IAdtObject,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IClassConfig, IClassState } from '../core/class';
import { AdtClassLegacy } from '../core/class/AdtClassLegacy';
import type {
  IFunctionGroupConfig,
  IFunctionGroupState,
} from '../core/functionGroup';
import { AdtFunctionGroupLegacy } from '../core/functionGroup/AdtFunctionGroupLegacy';
import type {
  IFunctionModuleConfig,
  IFunctionModuleState,
} from '../core/functionModule';
import { AdtFunctionModuleLegacy } from '../core/functionModule/AdtFunctionModuleLegacy';
import type { IInterfaceConfig, IInterfaceState } from '../core/interface';
import { AdtInterfaceLegacy } from '../core/interface/AdtInterfaceLegacy';
import type { IPackageConfig, IPackageState } from '../core/package';
import { AdtPackageLegacy } from '../core/package/AdtPackageLegacy';
import type { IProgramConfig, IProgramState } from '../core/program';
import { AdtProgramLegacy } from '../core/program/AdtProgramLegacy';
import type { AdtUtils } from '../core/shared/AdtUtils';
import { AdtUtilsLegacy } from '../core/shared/AdtUtilsLegacy';
import { AdtContentTypesBase } from '../core/shared/contentTypes';
import type { IUnitTestConfig, IUnitTestState } from '../core/unitTest';
import { AdtUnitTestLegacy } from '../core/unitTest/AdtUnitTestLegacy';
import type { IViewConfig, IViewState } from '../core/view';
import { AdtViewLegacy } from '../core/view/AdtViewLegacy';
import { AdtClient, type IAdtClientOptions } from './AdtClient';

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

  override getProgram(): IAdtObject<IProgramConfig, IProgramState> {
    return new AdtProgramLegacy(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
    );
  }

  override getClass(): IAdtObject<IClassConfig, IClassState> {
    return new AdtClassLegacy(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
    );
  }

  override getInterface(): IAdtObject<IInterfaceConfig, IInterfaceState> {
    return new AdtInterfaceLegacy(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
    );
  }

  override getFunctionGroup(): IAdtObject<
    IFunctionGroupConfig,
    IFunctionGroupState
  > {
    return new AdtFunctionGroupLegacy(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
    );
  }

  override getFunctionModule(): IAdtObject<
    IFunctionModuleConfig,
    IFunctionModuleState
  > {
    return new AdtFunctionModuleLegacy(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
    );
  }

  override getPackage(): IAdtObject<IPackageConfig, IPackageState> {
    return new AdtPackageLegacy(
      this.connection,
      this.logger,
      this.systemContext,
    );
  }

  override getView(): IAdtObject<IViewConfig, IViewState> {
    return new AdtViewLegacy(this.connection, this.logger, this.systemContext);
  }

  // --- Unit tests with legacy endpoints ---

  override getUnitTest(): IAdtObject<IUnitTestConfig, IUnitTestState> {
    return new AdtUnitTestLegacy(this.connection, this.logger);
  }

  // --- Utilities with legacy restrictions ---

  override getUtils(): AdtUtils {
    return new AdtUtilsLegacy(this.connection, this.logger);
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
