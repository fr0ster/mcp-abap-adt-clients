/**
 * ADT Clients Package - Main exports
 *
 * Export client classes that provide different levels of access to SAP ADT:
 * - ReadOnlyClient: Read-only operations
 * - CrudClient: Full CRUD operations (extends ReadOnlyClient)
 * - ManagementClient: Activation and syntax checking
 */

export { ReadOnlyClient } from './clients/ReadOnlyClient';
export { CrudClient } from './clients/CrudClient';
export { ManagementClient } from './clients/ManagementClient';

// Re-export types from connection package for convenience
export type { AbapConnection, AbapRequestOptions } from '@mcp-abap-adt/connection';

// Export utilities
export { encodeSapObjectName } from './utils/internalUtils';

