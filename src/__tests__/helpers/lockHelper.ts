/**
 * Test helper utilities for integration tests
 * Manages lock state persistence and cleanup
 */

import { getLockStateManager, LockState } from '../../utils/lockStateManager';
import { logBuilderLockEvent } from './builderTestLogger';

/**
 * Register lock in persistent storage
 */
export function registerTestLock(
  objectType: LockState['objectType'],
  objectName: string,
  sessionId: string,
  lockHandle: string,
  functionGroupName?: string,
  testFile?: string
): void {
  const lockManager = getLockStateManager();
  lockManager.registerLock({
    objectType,
    objectName,
    sessionId,
    lockHandle,
    functionGroupName,
    testFile,
  });
}

/**
 * Remove lock from persistent storage
 */
export function unregisterTestLock(
  objectType: string,
  objectName: string,
  functionGroupName?: string
): void {
  const lockManager = getLockStateManager();
  lockManager.removeLock(objectType, objectName, functionGroupName);
}

/**
 * Get registered lock
 */
export function getTestLock(
  objectType: string,
  objectName: string,
  functionGroupName?: string
): LockState | undefined {
  const lockManager = getLockStateManager();
  return lockManager.getLock(objectType, objectName, functionGroupName);
}

/**
 * Cleanup all locks for current test file
 */
export function cleanupTestLocks(testFile?: string): void {
  const lockManager = getLockStateManager();
  const allLocks = lockManager.getAllLocks();

  if (testFile) {
    // Remove only locks from this test file
    allLocks
      .filter((lock: LockState) => lock.testFile === testFile)
      .forEach((lock: LockState) => {
        lockManager.removeLock(lock.objectType, lock.objectName, lock.functionGroupName);
      });
  } else {
    // Remove all locks from current process
    allLocks
      .filter((lock: LockState) => lock.pid === process.pid)
      .forEach((lock: LockState) => {
        lockManager.removeLock(lock.objectType, lock.objectName, lock.functionGroupName);
      });
  }
}

/**
 * Create onLock callback for Builder config
 * This callback will register the lock in persistent storage when Builder.lock() is called
 */
export function createOnLockCallback(
  objectType: LockState['objectType'],
  objectName: string,
  functionGroupName?: string,
  testFile?: string
): (lockHandle: string) => void {
  return (lockHandle: string) => {
    const targetName = functionGroupName ? `${functionGroupName}/${objectName}` : objectName;
    const sessionId = ''; // sessionId is internal to connection now
    logBuilderLockEvent(objectType, targetName, sessionId, lockHandle);
    registerTestLock(objectType, objectName, sessionId, lockHandle, functionGroupName, testFile);
  };
}
