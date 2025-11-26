/**
 * Internal utilities for ADT clients
 * These are private utilities used internally by client classes
 */

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
 * Limits description to 60 characters as per SAP ADT specification
 * SAP ADT has a maximum length of 60 characters for adtcore:description field
 * @param description - Description text
 * @returns Description limited to 60 characters
 */
export function limitDescription(description: string): string {
  return description.length > 60 ? description.substring(0, 60) : description;
}

