/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 * updateMetadata() is refused without a request: not measured on 7.40.
 */

import {
  type AdtPerformedBy,
  AdtProgram,
  answering,
  PROGRAM,
  type ProgramValues,
  type programDocuments,
  type ResultValuesOf,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  AdtRequiredUpdateOptions,
  IAdtError,
  IAdtHeaders,
  IAdtLockedWrite,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IAnalyse,
  IProgramConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyNotMeasuredRefusal,
  noDeletionCheck,
  noTransportResource,
} from '../shared/refusalLegacy';

export class AdtProgramLegacy<
  T extends ProgramValues = ResultValuesOf<typeof programDocuments>,
> extends AdtProgram<T, 'basis740'> {
  /**
   * Delete program — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a program. Without a handle SAP answered `400`
   * "Parameter lockHandle could not be found." for a program; the request still goes
   * and that answer reaches you.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override delete<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  override delete(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  override async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    const name = config.programName as string;

    const objectUrl = `${PROGRAM.uri(name)}`;
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
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  override checkDeletion(
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    return noDeletionCheck<T['deletionCheck'], E>();
  }

  /**
   * Refused without a request until measured: 7.40 SP04's type table lists no
   * `updateMetadata` for the program, and no run there has sent the PUT of its
   * metadata document.
   */
  override updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  override updateMetadata(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  override async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    _config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    return legacyNotMeasuredRefusal<T['metadataUpdated'], E>(
      'updateMetadata',
      'PUT /sap/bc/adt/programs/programs/{name}',
    );
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  override readTransport(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    return noTransportResource<T['transport'], E>(
      PROGRAM.uri(config.programName as string),
    );
  }
}
