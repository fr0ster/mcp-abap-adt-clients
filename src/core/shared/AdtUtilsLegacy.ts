/**
 * AdtUtilsLegacy - Utility operations for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides methods that rely on endpoints absent from legacy /sap/bc/adt/discovery:
 * - getTableContents → /sap/bc/adt/datapreview/ddic (not available)
 * - getSqlQuery → /sap/bc/adt/datapreview/freestyle (not available)
 * - getTransaction → /sap/bc/adt/repository/informationsystem/objectproperties (not available)
 */

import { AdtUtils } from './AdtUtils';

function unsupportedError(operation: string, endpoint: string): string {
  return (
    `${operation} is not supported on this SAP system (legacy, BASIS < 7.50). ` +
    `The required endpoint ${endpoint} was not found in the system's ` +
    `ADT discovery catalog (/sap/bc/adt/discovery).`
  );
}

export class AdtUtilsLegacy extends AdtUtils {
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
