/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, and Delete operations.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/crudOperations.ts to avoid code duplication.
 * Read operations are inherited from ReadOnlyClient (which delegates to core/readOperations.ts).
 */
import { ReadOnlyClient } from './ReadOnlyClient';
import { AbapConnection } from '@mcp-abap-adt/connection';
export declare class CrudClient extends ReadOnlyClient {
    constructor(connection: AbapConnection);
}
//# sourceMappingURL=CrudClient.d.ts.map