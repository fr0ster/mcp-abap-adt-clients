/**
 * AdtDdlLegacy - DDL source handler for legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API),
 * and refuses checkCdsTestDoubles(): the CDS test-doubles framework endpoint is
 * not present on 7.40 SP04 (issue #207).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 * readTransport(), getVersions() and getVersionSource() are refused without a
 * request: measured on 7.40 SP04, their resources answer `404`.
 */

import {
  AdtDdl,
  type AdtPerformedBy,
  answering,
  DDL_SOURCE,
  type ddlDocuments,
  failed,
  versionsUri,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IDdlConfig,
  IDdlResults,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyMeasuredRefusal,
  noDeletionCheck,
  noTransportResource,
} from '../shared/refusalLegacy';

export class AdtDdlLegacy<
  R extends IDdlResults = typeof ddlDocuments,
> extends AdtDdl<R, 'basis740'> {
  /**
   * Delete DDL source — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a DDL source. Without a handle 7.40 SP04 deleted
   * a DDL source too; pass the handle all the same.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDdlConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.ddlName as string;

    const objectUrl = `${DDL_SOURCE.uri(name)}`;
    return answering(
      () =>
        deleteObjectDirect(
          withCallTimeout(this.connection, options?.timeout),
          options.headers,
          objectUrl,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Refused without a request: the endpoint is absent on 7.40 SP04. */
  override async checkCdsTestDoubles<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'basis740', 'ddl', 'checkCdsTestDoubles'>,
    _cdsViewName: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['testDoubles']>, E>> {
    return failed<ReturnType<R['testDoubles']>, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'The CDS test-doubles check needs BASIS 7.50 or later; this system has no such endpoint.',
    } as E);
  }

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5). `delete` with
   * the object's lock handle is the delete.
   */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'basis740', 'ddl', 'deletionCheck'>,
    _config: Partial<IDdlConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'basis740', 'ddl', 'transport'>,
    config: Partial<IDdlConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    return noTransportResource<ReturnType<R['transport']>, E>(
      DDL_SOURCE.uri(config.ddlName as string),
    );
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <DDL URI>/versions`
   * answers `404` (record B4-cycles-20261026-2019).
   */
  override async getVersions<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'basis740', 'ddl', 'versions'>,
    config: Partial<IDdlConfig>,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versions']>, E>> {
    return legacyMeasuredRefusal<ReturnType<R['versions']>, E>(
      'getVersions',
      `GET ${versionsUri(DDL_SOURCE.uri(config.ddlName as string))} answers 404.`,
    );
  }

  /**
   * Refused without a request: the version list it takes its `contentUri`
   * from answers `404` on 7.40 SP04 (record B4-cycles-20261026-2019).
   */
  override async getVersionSource<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'basis740', 'ddl', 'versions'>,
    _contentUri: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versionSource']>, E>> {
    return legacyMeasuredRefusal<ReturnType<R['versionSource']>, E>(
      'getVersionSource',
      'the DDL version list (GET <DDL URI>/versions) answers 404, so there is no version to read.',
    );
  }
}
