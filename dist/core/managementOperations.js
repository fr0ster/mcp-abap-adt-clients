"use strict";
/**
 * Core management operations - private implementations
 * All activation and check methods are implemented here once and reused by clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateObject = activateObject;
exports.checkObject = checkObject;
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
 * Activate ABAP objects
 * TODO: Implement full activation logic from handleActivateObject
 */
async function activateObject(connection, objects) {
    const baseUrl = await getBaseUrl(connection);
    const url = `${baseUrl}/sap/bc/adt/activation/runs?method=activate&preauditRequested=true`;
    // TODO: Build activation XML from objects array
    const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objects.map(obj => `  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/${obj.name.toLowerCase()}" adtcore:name="${obj.name}"/>`).join('\n')}
</adtcore:objectReferences>`;
    const headers = {
        'Accept': 'application/xml',
        'Content-Type': 'application/xml'
    };
    return makeAdtRequest(connection, url, 'POST', 'default', activationXml, undefined, headers);
}
/**
 * Check ABAP object syntax
 * TODO: Implement full check logic from handleCheckObject
 */
async function checkObject(connection, name, type, version) {
    const baseUrl = await getBaseUrl(connection);
    // TODO: Build proper check URL based on object type
    const url = `${baseUrl}/sap/bc/adt/oo/classes/${name.toLowerCase()}/source/main?check=true`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
