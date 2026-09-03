/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides methods that rely on endpoints absent from legacy /sap/bc/adt/discovery:
 * - getTableContents → /sap/bc/adt/datapreview/ddic (not available)
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle (not available)
 * - activateObjectsGroup → /sap/bc/adt/activation/runs (not available, uses /sap/bc/adt/activation)
 *
 * A fourth override refused `getTransaction`
 * (/sap/bc/adt/repository/informationsystem/objectproperties, also absent). It
 * went with the base method, which nobody called: the only code that ever
 * mentioned `getTransaction` was its own doc comment and this refusal of it.
 */

import type {
  IAdtResponse,
  IAdtResult,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { buildObjectUri } from '../../utils/activationUtils';
import { answering, failed } from '../../utils/adtResponse';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from './AdtUtils';
import type {
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IObjectReference,
} from './types';

function unsupportedError(operation: string, endpoint: string): string {
  return (
    `${operation} is not supported on this SAP system (legacy, BASIS < 7.50). ` +
    `The required endpoint ${endpoint} was not found in the system's ` +
    `ADT discovery catalog (/sap/bc/adt/discovery).`
  );
}

export class AdtUtilsLegacy extends AdtUtils {
  /**
   * Legacy group activation — synchronous POST to /sap/bc/adt/activation
   *
   * Modern systems use async /sap/bc/adt/activation/runs with polling.
   * Legacy systems use synchronous /sap/bc/adt/activation — response contains result directly.
   */
  override async activateObjectsGroup(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
  ): Promise<IAdtResponse<IAdtResult<IAdtWireResponse>>> {
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

    return answering(() =>
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
   * `origin` is `'connection'`: the endpoint is not there. That is the same
   * remedy as an unreachable host — a different system, not a different
   * question — and it is what separates this from a refusal, which is a server
   * answering about an object.
   */
  override async getTableContents(
    _params: IGetTableContentsParams,
  ): Promise<IAdtResponse<IAdtResult<IAdtWireResponse>>> {
    return this.refuse('Table contents', '/sap/bc/adt/datapreview/ddic');
  }

  override async getSqlQuery(
    _params: IGetSqlQueryParams,
  ): Promise<IAdtResponse<IAdtResult<IAdtWireResponse>>> {
    return this.refuse('SQL query', '/sap/bc/adt/datapreview/freestyle');
  }

  private refuse<T>(
    operation: string,
    endpoint: string,
  ): IAdtResponse<IAdtResult<T>> {
    return failed<T>({
      origin: 'connection',
      message: unsupportedError(operation, endpoint),
    });
  }
}
