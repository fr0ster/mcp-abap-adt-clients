/**
 * AdtClassLegacy - Class handler for legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Overrides:
 * - delete() — `DELETE <URI>?lockHandle=…` under the lock handle the caller
 *   holds, instead of the /sap/bc/adt/deletion/ API 7.40 SP04 lacks.
 *   `update` is the inherited stateless PUT; this class does not override it.
 * - checkDeletion() — refused without a request: 7.40 has no deletion API.
 * - updateMetadata() — refused without a request: not measured on 7.40.
 */

import {
  AdtClass,
  type AdtPerformedBy,
  answering,
  CLASS,
  type ClassValues,
  type classDocuments,
  type ResultValuesOf,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IClassConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyNotMeasuredRefusal,
  noDeletionCheck,
  noTransportResource,
} from '../shared/refusalLegacy';

export class AdtClassLegacy<
  T extends ClassValues = ResultValuesOf<typeof classDocuments>,
> extends AdtClass<T, 'basis740'> {
  /**
   * Delete class — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a class. Without a handle SAP answered `400`
   * "Parameter lockHandle could not be found." for a class; the request still goes
   * and that answer reaches you.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    const name = config.className as string;

    const objectUrl = `${CLASS.uri(name)}`;
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
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'deletionCheck'>,
    _config: Partial<IClassConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    return noDeletionCheck<T['deletionCheck'], E>();
  }

  /**
   * Refused without a request until measured: 7.40 SP04's type table lists no
   * `updateMetadata` for the class, and no run there has sent the PUT of its
   * metadata document.
   */
  override async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'updateMetadata'>,
    _config: Partial<IClassConfig>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    return legacyNotMeasuredRefusal<T['metadataUpdated'], E>(
      'updateMetadata',
      'PUT /sap/bc/adt/oo/classes/{name}',
    );
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'transport'>,
    config: Partial<IClassConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E>> {
    return noTransportResource<T['transport'], E>(
      CLASS.uri(config.className as string),
    );
  }
}
