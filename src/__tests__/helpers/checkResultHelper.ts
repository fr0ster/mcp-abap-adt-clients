/**
 * Helper functions for validating check results in tests
 * 
 * Check results should be validated by checking for type "E" (Error) messages in XML response.
 * HTTP status code 200 is normal - errors are indicated by type "E" messages.
 * Warnings (type "W") are considered acceptable.
 */

import { parseCheckRunResponse } from '../../utils/checkRun';
import { AxiosResponse } from 'axios';

/**
 * Check result structure from parseCheckRunResponse
 */
export type CheckResult = ReturnType<typeof parseCheckRunResponse>;

/**
 * Validates check result by checking for type "E" (Error) messages.
 * HTTP status code 200 is normal - errors are indicated by type "E" messages in XML response.
 * 
 * @param checkResult - Parsed check result from parseCheckRunResponse
 * @param ignoreMessages - Optional array of message patterns to ignore (case-insensitive)
 * @returns true if check passed (no type E errors), false if has errors
 */
export function hasCheckErrors(
  checkResult: CheckResult | undefined,
  ignoreMessages: string[] = []
): boolean {
  if (!checkResult) {
    return false; // No result means no errors
  }

  // If no errors (type E), check passed
  if (checkResult.errors.length === 0) {
    return false;
  }

  // Check if all errors should be ignored
  const errorTexts = checkResult.errors.map(err => err.text || '').join(' ').toLowerCase();
  const shouldIgnore = ignoreMessages.some(pattern => 
    errorTexts.includes(pattern.toLowerCase())
  );

  return !shouldIgnore; // Return true if has errors that are not ignored
}

/**
 * Validates check result from AxiosResponse.
 * Parses response and checks for type "E" messages.
 * 
 * @param response - AxiosResponse from check operation
 * @param ignoreMessages - Optional array of message patterns to ignore (case-insensitive)
 * @returns true if check passed (no type E errors), false if has errors
 */
export function hasCheckErrorsFromResponse(
  response: AxiosResponse | undefined,
  ignoreMessages: string[] = []
): boolean {
  if (!response) {
    return false; // No response means no errors
  }

  const checkResult = parseCheckRunResponse(response);
  return hasCheckErrors(checkResult, ignoreMessages);
}

/**
 * Gets error messages from check result (type E only)
 * 
 * @param checkResult - Parsed check result
 * @returns Array of error messages
 */
export function getCheckErrorMessages(checkResult: CheckResult | undefined): string[] {
  if (!checkResult || checkResult.errors.length === 0) {
    return [];
  }

  return checkResult.errors.map(err => err.text).filter(Boolean);
}
