/**
 * AdtMessageClassLegacy - message class handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * Overrides:
 * - checkDeletion() — refused without a request: 7.40 has no deletion API.
 * - delete() — `DELETE <URI>?lockHandle=…` under the lock handle the caller
 *   holds (measured on 7.40 SP04: `200`, the name is free afterwards; record
 *   B4-cycles-20261026-2019).
 * - updateMetadata() — refused without a request until its document is
 *   measured: the PUT answered `400 ExceptionInvalidData` on 7.40 SP04, which
 *   expects another root element (same record).
 */

import {
  AdtMessageClass,
  answering,
  MESSAGE_CLASS,
  type messageClassDocuments,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IMessageClassConfig,
  IMessageClassResults,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyMeasuredRefusal,
  noDeletionCheck,
} from '../shared/refusalLegacy';

export class AdtMessageClassLegacy<
  R extends IMessageClassResults = typeof messageClassDocuments,
> extends AdtMessageClass<R> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IMessageClassConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }

  /**
   * Delete message class — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when given. The lock is yours: pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: `200`, and the name is
   * free afterwards.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const objectUrl = MESSAGE_CLASS.uri(config.name as string);
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

  /**
   * Refused without a request: the PUT of the message class's document
   * answered `400 ExceptionInvalidData` on 7.40 SP04, which expects another
   * root element; until that document is measured it is not sent.
   */
  override async updateMetadata<E extends IAdtError = IAdtError>(
    _config: Partial<IMessageClassConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    return legacyMeasuredRefusal<ReturnType<R['metadataUpdated']>, E>(
      'updateMetadata',
      'PUT of the message class document answers 400 ExceptionInvalidData (7.40 expects another root element).',
    );
  }
}
