"use strict";
/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgram = getProgram;
exports.getClass = getClass;
exports.getTable = getTable;
exports.getStructure = getStructure;
exports.getDomain = getDomain;
exports.getDataElement = getDataElement;
exports.getInterface = getInterface;
exports.getFunctionGroup = getFunctionGroup;
exports.getFunction = getFunction;
exports.getPackage = getPackage;
exports.getView = getView;
const internalUtils_1 = require("../utils/internalUtils");
const connection_1 = require("@mcp-abap-adt/connection");
/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(connection, url, method = 'GET', timeout = 'default', data, params, headers) {
    const timeoutValue = (0, connection_1.getTimeout)(timeout);
    return connection.makeAdtRequest({
        url,
        method,
        timeout: timeoutValue,
        data,
        params,
        headers,
    });
}
/**
 * Get base URL from connection
 */
async function getBaseUrl(connection) {
    return connection.getBaseUrl();
}
/**
 * Get ABAP program source code
 */
async function getProgram(connection, programName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(programName);
    const url = `${baseUrl}/sap/bc/adt/programs/programs/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP class source code
 */
async function getClass(connection, className) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const url = `${baseUrl}/sap/bc/adt/oo/classes/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP table structure
 */
async function getTable(connection, tableName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableName);
    const url = `${baseUrl}/sap/bc/adt/ddic/tables/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP structure
 */
async function getStructure(connection, structureName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(structureName);
    const url = `${baseUrl}/sap/bc/adt/ddic/structures/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP domain
 */
async function getDomain(connection, domainName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(domainName);
    const url = `${baseUrl}/sap/bc/adt/ddic/domains/${encodedName.toLowerCase()}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP data element
 */
async function getDataElement(connection, dataElementName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(dataElementName);
    const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${encodedName.toLowerCase()}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP interface
 */
async function getInterface(connection, interfaceName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(interfaceName);
    const url = `${baseUrl}/sap/bc/adt/oo/interfaces/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP function group
 */
async function getFunctionGroup(connection, functionGroupName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName);
    const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedName.toLowerCase()}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP function module
 */
async function getFunction(connection, functionName, functionGroup) {
    const baseUrl = await getBaseUrl(connection);
    const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(functionGroup);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionName);
    const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedGroup.toLowerCase()}/fmodules/${encodedName.toLowerCase()}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP package
 */
async function getPackage(connection, packageName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(packageName);
    const url = `${baseUrl}/sap/bc/adt/packages/${encodedName.toLowerCase()}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP view (CDS or Classic)
 */
async function getView(connection, viewName) {
    const baseUrl = await getBaseUrl(connection);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(viewName);
    const url = `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${encodedName.toLowerCase()}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
// TODO: Add more read operations as needed
// - getInclude
// - getIncludesList
// - getTypeInfo
// - getObjectInfo
// - getObjectStructure
// - getTransaction
// - getTableContents
// - getObjectsList
// - getObjectsByType
// - getProgFullCode
// - getSqlQuery
// - getWhereUsed
// - searchObject
// - getEnhancements
// - getTransport
// etc.
