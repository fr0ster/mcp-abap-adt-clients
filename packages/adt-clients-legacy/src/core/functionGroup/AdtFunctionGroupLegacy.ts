/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 * activate() sends the group alone, as before: its main program as a second
 * reference is measured on S/4HANA 2025 and ABAP cloud only.
 * read() and update() of the group's source (`source/main`) are the base
 * class's, inherited: on 7.40 SP04 the GET with `Accept: text/plain` answered
 * `200 text/plain` (the main program) and the PUT under the caller's lock
 * handle with `Content-Type: text/plain; charset=utf-8` answered `200`.
 */

import {
  AdtFunctionGroup,
  type AdtPerformedBy,
  answering,
  FUNCTION_GROUP,
  type functionGroupDocuments,
  requestHeaders,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IFunctionGroupConfig,
  IFunctionGroupResults,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck, noTransportResource } from '../shared/refusalLegacy';

export class AdtFunctionGroupLegacy<
  R extends IFunctionGroupResults = typeof functionGroupDocuments,
> extends AdtFunctionGroup<R, 'basis740'> {
  /**
   * Delete function group — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a function group. Without a handle SAP answered `400`
   * "Parameter lockHandle could not be found." for a function group; the request still goes
   * and that answer reaches you.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.functionGroupName as string;

    const objectUrl = FUNCTION_GROUP.uri(name);
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
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5). `delete` with
   * the object's lock handle is the delete.
   */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'deletionCheck'>,
    _config: Partial<IFunctionGroupConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'transport'>,
    config: Partial<IFunctionGroupConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    return noTransportResource<ReturnType<R['transport']>, E>(
      FUNCTION_GROUP.uri(config.functionGroupName as string),
    );
  }

  /**
   * Activate the group alone — the request the modern class sent before it
   * added the group's main program (`FUGR/I SAPL<group>`) as a second
   * reference. That second reference is measured on S/4HANA 2025 and ABAP
   * cloud; on 7.40 it is not sent, so the single reference stays. Measured on
   * 7.40 SP04 in `$TMP`: after a write of the group's source, this one
   * reference activated the group and its main program both.
   */
  override async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = config.functionGroupName as string;
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${FUNCTION_GROUP.uri(name)}" adtcore:name="${name}"/>
</adtcore:objectReferences>`;

    return answering(
      () =>
        connection.makeAdtRequest({
          url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
          method: 'POST',
          timeout: 0,
          data: xmlPayload,
          headers: requestHeaders(options.headers),
        }),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }
}
