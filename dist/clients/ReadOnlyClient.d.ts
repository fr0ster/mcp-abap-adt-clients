/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Provides methods for retrieving ABAP objects and data without modification.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/readOperations.ts to avoid code duplication.
 */
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
export declare class ReadOnlyClient {
    private connection;
    constructor(connection: AbapConnection);
    /**
     * Get ABAP program source code
     */
    getProgram(programName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP class source code
     */
    getClass(className: string): Promise<AxiosResponse>;
    /**
     * Get ABAP table structure
     */
    getTable(tableName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP structure
     */
    getStructure(structureName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP domain
     */
    getDomain(domainName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP data element
     */
    getDataElement(dataElementName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP interface
     */
    getInterface(interfaceName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP function group
     */
    getFunctionGroup(functionGroupName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP function module
     */
    getFunction(functionName: string, functionGroup: string): Promise<AxiosResponse>;
    /**
     * Get ABAP package
     */
    getPackage(packageName: string): Promise<AxiosResponse>;
    /**
     * Get ABAP view (CDS or Classic)
     */
    getView(viewName: string): Promise<AxiosResponse>;
}
//# sourceMappingURL=ReadOnlyClient.d.ts.map