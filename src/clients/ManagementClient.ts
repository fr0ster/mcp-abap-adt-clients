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
import * as mgmtOps from '../core/managementOperations';
import { getObjectUri } from '../core/shared/checkRun';

export class ManagementClient {
  constructor(private connection: AbapConnection) {}

  /**
   * Activate ABAP objects
   */
  async activateObject(objects: Array<{name: string, type: string}>): Promise<AxiosResponse> {
    // Convert type to URI format expected by activateObjectsGroup
    const objectsWithUri = objects.map(obj => ({
      name: obj.name,
      uri: `/sap/bc/adt/${obj.type}/${obj.name.toLowerCase()}`
    }));
    return mgmtOps.activateObjectsGroup(this.connection, objectsWithUri);
  }

  /**
   * Activate multiple objects with explicit URIs or inferred types
   */
  async activateObjectsGroup(
    objects: Array<{ name: string; type?: string; uri?: string }>,
    preaudit: boolean = true
  ): Promise<AxiosResponse> {
    const normalized = objects.map(obj => ({
      name: obj.name,
      uri: obj.uri || (obj.type ? getObjectUri(obj.type, obj.name) : (() => { throw new Error(`Object type is required when URI is not provided for ${obj.name}`); })())
    }));
    return mgmtOps.activateObjectsGroup(this.connection, normalized, preaudit);
  }

  /**
   * Check ABAP object syntax
   */
  async checkObject(name: string, type: string, version?: string): Promise<AxiosResponse> {
    return mgmtOps.checkObject(this.connection, name, type, version);
  }

  // TODO: Add more management methods as needed
  // All will delegate to core/managementOperations.ts
}

