/**
 * Shared check run utilities
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_CHECK_MESSAGES,
  CT_CHECK_OBJECTS,
} from '../constants/contentTypes';
import { encodeSapObjectName } from './internalUtils';
import { getTimeout } from './timeouts';

/**
 * Get ADT URI for object type
 */
export function getObjectUri(objectType: string, objectName: string): string {
  const encodedName = encodeSapObjectName(objectName.toLowerCase());

  switch (objectType.toLowerCase()) {
    case 'class':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'function_group':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'function_module':
    case 'fugr/ff': {
      // Function module needs function group in format: "FUGR_NAME/FM_NAME"
      if (!objectName.includes('/')) {
        throw new Error(
          'Function module requires function group. Use format: "functionGroupName/functionModuleName"',
        );
      }
      const [fugrName, fmName] = objectName.split('/');
      const encodedFugr = encodeSapObjectName(fugrName.toLowerCase());
      const encodedFm = encodeSapObjectName(fmName.toLowerCase());
      return `/sap/bc/adt/functions/groups/${encodedFugr}/fmodules/${encodedFm}`;
    }
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'metadata_extension':
    case 'ddlx/ex':
      return `/sap/bc/adt/ddic/ddlx/sources/${encodedName}`;
    case 'domain':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'data_element':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    case 'service_definition':
    case 'srvd/srv':
      return `/sap/bc/adt/ddic/srvd/sources/${encodedName}`;
    case 'scalar_function':
    case 'dsfd/scf':
      return `/sap/bc/adt/ddic/dsfd/sources/${encodedName}`;
    case 'scalar_function_implementation':
    case 'dsfi/sfi':
      return `/sap/bc/adt/ddic/dsfi/${encodedName}`;
    case 'append_structure':
    case 'tabl/ds':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'access_control':
    case 'dcls/dl':
      return `/sap/bc/adt/acm/dcl/sources/${encodedName}`;
    case 'transformation':
    case 'xslt/vt':
      return `/sap/bc/adt/xslt/transformations/${encodedName}`;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

/**
 * Build check run XML payload
 */
/**
 * Build XML body for checkRun request (checks code already in SAP system)
 *
 * Format: Simple URI + version
 * - version="inactive": Checks saved but not activated code
 * - version="active": Checks activated code
 *
 * SAP reads the code from system itself.
 */
/**
 * Which stored version of an object a check run should look at.
 *
 * - `active`   — the activated version.
 * - `inactive` — saved but not yet activated.
 * - `new`      — created and never activated, so no inactive version exists
 *                either. This is what ADT itself sends while an object is
 *                still being written: the trace of an Eclipse session creating
 *                an append structure shows `chkrun:version="new"` on every
 *                as-you-type check.
 *
 * Previously this was a bare `string` defaulting to `'active'`, and only the
 * first two were documented — so `new` was reachable but unnamed, which is a
 * poor way to offer a choice.
 */
export type CheckRunVersion = 'active' | 'inactive' | 'new';

export function buildCheckRunXml(
  objectUri: string,
  version: CheckRunVersion = 'active',
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
}

/**
 * Build XML body for checkRun request with source code (live validation)
 *
 * Used for checking code that hasn't been saved to SAP yet.
 * SAP will validate the provided source code instead of reading from system.
 *
 * @param objectUri - ADT URI of the object (e.g., /sap/bc/adt/oo/classes/zcl_test)
 * @param sourceCode - Source code to validate
 * @param version - 'active' or 'inactive' (typically 'active' for live validation)
 */
export function buildCheckRunXmlWithSource(
  objectUri: string,
  sourceCode: string,
  version: CheckRunVersion = 'active',
  artifactContentType: string = 'text/plain; charset=utf-8',
): string {
  // Encode source code to base64
  const base64Source = Buffer.from(sourceCode, 'utf-8').toString('base64');

  return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${artifactContentType}" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
}

/**
 * Run check run for any object type
 */
export async function runCheckRun(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
  version: CheckRunVersion = 'active',
  reporter: string = 'abapCheckRun',
  sourceCode?: string,
  artifactContentType: string = 'text/plain; charset=utf-8',
): Promise<IAdtWireResponse> {
  const objectUri = getObjectUri(objectType, objectName);
  const xmlBody = sourceCode
    ? buildCheckRunXmlWithSource(
        objectUri,
        sourceCode,
        version,
        artifactContentType,
      )
    : buildCheckRunXml(objectUri, version);

  const headers = {
    Accept: ACCEPT_CHECK_MESSAGES,
    'Content-Type': CT_CHECK_OBJECTS,
  };

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}

/**
 * Run a check on an object with unsaved source code (live validation).
 *
 * This function validates source code that hasn't been saved to SAP yet,
 * similar to real-time validation in Eclipse ADT editor during typing.
 *
 * @param connection - The ABAP connection
 * @param objectType - Type of object (e.g., 'class', 'program')
 * @param objectName - Name of the object
 * @param sourceCode - The source code to validate
 * @param version - Version to validate against ('active' or 'inactive')
 * @param reporter - Reporter type for check results
 * @param sessionId - Optional session ID for session-based requests
 * @returns Promise resolving to IAdtWireResponse with check results
 */
export async function runCheckRunWithSource(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
  sourceCode: string,
  version: CheckRunVersion = 'active',
  reporter: string = 'abapCheckRun',
  artifactContentType: string = 'text/plain; charset=utf-8',
): Promise<IAdtWireResponse> {
  const objectUri = await getObjectUri(objectType, objectName);
  const xmlBody = buildCheckRunXmlWithSource(
    objectUri,
    sourceCode,
    version,
    artifactContentType,
  );

  const headers = {
    Accept: ACCEPT_CHECK_MESSAGES,
    'Content-Type': CT_CHECK_OBJECTS,
  };

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
