/**
 * Behavior Implementation validation
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AxiosError } from 'axios';
import { ACCEPT_VALIDATION_CLASS_NAME } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate behavior implementation class name
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 *
 * @param connection - SAP connection
 * @param className - Behavior implementation class name (e.g., ZBP_OK_I_CDS_TEST)
 * @param packageName - Package name
 * @param description - Description
 * @param behaviorDefinition - Behavior definition name (root entity)
 * @returns Validation response (returns error response if object already exists)
 */
/**
 * `packageName` is required by the endpoint, not optional. Measured * 2026-08-28: without `packagename` it answers **400,
 * "Parameter packagename could not be found."** — see
 * `docs/evidence/2026-08-28-validation-required-params.md`.
 */
export async function validateBehaviorImplementationName(
  connection: IAbapConnection,
  className: string,
  packageName: string,
  description?: string,
  behaviorDefinition?: string,
): Promise<IAdtWireResponse> {
  // Build query parameters for behavior implementation validation
  const params = new URLSearchParams({
    objname: className,
    objtype: 'CLAS/OC',
    packagename: packageName,
  });

  if (description) {
    // Description is limited to 60 characters in SAP ADT
    params.append('description', limitDescription(description));
  }

  if (behaviorDefinition) {
    params.append('behaviorDefinition', behaviorDefinition);
  }

  const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    Accept: ACCEPT_VALIDATION_CLASS_NAME,
  };

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
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });
}
