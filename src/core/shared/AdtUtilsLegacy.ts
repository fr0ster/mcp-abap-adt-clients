/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides methods that rely on endpoints absent from legacy /sap/bc/adt/discovery:
 * - getTableContents → /sap/bc/adt/datapreview/ddic (not available)
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle (not available)
 * - getTransaction → /sap/bc/adt/repository/informationsystem/objectproperties (not available)
 * - activateObjectsGroup → /sap/bc/adt/activation/runs (not available, uses /sap/bc/adt/activation)
 */

import type { IAdtResponse as AxiosResponse } from '@mcp-abap-adt/interfaces';
import { buildObjectUri } from '../../utils/activationUtils';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from './AdtUtils';
import type { IObjectReference } from './types';

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
  ): Promise<AxiosResponse> {
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

    return this.connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
      },
    });
  }

  override async getTableContents(): Promise<never> {
    throw new Error(
      unsupportedError('Table contents', '/sap/bc/adt/datapreview/ddic'),
    );
  }

  override async getSqlQuery(): Promise<never> {
    throw new Error(
      unsupportedError('SQL query', '/sap/bc/adt/datapreview/freestyle'),
    );
  }

  override async getTransaction(): Promise<never> {
    throw new Error(
      unsupportedError(
        'Transaction',
        '/sap/bc/adt/repository/informationsystem/objectproperties',
      ),
    );
  }
}
