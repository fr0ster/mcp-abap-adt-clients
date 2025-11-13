"use strict";
/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Provides methods for retrieving ABAP objects and data without modification.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/readOperations.ts to avoid code duplication.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyClient = void 0;
const readOps = __importStar(require("../core/readOperations"));
class ReadOnlyClient {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * Get ABAP program source code
     */
    async getProgram(programName) {
        return readOps.getProgram(this.connection, programName);
    }
    /**
     * Get ABAP class source code
     */
    async getClass(className) {
        return readOps.getClass(this.connection, className);
    }
    /**
     * Get ABAP table structure
     */
    async getTable(tableName) {
        return readOps.getTable(this.connection, tableName);
    }
    /**
     * Get ABAP structure
     */
    async getStructure(structureName) {
        return readOps.getStructure(this.connection, structureName);
    }
    /**
     * Get ABAP domain
     */
    async getDomain(domainName) {
        return readOps.getDomain(this.connection, domainName);
    }
    /**
     * Get ABAP data element
     */
    async getDataElement(dataElementName) {
        return readOps.getDataElement(this.connection, dataElementName);
    }
    /**
     * Get ABAP interface
     */
    async getInterface(interfaceName) {
        return readOps.getInterface(this.connection, interfaceName);
    }
    /**
     * Get ABAP function group
     */
    async getFunctionGroup(functionGroupName) {
        return readOps.getFunctionGroup(this.connection, functionGroupName);
    }
    /**
     * Get ABAP function module
     */
    async getFunction(functionName, functionGroup) {
        return readOps.getFunction(this.connection, functionName, functionGroup);
    }
    /**
     * Get ABAP package
     */
    async getPackage(packageName) {
        return readOps.getPackage(this.connection, packageName);
    }
    /**
     * Get ABAP view (CDS or Classic)
     */
    async getView(viewName) {
        return readOps.getView(this.connection, viewName);
    }
}
exports.ReadOnlyClient = ReadOnlyClient;
