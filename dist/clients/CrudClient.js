"use strict";
/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, and Delete operations.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/crudOperations.ts to avoid code duplication.
 * Read operations are inherited from ReadOnlyClient (which delegates to core/readOperations.ts).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrudClient = void 0;
const ReadOnlyClient_1 = require("./ReadOnlyClient");
class CrudClient extends ReadOnlyClient_1.ReadOnlyClient {
    constructor(connection) {
        super(connection);
    }
}
exports.CrudClient = CrudClient;
