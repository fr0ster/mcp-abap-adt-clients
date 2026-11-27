/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 * updateMetadata() is refused without a request: not measured on 7.40.
 */

import {
  AdtFunctionModule,
  type AdtPerformedBy,
  answering,
  FUNCTION_MODULE,
  type FunctionModuleValues,
  type functionModuleDocuments,
  type ResultValuesOf,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IAnalyse,
  IFunctionModuleConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyNotMeasuredRefusal,
  noDeletionCheck,
  noTransportResource,
} from '../shared/refusalLegacy';

export class AdtFunctionModuleLegacy<
  T extends FunctionModuleValues = ResultValuesOf<
    typeof functionModuleDocuments
  >,
> extends AdtFunctionModule<T, 'basis740'> {
  /**
   * Delete function module — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a function module. Without a handle 7.40 SP04 deleted
   * a function module too; pass the handle all the same.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override delete<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  override delete(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  override async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    const group = config.functionGroupName;
    const module = config.functionModuleName;

    const objectUrl = `${FUNCTION_MODULE.uri(group, module)}`;
    return answering(
      () =>
        deleteObjectDirect(
          withCallTimeout(this.connection, options?.timeout),
          options.headers,
          objectUrl,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5). `delete` with
   * the object's lock handle is the delete.
   */
  override checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  override checkDeletion(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    return noDeletionCheck<T['deletionCheck']>();
  }

  /**
   * Refused without a request until measured: 7.40 SP04's type table lists no
   * `updateMetadata` for the function module, and no run there has sent the PUT of its
   * metadata document.
   */
  override updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  override updateMetadata(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  override async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    _config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    return legacyNotMeasuredRefusal<T['metadataUpdated']>(
      'updateMetadata',
      'PUT /sap/bc/adt/functions/groups/{group}/fmodules/{name}',
    );
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  override readTransport(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    return noTransportResource<T['transport']>(
      FUNCTION_MODULE.uri(config.functionGroupName, config.functionModuleName),
    );
  }
}
