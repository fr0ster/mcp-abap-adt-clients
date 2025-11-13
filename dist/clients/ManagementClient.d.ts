/**
 * ManagementClient - Management operations for SAP ADT
 *
 * Provides methods for object activation and syntax checking.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/managementOperations.ts to avoid code duplication.
 */
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
export declare class ManagementClient {
    private connection;
    constructor(connection: AbapConnection);
    /**
     * Activate ABAP objects
     */
    activateObject(objects: Array<{
        name: string;
        type: string;
    }>): Promise<AxiosResponse>;
    /**
     * Check ABAP object syntax
     */
    checkObject(name: string, type: string, version?: string): Promise<AxiosResponse>;
}
//# sourceMappingURL=ManagementClient.d.ts.map