/**
 * Format utilities for debug logging
 */

/**
 * Format session ID for logging: first 8 + last 8 characters
 * Example: dcc5f0cc...3ac16c60
 */
export function formatSessionId(sessionId: string): string {
  if (sessionId.length <= 16) {
    return sessionId; // Too short, show all
  }
  return `${sessionId.substring(0, 8)}...${sessionId.substring(sessionId.length - 8)}`;
}

/**
 * Format request ID for logging: first 8 characters
 */
export function formatRequestId(requestId: string): string {
  return requestId.substring(0, 8);
}

/**
 * Format lock handle for logging: first 8 + last 8 characters
 */
export function formatLockHandle(lockHandle: string): string {
  if (lockHandle.length <= 16) {
    return lockHandle;
  }
  return `${lockHandle.substring(0, 8)}...${lockHandle.substring(lockHandle.length - 8)}`;
}
