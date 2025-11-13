/**
 * Core management operations - private implementations
 * All activation and check methods are implemented here once and reused by clients
 */
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
/**
 * Activate ABAP objects
 * TODO: Implement full activation logic from handleActivateObject
 */
export declare function activateObject(connection: AbapConnection, objects: Array<{
    name: string;
    type: string;
}>): Promise<AxiosResponse>;
/**
 * Check ABAP object syntax
 * TODO: Implement full check logic from handleCheckObject
 */
export declare function checkObject(connection: AbapConnection, name: string, type: string, version?: string): Promise<AxiosResponse>;
//# sourceMappingURL=managementOperations.d.ts.map