/**
 * Metadata Extension Validation
 *
 * Validates parameters before creating a metadata extension (DDLX)
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddlx/sources/validation
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AxiosError } from 'axios';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { IMetadataExtensionValidationParams } from './types';

/**
 * Validate metadata extension parameters
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/validation
 *
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Raw IAdtWireResponse from ADT validation endpoint (returns error response if object already exists)
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateMetadataExtension(
  connection: IAbapConnection,
  params: IMetadataExtensionValidationParams,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/ddic/ddlx/sources/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'ddlxex',
    objname: params.name,
    description: params.description || params.name,
    packagename: params.packageName,
  });

  // No status is read here, and none is turned into a verdict.
  //
  // This used to catch a `400` and hand the response back as a success, on the
  // reasoning that a taken name is an answer rather than a transport failure.
  // It is an answer — but saying so is the caller's, and the code was saying it
  // for them, from one status.
  //
  // Recorded in `corpus/adt/`: the same question answers `400` with an
  // `exc:exception` for a class, a domain and a table, and `200` with
  // `<SEVERITY>ERROR</SEVERITY>` for a DDL source and a function group. One
  // status cannot be the rule, and this package no longer offers one. The
  // exchange reaches `analyse` whole either way — `answering` keeps the
  // response off the error — so a caller who reads a taken name as a success
  // says so there.
  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
