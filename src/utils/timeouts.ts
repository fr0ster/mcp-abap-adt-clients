/**
 * Timeout utilities for ADT clients
 * 
 * Provides timeout configuration similar to connection package
 * but without dependency on connection package
 */

import type { ITimeoutConfig } from '@mcp-abap-adt/interfaces';

/**
 * Get timeout configuration from environment variables
 */
export function getTimeoutConfig(): ITimeoutConfig {
  const defaultTimeout = parseInt(process.env.SAP_TIMEOUT_DEFAULT || "45000", 10);
  const csrfTimeout = parseInt(process.env.SAP_TIMEOUT_CSRF || "15000", 10);
  const longTimeout = parseInt(process.env.SAP_TIMEOUT_LONG || "60000", 10);

  return {
    default: defaultTimeout,
    csrf: csrfTimeout,
    long: longTimeout
  };
}

/**
 * Get timeout value by type or number
 * @param type - Timeout type ("default", "csrf", "long") or number
 * @returns Timeout value in milliseconds
 */
export function getTimeout(type: "default" | "csrf" | "long" | number = "default"): number {
  if (typeof type === "number") {
    return type;
  }

  const config = getTimeoutConfig();
  return config[type];
}

