"use strict";
/**
 * ADT Clients Package - Main exports
 *
 * Export client classes that provide different levels of access to SAP ADT:
 * - ReadOnlyClient: Read-only operations
 * - CrudClient: Full CRUD operations (extends ReadOnlyClient)
 * - ManagementClient: Activation and syntax checking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagementClient = exports.CrudClient = exports.ReadOnlyClient = void 0;
var ReadOnlyClient_1 = require("./clients/ReadOnlyClient");
Object.defineProperty(exports, "ReadOnlyClient", { enumerable: true, get: function () { return ReadOnlyClient_1.ReadOnlyClient; } });
var CrudClient_1 = require("./clients/CrudClient");
Object.defineProperty(exports, "CrudClient", { enumerable: true, get: function () { return CrudClient_1.CrudClient; } });
var ManagementClient_1 = require("./clients/ManagementClient");
Object.defineProperty(exports, "ManagementClient", { enumerable: true, get: function () { return ManagementClient_1.ManagementClient; } });
