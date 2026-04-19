/**
 * AuthorizationField (SUSO / AUTH) check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_CHECK_MESSAGES,
  CT_AUTHORIZATION_FIELD,
  CT_CHECK_OBJECTS,
} from '../../constants/contentTypes';
import { parseCheckRunResponse } from '../../utils/checkRun';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check authorization field via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 *
 * When xmlContent is supplied, the request validates the unsaved payload
 * (same XML that will be PUT), attaching it as a base64 artifact. Otherwise
 * the server re-reads the object by URI and checks the persisted version.
 *
 * The helper runCheckRun() doesn't know the auth URI scheme, so we build
 * the payload inline for both modes.
 */
export async function checkAuthorizationField(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive',
  xmlContent?: string,
): Promise<AxiosResponse> {
  if (!name) {
    throw new Error('Authorization field name is required');
  }

  const encoded = encodeSapObjectName(name.toUpperCase());
  const uri = `/sap/bc/adt/aps/iam/auth/${encoded}`;

  let xmlBody: string;
  if (xmlContent) {
    const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${uri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${CT_AUTHORIZATION_FIELD}" chkrun:uri="${uri}">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
  } else {
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${uri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
  }

  const response = await connection.makeAdtRequest({
    url: '/sap/bc/adt/checkruns?reporters=abapCheckRun',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_CHECK_MESSAGES,
      'Content-Type': CT_CHECK_OBJECTS,
    },
  });

  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Authorization field check failed: ${errorMessages}`);
  }

  return response;
}
