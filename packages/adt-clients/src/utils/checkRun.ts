/**
 * Shared check run utilities
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { IAdtGroupReference } from '../core/shared/codeSets';
import type { AdtAddressableCode } from '../endpoints/codes';
import { buildObjectUri } from './activationUtils';
import { requestHeaders } from './requestHeaders';

/**
 * The ADT URI a check run names: the object's address from the type tables.
 * A function module names its group as `parentName`, where it used to be
 * folded into the name as `GROUP/FM` — which a namespaced name, holding
 * slashes of its own, could not survive.
 */
export function getObjectUri(
  objectType: AdtAddressableCode,
  objectName: string,
  parentName?: string,
): string {
  return buildObjectUri(objectName, objectType, parentName);
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
  headers: IAdtHeaders,
  object: IAdtGroupReference<AdtAddressableCode>,
  version: CheckRunVersion = 'active',
  reporter: string = 'abapCheckRun',
  sourceCode?: string,
  artifactContentType: string = 'text/plain; charset=utf-8',
): Promise<IAdtWireResponse> {
  const objectUri = getObjectUri(object.type, object.name, object.parentName);
  const xmlBody = sourceCode
    ? buildCheckRunXmlWithSource(
        objectUri,
        sourceCode,
        version,
        artifactContentType,
      )
    : buildCheckRunXml(objectUri, version);

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}

/**
 * Run a check on an object with unsaved source code (live validation).
 *
 * This function validates source code that hasn't been saved to SAP yet,
 * similar to real-time validation in Eclipse ADT editor during typing.
 *
 * @param connection - The ABAP connection
 * @param object - The object: its code of the type tables, its name and, for a function module, its group
 * @param sourceCode - The source code to validate
 * @param version - Version to validate against ('active' or 'inactive')
 * @param reporter - Reporter type for check results
 * @param sessionId - Optional session ID for session-based requests
 * @returns Promise resolving to IAdtWireResponse with check results
 */
export async function runCheckRunWithSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  object: IAdtGroupReference<AdtAddressableCode>,
  sourceCode: string,
  version: CheckRunVersion = 'active',
  reporter: string = 'abapCheckRun',
  artifactContentType: string = 'text/plain; charset=utf-8',
): Promise<IAdtWireResponse> {
  const objectUri = getObjectUri(object.type, object.name, object.parentName);
  const xmlBody = buildCheckRunXmlWithSource(
    objectUri,
    sourceCode,
    version,
    artifactContentType,
  );

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
