/**
 * Enhancement check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  type EnhancementType,
  getEnhancementUri,
  type ICheckEnhancementParams,
  supportsSourceCode,
} from './types';

/**
 * Check enhancement syntax/consistency
 *
 * @param connection - SAP connection
 * @param params - Check parameters
 * @returns Axios response with check result
 */
export async function checkEnhancement(
  connection: IAbapConnection,
  params: ICheckEnhancementParams,
): Promise<AxiosResponse> {
  const {
    enhancement_name,
    enhancement_type,
    version = 'inactive',
    source_code,
  } = params;

  if (!enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!enhancement_type) {
    throw new Error('enhancement_type is required');
  }

  const encodedName = encodeSapObjectName(enhancement_name).toLowerCase();
  const objectUri = getEnhancementUri(enhancement_type, encodedName);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';

  // Build check run request
  const checkUrl = `/sap/bc/adt/checkruns`;

  // Build check run XML with or without source code artifacts
  let artifactsXml = '';
  if (source_code && supportsSourceCode(enhancement_type)) {
    // Include source code for live validation (base64 encoded)
    const base64Source = Buffer.from(source_code, 'utf-8').toString('base64');
    artifactsXml = `
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${objectUri}/source/main">
        ${base64Source}
      </chkrun:artifact>
    </chkrun:artifacts>`;
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunRequest xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:reporters>
    <chkrun:reporter chkrun:name="abapCheckRun"/>
  </chkrun:reporters>
  <chkrun:objectSets>
    <chkrun:objectSet>
      <chkrun:objects>
        <chkrun:object adtcore:uri="${objectUri}" chkrun:version="${versionParam}"/>
      </chkrun:objects>
    </chkrun:objectSet>
  </chkrun:objectSets>${artifactsXml}
</chkrun:checkRunRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.checkrun.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.checkrun.v1+xml',
  };

  return connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Convenience function: Check enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param version - 'active' or 'inactive' (default: 'inactive')
 * @param sourceCode - Optional source code for live validation
 * @returns Axios response
 */
export async function check(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  version: 'active' | 'inactive' = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  return checkEnhancement(connection, {
    enhancement_name: enhancementName,
    enhancement_type: enhancementType,
    version,
    source_code: sourceCode,
  });
}
