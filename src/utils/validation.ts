/**
 * Shared validation utilities for SAP object names
 * 
 * NOTE: This generic validation function uses /sap/bc/adt/functions/validation endpoint.
 * Most object types now have their own specific validation endpoints and functions:
 * - View: /sap/bc/adt/ddic/ddl/validation (validateViewName)
 * - Program: /sap/bc/adt/programs/validation (validateProgramName)
 * - Interface: /sap/bc/adt/oo/interfaces/validation (validateInterfaceName)
 * - Structure: /sap/bc/adt/ddic/structures/validation (validateStructureName)
 * - FunctionGroup: /sap/bc/adt/functions/groups/validation (validateFunctionGroupName)
 * - FunctionModule: /sap/bc/adt/functions/validation (validateFunctionModuleName)
 * - Domain: /sap/bc/adt/ddic/domains/validation (validateDomainName)
 * - DataElement: /sap/bc/adt/ddic/dataelements/validation (validateDataElementName)
 * - Table: /sap/bc/adt/ddic/tables/validation (validateTableName)
 * 
 * This function is kept for backward compatibility or for object types that still use
 * the generic /sap/bc/adt/functions/validation endpoint.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from './timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from './internalUtils';

/**
 * Validate object name using generic SAP ADT validation endpoint
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * NOTE: Prefer using specific validation functions for each object type.
 * This function uses /sap/bc/adt/functions/validation which may not work correctly
 * for all object types.
 *
 * @param connection - ABAP connection
 * @param objectType - SAP object type (e.g., 'FUGR/FF', 'CLAS/OC', 'PROG/P')
 * @param objectName - Name to validate
 * @param additionalParams - Additional validation parameters (e.g., fugrname, description)
 * @returns Raw AxiosResponse from validation endpoint
 */
export async function validateObjectName(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
  additionalParams?: Record<string, string>
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(objectName);

  const params = new URLSearchParams({
    objtype: objectType,
    objname: encodedName,
    ...additionalParams
  });

  const url = `/sap/bc/adt/functions/validation?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage'
    }
  });
}


