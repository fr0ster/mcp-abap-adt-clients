/**
 * Internal utilities for ADT clients
 * These are private utilities used internally by client classes
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

type AdtHeaderValue = IAdtResponse['headers'][string];

/**
 * Encodes SAP object names for use in URLs
 * Handles namespaces with forward slashes that need to be URL encoded
 * @param objectName - The SAP object name (e.g., '/1CPR/CL_000_0SAP2_FAG')
 * @returns URL-encoded object name
 */
export function encodeSapObjectName(objectName: string): string {
  return encodeURIComponent(objectName);
}

/**
 * Builds a URL query string with proper encoding of special characters.
 * Axios default serializer does not encode $ (and other sub-delimiters),
 * which causes ERR_UNESCAPED_CHARACTERS in Node.js for names like $TMP.
 * URLSearchParams encodes all non-alphanumeric characters correctly.
 * @param params - Key-value pairs for query parameters (undefined values are omitted)
 * @returns Encoded query string without leading '?'
 */
export function buildQueryString(
  params: Record<string, string | boolean | number | undefined>,
): string {
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      entries.push([key, String(value)]);
    }
  }
  return new URLSearchParams(entries).toString();
}

/**
 * Limits description to 60 characters as per SAP ADT specification
 * SAP ADT has a maximum length of 60 characters for adtcore:description field
 * @param description - Description text
 * @returns Description limited to 60 characters
 */
export function limitDescription(description: string): string {
  return description.length > 60 ? description.substring(0, 60) : description;
}

export function headerValueToString(
  value: AdtHeaderValue | undefined,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    return String(value[0]);
  }
  if (typeof value === 'object') {
    return undefined;
  }
  return String(value);
}

/**
 * Safely extracts error message from any error object.
 * Prevents circular reference issues when logging AxiosError or other HTTP errors.
 * @param error - Any error object (AxiosError, Error, string, unknown)
 * @returns Safe string representation of the error
 */
export function safeErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const e = error as Record<string, unknown>;

  // Extract HTTP response details if available (AxiosError)
  if (e.response && typeof e.response === 'object') {
    const resp = e.response as Record<string, unknown>;
    const status = resp.status;
    const statusText = resp.statusText || '';
    const data = resp.data;

    if (typeof data === 'string' && data.length > 0) {
      return `HTTP ${status} ${statusText}: ${data.substring(0, 500)}`;
    }

    if (status) {
      const msg = typeof e.message === 'string' ? e.message : '';
      return `HTTP ${status} ${statusText}${msg ? `: ${msg}` : ''}`;
    }
  }

  // Standard Error object
  if (typeof e.message === 'string' && e.message.length > 0) {
    return e.message;
  }

  return String(error);
}

/**
 * Safely stringify any value, handling circular references.
 * Use instead of JSON.stringify() on values that may contain circular references
 * (e.g., Axios response data, HTTP error objects).
 * @param value - Any value to stringify
 * @param maxLength - Maximum length of the result (default 500)
 * @returns JSON string or fallback string representation
 */
export function safeStringify(value: unknown, maxLength = 500): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.substring(0, maxLength);

  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }).substring(0, maxLength);
  } catch {
    return String(value).substring(0, maxLength);
  }
}
