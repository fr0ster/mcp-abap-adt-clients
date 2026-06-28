/**
 * ADT Clients Package - Main exports
 *
 * Client APIs (Public API):
 * - AdtClient: High-level CRUD operations (validate/create/read/update/delete/activate/check)
 * - AdtRuntimeClient: Runtime operations (stable APIs)
 * - AdtRuntimeClientExperimental: Runtime APIs in progress (may change)
 *
 * @example
 * ```typescript
 * import { AdtClient } from '@mcp-abap-adt/adt-clients';
 *
 * const client = new AdtClient(connection);
 * await client.getProgram().create({
 *   programName: 'ZTEST',
 *   packageName: 'ZPACKAGE',
 *   description: 'Test program',
 * });
 * await client.getProgram().read({ programName: 'ZTEST' });
 * ```
 */

export * from './index.abapgit';
export * from './index.batch';
export * from './index.core';
export * from './index.executors';
export * from './index.runtime';
export * from './index.ws';
