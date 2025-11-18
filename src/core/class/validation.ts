/**
 * Class validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { ValidationResult } from '../shared/validation';
import { runCheckRunWithSource, parseCheckRunResponse } from '../shared/checkRun';

// Re-export ValidationResult for convenience
export type { ValidationResult } from '../shared/validation';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  error: debugEnabled ? console.error : () => {},
};

/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 */
export async function validateClassName(
  connection: AbapConnection,
  className: string,
  packageName?: string,
  description?: string,
  superClass?: string
): Promise<ValidationResult> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(className);

  // Build query parameters for class validation
  const params = new URLSearchParams({
    objname: encodedName,
    objtype: 'CLAS/OC'
  });

  if (packageName) {
    params.append('packagename', packageName);
  }

  if (description) {
    params.append('description', description);
  }

  if (superClass) {
    params.append('superClass', superClass);
  }

  const url = `${baseUrl}/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check'
  };

  // Log request details for debugging
  logger.debug(`[DEBUG] Validating class - URL: ${url}`);
  logger.debug(`[DEBUG] Validating class - Method: POST`);
  logger.debug(`[DEBUG] Validating class - Headers:`, JSON.stringify(headers, null, 2));
  logger.debug(`[DEBUG] Validating class - Query params:`, params.toString());

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      headers
    });

    logger.debug(`[DEBUG] Validation response - Status: ${response.status}`);
    logger.debug(`[DEBUG] Validation response - Data:`, typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500));

    // Parse response data - Eclipse returns XML with CHECK_RESULT
    if (response.data) {
      const responseData = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text'
        });
        const result = parser.parse(responseData);

        // Check for validation result in Eclipse format:
        // <asx:abap><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>
        const checkResult = result?.['asx:abap']?.['asx:values']?.['DATA']?.['CHECK_RESULT'];

        if (checkResult === 'X') {
          logger.debug(`[DEBUG] Validation succeeded - CHECK_RESULT=X`);
          return { valid: true };
        }

        // Check if response contains exception/error
        const exception = result['exc:exception'];
        if (exception) {
          // Extract message
          let message = '';
          if (exception['message']) {
            if (typeof exception['message'] === 'string') {
              message = exception['message'];
            } else if (exception['message']['#text']) {
              message = exception['message']['#text'];
            } else if (Array.isArray(exception['message']) && exception['message'][0]?.['#text']) {
              message = exception['message'][0]['#text'];
            }
          }

          // Fallback to localizedMessage
          if (!message && exception['localizedMessage']) {
            if (typeof exception['localizedMessage'] === 'string') {
              message = exception['localizedMessage'];
            } else if (exception['localizedMessage']['#text']) {
              message = exception['localizedMessage']['#text'];
            } else if (Array.isArray(exception['localizedMessage']) && exception['localizedMessage'][0]?.['#text']) {
              message = exception['localizedMessage'][0]['#text'];
            }
          }

          logger.debug(`[DEBUG] Validation failed - Exception: ${message}`);
          return {
            valid: false,
            severity: 'ERROR',
            message: message || 'Validation failed',
            longText: message
          };
        }
      } catch (parseError) {
        logger.debug(`[DEBUG] Failed to parse validation response:`, parseError);
      }
    }

    // If no CHECK_RESULT found but no exception, assume valid
    logger.debug(`[DEBUG] Validation succeeded - no exceptions found`);
    return { valid: true };

  } catch (error: any) {
    // Log error details for debugging
    if (error.response) {
      logger.error(`[ERROR] Validation failed - Status: ${error.response.status}`);
      logger.error(`[ERROR] Validation failed - StatusText: ${error.response.statusText}`);
      logger.error(`[ERROR] Validation failed - Response headers:`, JSON.stringify(error.response.headers, null, 2));
      logger.error(`[ERROR] Validation failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000));
    }

    // Parse error response to extract validation message
    if (error.response?.data) {
      const responseData = typeof error.response.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response.data);

      // Try to parse XML error response
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text'
        });
        const result = parser.parse(responseData);

        const exception = result['exc:exception'];
        if (exception) {
          // Extract message - XML structure: <message lang="EN">text</message>
          let message = '';
          if (exception['message']) {
            if (typeof exception['message'] === 'string') {
              message = exception['message'];
            } else if (exception['message']['#text']) {
              message = exception['message']['#text'];
            } else if (Array.isArray(exception['message']) && exception['message'][0]?.['#text']) {
              message = exception['message'][0]['#text'];
            }
          }

          // Fallback to localizedMessage
          if (!message && exception['localizedMessage']) {
            if (typeof exception['localizedMessage'] === 'string') {
              message = exception['localizedMessage'];
            } else if (exception['localizedMessage']['#text']) {
              message = exception['localizedMessage']['#text'];
            } else if (Array.isArray(exception['localizedMessage']) && exception['localizedMessage'][0]?.['#text']) {
              message = exception['localizedMessage'][0]['#text'];
            }
          }

          const type = typeof exception['type'] === 'string'
            ? exception['type']
            : exception['type']?.['#text'] || exception['type']?.['@_id'] || '';

          return {
            valid: false,
            severity: 'ERROR',
            message: message || 'Validation failed',
            longText: message
          };
        }
      } catch (parseError) {
        // If parsing fails, use raw response
      }

      // Extract error message from response
      const errorMatch = responseData.match(/<message[^>]*>([^<]+)<\/message>/i);
      const message = errorMatch ? errorMatch[1] : 'Validation failed';

      return {
        valid: false,
        severity: 'ERROR',
        message: message,
        longText: responseData.substring(0, 500)
      };
    }

    // If validation endpoint returns 404, it may not be supported in this SAP version
    if (error.response?.status === 404) {
      // Silently pass - older SAP systems may not have validation endpoint
      return { valid: true };
    }

    // For other errors, return as validation failure
    return {
      valid: false,
      severity: 'ERROR',
      message: error.message || 'Validation request failed'
    };
  }
}

/**
 * Validate class source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing class code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing class in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export async function validateClassSource(
  connection: AbapConnection,
  className: string,
  sourceCode?: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Live validation with artifacts (code not saved to SAP)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (without artifacts)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Source validation failed: ${checkResult.message}`);
  }

  return response;
}
