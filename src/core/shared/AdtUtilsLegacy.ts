/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides methods that rely on endpoints absent from legacy /sap/bc/adt/discovery:
 * - getTableColumns → /sap/bc/adt/datapreview/ddic/{name}/metadata (not available)
 * - getTableContents → /sap/bc/adt/datapreview/ddic (not available)
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle (not available)
 * - activateObjectsGroup → /sap/bc/adt/activation/runs (not available, uses /sap/bc/adt/activation)
 *
 * A fourth override refused `getTransaction`
 * (/sap/bc/adt/repository/informationsystem/objectproperties, also absent). It
 * went with the base method, which nobody called: the only code that ever
 * mentioned `getTransaction` was its own doc comment and this refusal of it.
 */

import {
  AdtObjectErrorCodes,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtResponse,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { buildObjectUri } from '../../utils/activationUtils';
import { answering, failed } from '../../utils/adtResponse';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from './AdtUtils';
import type {
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IObjectReference,
} from './types';
import type { IUtilResults, utilDocuments } from './utilResultSet';

function unsupportedError(operation: string, endpoint: string): string {
  return (
    `${operation} is not supported on this SAP system (legacy, BASIS < 7.50). ` +
    `The required endpoint ${endpoint} was not found in the system's ` +
    `ADT discovery catalog (/sap/bc/adt/discovery).`
  );
}

export class AdtUtilsLegacy<
  R extends IUtilResults = typeof utilDocuments,
> extends AdtUtils<R> {
  /**
   * Legacy group activation — synchronous POST to /sap/bc/adt/activation
   *
   * Modern systems use async /sap/bc/adt/activation/runs with polling.
   * Legacy systems use synchronous /sap/bc/adt/activation — response contains result directly.
   *
   * Read through the same `activation` slot as the modern run. The default keeps
   * the document, which here is the result itself; `utilActivationRunId` would
   * find no run id in it and answer `''`, so a caller on a legacy system does
   * not pass that one.
   */
  override async activateObjectsGroup<E extends IAdtError = IAdtError>(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`;

    const objectReferences = objects
      .map((obj) => {
        const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
      })
      .join('\n');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

    return answering(
      () =>
        this.connection.makeAdtRequest({
          url,
          method: 'POST',
          timeout: getTimeout('default'),
          data: xmlBody,
          headers: {
            Accept: 'application/xml',
            'Content-Type': 'application/xml',
          },
        }),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /**
   * Refused, and answered as a failure rather than thrown.
   *
   * The contract says a member answers `IAdtResponse`; a caller branches on `ok`
   * and reads `getError()`. Throwing here would make one implementation of a
   * member behave unlike the other for reasons the caller cannot see in the
   * type — the substitution decision 13 is about, broken by the half that is
   * meant to be interchangeable.
   *
   * `origin` is `'refusal'` with `UNSUPPORTED_OPERATION`: this system's
   * discovery catalogue does not list the endpoint, so the operation is not
   * offered here. It was `'connection'`, which tells a caller to reauthenticate
   * or restore reachability over a request that was never sent — nothing about
   * the connection failed.
   *
   * No request is made, so there is no answer for the caller's `analyse` to
   * read; the option is accepted for the contract's shape.
   */
  override async getTableColumns<E extends IAdtError = IAdtError>(
    _tableName: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['columns']>, E>> {
    return this.refuse(
      'Table columns',
      '/sap/bc/adt/datapreview/ddic/{name}/metadata',
    );
  }

  override async getTableContents<E extends IAdtError = IAdtError>(
    _params: IGetTableContentsParams,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['contents']>, E>> {
    return this.refuse('Table contents', '/sap/bc/adt/datapreview/ddic');
  }

  override async getSqlQuery<E extends IAdtError = IAdtError>(
    _params: IGetSqlQueryParams,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['query']>, E>> {
    return this.refuse('SQL query', '/sap/bc/adt/datapreview/freestyle');
  }

  private refuse<T, E extends IAdtError>(
    operation: string,
    endpoint: string,
  ): IAdtResponse<T, E> {
    // The library's own verdict, so `E` is its default `IAdtError` here — the
    // same cast `answering` makes when no strategy supplied one.
    return failed<T, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message: unsupportedError(operation, endpoint),
    } as E);
  }
}
