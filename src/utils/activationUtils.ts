/**
 * Activation Utilities - Centralized ABAP Object Activation Functions
 *
 * Two types of activation endpoints:
 * 1. Individual activation: /sap/bc/adt/activation (for single object in session)
 * 2. Group activation: /sap/bc/adt/activation/runs (for multiple objects)
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_ACTIVATION } from '../constants/contentTypes';
import { getEnhancementUri } from '../core/enhancement/types';
import {
  ACCESS_CONTROL,
  AUTHORIZATION_FIELD,
  BEHAVIOR_DEFINITION,
  CLASS,
  DATA_ELEMENT,
  DDIC_VIEW,
  DDL_SOURCE,
  DOMAIN,
  FEATURE_TOGGLE,
  FUNCTION_GROUP,
  FUNCTION_INCLUDE,
  FUNCTION_MODULE,
  INTERFACE,
  METADATA_EXTENSION,
  PACKAGE,
  PROGRAM,
  PROGRAM_INCLUDE,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  TRANSFORMATION,
} from '../endpoints/objects';
import { getTimeout } from './timeouts';

/**
 * Build object URI from name and type
 * Used by both individual and group activation
 *
 * @param name - Object name (e.g., 'ZCL_MY_CLASS', 'Z_MY_PROGRAM')
 * @param type - Object type code (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF')
 * @param parentName - Parent object name (e.g., function group name for FUGR/FF)
 * @returns ADT URI for the object
 */
export function buildObjectUri(
  name: string,
  type?: string,
  parentName?: string,
): string {
  if (!type) {
    // The name does not say what an object is: ZCL_ is a convention, not a
    // type, and every other name used to be taken for a program.
    throw new Error(`buildObjectUri needs the object type for ${name}`);
  }

  // Map type to URI path
  switch (type.toUpperCase()) {
    // A package is not `/sap/bc/adt/devc/k/…`, which is what the fallback at the
    // bottom of this switch builds from the type code. ADT answers that address
    // with `No URI-Mapping defined for URI`, and every group operation —
    // deletion check, delete, activate — was asking about packages there.
    // `AdtPackage` has always used the right resource directly, which is why
    // package CRUD worked while the group operations did not.
    case 'DEVC/K':
    case 'DEVC':
      return `${PACKAGE.uri(name)}`;

    case 'CLAS/OC':
    case 'CLAS':
      return `${CLASS.uri(name)}`;

    case 'PROG/P':
    case 'PROG':
      return `${PROGRAM.uri(name)}`;

    case 'PROG/I':
      return `${PROGRAM_INCLUDE.uri(name)}`;

    case 'FUGR/FF': {
      // A module is addressed under its group. This used to put the module's
      // own name in the group's place when none was passed — an address that
      // exists nowhere.
      if (!parentName) {
        throw new Error(
          `A function module (FUGR/FF) is addressed under its function group; pass the group as parentName for ${name}`,
        );
      }
      return FUNCTION_MODULE.uri(parentName, name);
    }

    case 'FUGR/I': {
      // A function include lives under its group, and the address is
      // meaningless without it: `/functions/groups/<group>/includes/<NAME>`,
      // with the include's name upper-cased the way its own activation sends
      // it. The group is the caller's to give — it is their argument that is
      // missing, not anything SAP said, so it is thrown.
      if (!parentName) {
        throw new Error(
          `A function include (FUGR/I) is addressed under its function group; pass the group as parentName for ${name}`,
        );
      }
      return `${FUNCTION_INCLUDE.uri(parentName, name)}`;
    }

    case 'FUGR':
    case 'FUGR/F':
    case 'FUNC':
      return `${FUNCTION_GROUP.uri(name)}`;

    case 'TABL/DT':
    case 'TABL':
      return `${TABLE.uri(name)}`;

    case 'TABL/DS':
    case 'STRU/DS':
    case 'STRU':
      return `${STRUCTURE.uri(name)}`;

    case 'DDLS/DF':
    case 'DDLS':
      return `${DDL_SOURCE.uri(name)}`;

    case 'VIEW/DV':
    case 'VIEW':
      return `${DDIC_VIEW.uri(name)}`;

    case 'DTEL/DE':
    case 'DTEL':
      return `${DATA_ELEMENT.uri(name)}`;

    case 'DOMA/DD':
    case 'DOMA':
      return `${DOMAIN.uri(name)}`;

    case 'INTF/OI':
    case 'INTF':
      return `${INTERFACE.uri(name)}`;

    case 'TTYP/DF':
    case 'TTYP/TT':
    case 'TTYP':
      return `${TABLE_TYPE.uri(name)}`;

    case 'SRVD/SRV':
    case 'SRVD':
      return `${SERVICE_DEFINITION.uri(name)}`;

    case 'SRVB/SVB':
    case 'SRVB':
      return SERVICE_BINDING.uri(name);

    case 'DDLX/EX':
    case 'DDLX':
      return `${METADATA_EXTENSION.uri(name)}`;

    case 'BDEF/BDO':
    case 'BDEF':
      // `/bo/behaviordefinitions`, as a BDEF's own activation and the
      // inactive-objects list both address it. This read `/ddic/bdef/sources`
      // until #173: SAP resolved that to nothing and answered
      // `activationExecuted="false"` with no message, so a group activation
      // reported success and left the behavior definition inactive.
      return `${BEHAVIOR_DEFINITION.uri(name)}`;

    case 'DCLS/DL':
    case 'DCLS':
      return `${ACCESS_CONTROL.uri(name)}`;

    case 'DSFD/SCF':
      return `${SCALAR_FUNCTION.uri(name)}`;

    case 'DSFI/SFI':
      return `${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}`;

    case 'XSLT/VT':
    case 'XSLT':
      return `${TRANSFORMATION.uri(name)}`;

    case 'AUTH':
      return `${AUTHORIZATION_FIELD.uri(name)}`;

    case 'FTG2/FT':
    case 'FTG2':
      return `${FEATURE_TOGGLE.uri(name)}`;

    // The subtype is a path segment — `/enhancements/enhoxh/<name>` — so it is
    // read off the type code, and built by the same function the enhancement's
    // own activation uses. This case built `/enhancements/<name>` until #173's
    // check found it, and the subtyped codes fell through to `default`.
    case 'ENHO/EXH':
      return getEnhancementUri('enhoxh', name);
    case 'ENHO/EXHB':
      return getEnhancementUri('enhoxhb', name);
    case 'ENHO/EXHH':
      return getEnhancementUri('enhoxhh', name);
    case 'ENHS/EXS':
      return getEnhancementUri('enhsxs', name);
    case 'ENHS/EXSB':
      return getEnhancementUri('enhsxsb', name);

    case 'ENHO':
    case 'ENHS':
      // Which subtype is the caller's to say; guessing one is the `default`
      // branch's mistake below. Their argument is short, not SAP's answer.
      throw new Error(
        `${type} does not say which enhancement subtype ${name} is, and the subtype is part of its address; pass the full type (e.g. ENHO/EXH, ENHO/EXHB, ENHO/EXHH, ENHS/EXS, ENHS/EXSB)`,
      );

    default:
      // Used to build `/sap/bc/adt/<type lowercased>/<name>` — right only when
      // the ADT path happened to be the type code, and a 200 carrying ADT's
      // complaint otherwise (`DEVC/K` showed it). A type this library has no
      // record for is the caller's argument, so it is refused before a request.
      throw new Error(
        `No ADT address is known for object type '${type}' (${name}); pass one of the codes this library maps, e.g. CLAS/OC, PROG/P, PROG/I, FUGR/I.`,
      );
  }
}

/**
 * Individual object activation (within a session)
 * Used by Update/Create handlers after lock/unlock operations
 *
 * @param connection - ABAP connection instance
 * @param objectUri - ADT URI of the object (e.g., '/sap/bc/adt/oo/classes/zcl_test')
 * @param objectName - Object name in uppercase (e.g., 'ZCL_TEST')
 * @param sessionId - Session ID for stateful operations
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 */
export async function activateObjectInSession(
  connection: IAbapConnection,
  objectUri: string,
  objectName: string,
  preaudit: boolean = true,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preaudit}`;

  const activationXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${objectName}"/>
</adtcore:objectReferences>`;

  const headers = {
    'Content-Type': CT_ACTIVATION,
    Accept: 'application/xml',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: activationXml,
    headers,
  });

  // The answer, as it arrived. ADT returns 200 even on a failed activation
  // (locked object, syntax errors), so the status does not carry the verdict
  // and neither does this function. Whether a checklist body means the
  // activation happened is read by the caller's own `analyse`.
  return response;
}
