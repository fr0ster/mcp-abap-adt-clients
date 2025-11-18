/**
 * Shared validation utilities for SAP object names
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

export interface ValidationResult {
  valid: boolean;
  severity?: 'ERROR' | 'WARNING' | 'INFO';
  message?: string;
  longText?: string;
}

/**
 * Validate object name using SAP ADT validation endpoint
 *
 * @param connection - ABAP connection
 * @param objectType - SAP object type (e.g., 'FUGR/FF', 'CLAS/OC', 'PROG/P')
 * @param objectName - Name to validate
 * @param additionalParams - Additional validation parameters (e.g., fugrname, description)
 * @returns ValidationResult with status and messages
 */
export async function validateObjectName(
  connection: AbapConnection,
  objectType: string,
  objectName: string,
  additionalParams?: Record<string, string>
): Promise<ValidationResult> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(objectName);

  // Build query parameters
  const params = new URLSearchParams({
    objtype: objectType,
    objname: encodedName,
    ...additionalParams
  });

  const url = `${baseUrl}/sap/bc/adt/functions/validation?${params.toString()}`;

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      headers: {
        'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage'
      }
    });

    // Parse validation response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const result = parser.parse(response.data);

    const data = result['asx:abap']?.['asx:values']?.['DATA'];
    if (data) {
      const severity = data['SEVERITY'] as 'ERROR' | 'WARNING' | 'INFO';
      const shortText = data['SHORT_TEXT'];
      const longText = data['LONG_TEXT'];

      return {
        valid: severity !== 'ERROR',
        severity,
        message: shortText,
        longText
      };
    }

    // No validation data means name is valid
    return { valid: true };

  } catch (error: any) {
    // If validation endpoint returns 404, it may not be supported in this SAP version
    if (error.response?.status === 404) {
      // Silently pass - older SAP systems may not have validation endpoint
      return { valid: true };
    }

    // For 400 errors, try to extract meaningful error message
    if (error.response?.status === 400) {
      let errorMessage = 'Validation request failed with status 400';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          // Try to parse XML error
          try {
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
            const parsed = parser.parse(error.response.data);
            const errorText = parsed['exc:exception']?.message?.['#text'] ||
                             parsed['exc:exception']?.message ||
                             parsed['exc:exception']?.reason?.['#text'] ||
                             parsed['exc:exception']?.reason;
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {
            // Not XML, use raw message
            errorMessage = error.response.data.substring(0, 200);
          }
        } else if (typeof error.response.data === 'object') {
          errorMessage = JSON.stringify(error.response.data).substring(0, 200);
        }
      }

      // If validation is not supported for this object type, return valid (skip validation)
      const errorMsgLower = errorMessage.toLowerCase();
      if (errorMsgLower.includes('not supported') ||
          (errorMsgLower.includes('object type') && errorMsgLower.includes('not supported'))) {
        return { valid: true }; // Skip validation if not supported
      }

      return {
        valid: false,
        severity: 'ERROR',
        message: errorMessage
      };
    }

    // For other errors, check if it's about unsupported object type
    const errorMsg = error.message || '';
    if (errorMsg.toLowerCase().includes('not supported') ||
        (errorMsg.toLowerCase().includes('object type') && errorMsg.toLowerCase().includes('not supported'))) {
      return { valid: true }; // Skip validation if not supported
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
 * Validate and throw error if name is invalid
 * Useful for enforcing validation before object creation
 */
export async function validateAndThrow(
  validationResult: ValidationResult,
  objectType: string
): Promise<void> {
  if (!validationResult.valid) {
    throw new Error(`${objectType} name validation failed: ${validationResult.message}`);
  }

  // Also throw on critical warnings (SAP naming range violations)
  if (validationResult.severity === 'WARNING' && validationResult.message) {
    if (
      validationResult.message.includes('reserved for SAP') ||
      validationResult.message.includes('naming range') ||
      validationResult.message.includes('Y_ or Z_')
    ) {
      throw new Error(`${objectType} name validation failed: ${validationResult.message}. Use Y_ or Z_ prefix (with underscore).`);
    }
  }
}

