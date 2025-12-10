/**
 * Interface update operations - DEPRECATED
 * Use InterfaceBuilder.update() instead
 */

import { encodeSapObjectName } from "../..";
import { getTimeout } from '../../utils/timeouts';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';


/**
 * Low-level: Upload interface source code (PUT)
 * Requires lock handle - does NOT lock/unlock
 */
export async function upload(
    connection: IAbapConnection,
    interfaceName: string,
    sourceCode: string,
    lockHandle: string,
    corrNr: string | undefined
  ): Promise<void> {
    let url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}/source/main?lockHandle=${lockHandle}`;
    if (corrNr) {
      url += `&corrNr=${corrNr}`;
    }
  
    await connection.makeAdtRequest({
      url,
      method: 'PUT',
      timeout: getTimeout('default'),
      data: sourceCode,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
