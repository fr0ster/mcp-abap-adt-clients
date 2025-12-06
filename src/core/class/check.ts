/**
 * Class check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';

/**
 * Check class code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active class: provide className, version='active', omit sourceCode
 * - Existing inactive class: provide className, version='inactive', omit sourceCode
 * - Hypothetical code: provide className, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
export async function checkClass(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../../utils/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun');
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun');
  }

  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  // Check both message and errors array for these messages
  const hasCheckedMessage = checkResult.message?.toLowerCase().includes('has been checked') ||
                            checkResult.message?.toLowerCase().includes('was checked') ||
                            checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

  if (hasCheckedMessage) {
    return response; // "has been checked" is a normal response, not an error
  }

  // Only throw error if there are actual problems (ERROR or WARNING)
  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}

/**
 * Check class local test class code (syntax, compilation, rules)
 *
 * Validates ABAP Unit test classes in the testclasses include.
 * This is separate from main class check because test classes use a different URI.
 *
 * @param connection - SAP connection
 * @param className - Class name (container class for the test)
 * @param testClassSource - Test class source code to validate
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export async function checkClassLocalTestClass(
  connection: IAbapConnection,
  className: string,
  testClassSource: string,
  version: 'active' | 'inactive' = 'inactive'
): Promise<AxiosResponse> {
  const { getTimeout } = await import('../../utils/timeouts');
  const { encodeSapObjectName } = await import('../../utils/internalUtils');
  const { parseCheckRunResponse } = await import('../../utils/checkRun');

  const encodedName = encodeSapObjectName(className.toLowerCase());
  const objectUri = `/sap/bc/adt/oo/classes/${encodedName}`;
  const testClassUri = `${objectUri}/includes/testclasses`;

  // Encode test class source to base64
  const base64Source = Buffer.from(testClassSource, 'utf-8').toString('base64');

  // Build XML with testclasses artifact
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${testClassUri}">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };

  const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });

  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  const hasCheckedMessage = checkResult.message?.toLowerCase().includes('has been checked') ||
                            checkResult.message?.toLowerCase().includes('was checked') ||
                            checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

  if (hasCheckedMessage && !checkResult.has_errors) {
    return response; // "has been checked" with no errors is a normal response
  }

  // Throw error if there are actual problems (ERROR type)
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err: any) => err.text).join('; ');
    throw new Error(`Test class check failed: ${errorMessages}`);
  }

  return response;
}

/**
 * Check class local types (implementations include)
 *
 * Validates local helper classes, interface definitions and type declarations
 * in the implementations include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export async function checkClassLocalTypes(
  connection: IAbapConnection,
  className: string,
  localTypesSource: string,
  version: 'active' | 'inactive' = 'inactive'
): Promise<AxiosResponse> {
  return checkClassInclude(connection, className, localTypesSource, 'implementations', version, 'Local types');
}

/**
 * Check class-relevant local types (definitions include)
 *
 * Validates type declarations needed for components in the private section
 * in the definitions include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export async function checkClassDefinitions(
  connection: IAbapConnection,
  className: string,
  definitionsSource: string,
  version: 'active' | 'inactive' = 'inactive'
): Promise<AxiosResponse> {
  return checkClassInclude(connection, className, definitionsSource, 'definitions', version, 'Definitions');
}

/**
 * Check class macros
 *
 * Validates macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
export async function checkClassMacros(
  connection: IAbapConnection,
  className: string,
  macrosSource: string,
  version: 'active' | 'inactive' = 'inactive'
): Promise<AxiosResponse> {
  return checkClassInclude(connection, className, macrosSource, 'macros', version, 'Macros');
}

/**
 * Generic function to check any class include file
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param includeSource - Include source code to validate
 * @param includeType - Type of include (implementations, definitions, macros, testclasses)
 * @param version - 'active' or 'inactive'
 * @param includeName - Human-readable name for error messages
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassInclude(
  connection: IAbapConnection,
  className: string,
  includeSource: string,
  includeType: 'implementations' | 'definitions' | 'macros' | 'testclasses',
  version: 'active' | 'inactive' = 'inactive',
  includeName: string
): Promise<AxiosResponse> {
  const { getTimeout } = await import('../../utils/timeouts');
  const { encodeSapObjectName } = await import('../../utils/internalUtils');
  const { parseCheckRunResponse } = await import('../../utils/checkRun');

  const encodedName = encodeSapObjectName(className.toLowerCase());
  const objectUri = `/sap/bc/adt/oo/classes/${encodedName}`;
  const includeUri = `${objectUri}/includes/${includeType}`;

  // Encode source to base64
  const base64Source = Buffer.from(includeSource, 'utf-8').toString('base64');

  // Build XML with include artifact
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${includeUri}">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };

  const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });

  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  const hasCheckedMessage = checkResult.message?.toLowerCase().includes('has been checked') ||
                            checkResult.message?.toLowerCase().includes('was checked') ||
                            checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

  if (hasCheckedMessage && !checkResult.has_errors) {
    return response; // "has been checked" with no errors is a normal response
  }

  // Throw error if there are actual problems (ERROR type)
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err: any) => err.text).join('; ');
    throw new Error(`${includeName} check failed: ${errorMessages}`);
  }

  return response;
}
