/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
/**
 * Get ABAP program source code
 */
export declare function getProgram(connection: AbapConnection, programName: string): Promise<AxiosResponse>;
/**
 * Get ABAP class source code
 */
export declare function getClass(connection: AbapConnection, className: string): Promise<AxiosResponse>;
/**
 * Get ABAP table structure
 */
export declare function getTable(connection: AbapConnection, tableName: string): Promise<AxiosResponse>;
/**
 * Get ABAP structure
 */
export declare function getStructure(connection: AbapConnection, structureName: string): Promise<AxiosResponse>;
/**
 * Get ABAP domain
 */
export declare function getDomain(connection: AbapConnection, domainName: string): Promise<AxiosResponse>;
/**
 * Get ABAP data element
 */
export declare function getDataElement(connection: AbapConnection, dataElementName: string): Promise<AxiosResponse>;
/**
 * Get ABAP interface
 */
export declare function getInterface(connection: AbapConnection, interfaceName: string): Promise<AxiosResponse>;
/**
 * Get ABAP function group
 */
export declare function getFunctionGroup(connection: AbapConnection, functionGroupName: string): Promise<AxiosResponse>;
/**
 * Get ABAP function module
 */
export declare function getFunction(connection: AbapConnection, functionName: string, functionGroup: string): Promise<AxiosResponse>;
/**
 * Get ABAP package
 */
export declare function getPackage(connection: AbapConnection, packageName: string): Promise<AxiosResponse>;
/**
 * Get ABAP view (CDS or Classic)
 */
export declare function getView(connection: AbapConnection, viewName: string): Promise<AxiosResponse>;
//# sourceMappingURL=readOperations.d.ts.map