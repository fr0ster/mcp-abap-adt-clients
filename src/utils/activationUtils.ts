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
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { CT_ACTIVATION } from '../constants/contentTypes';
import { encodeSapObjectName } from './internalUtils';
import { getTimeout } from './timeouts';

/**
 * Extract a human-readable text from a single ADT `<msg>` node.
 */
function extractActivationMsgText(msg: {
  shortText?: { txt?: unknown } | string;
  objDescr?: unknown;
}): string {
  const shortText = msg?.shortText;
  if (shortText && typeof shortText === 'object' && 'txt' in shortText) {
    const txt = (shortText as { txt?: unknown }).txt;
    if (typeof txt === 'string' && txt.trim()) {
      return txt.trim();
    }
  }
  if (typeof shortText === 'string' && shortText.trim()) {
    return shortText.trim();
  }
  if (typeof msg?.objDescr === 'string' && msg.objDescr.trim()) {
    return msg.objDescr.trim();
  }
  return 'activation error';
}

/**
 * Inspect an ADT activation response body for an **explicit failure signal**.
 *
 * ADT's `/sap/bc/adt/activation` endpoint returns HTTP 200 even when activation
 * fails on a syntax error, carrying a `<chkl:messages>` body with
 * `<msg type="E">` entries. Treating "no HTTP error" as success masks these
 * failures (issue #78).
 *
 * **The failure signal is an `E` message, not `activationExecuted="false"`.**
 * This originally treated the flag alone as a failure, which is wrong — probed
 * against a trial system:
 *
 * | scenario                       | HTTP | activationExecuted | `msg` |
 * |--------------------------------|------|--------------------|-------|
 * | class already active           | 200  | `false`            | none  |
 * | DDIC table already active      | 200  | `true`             | none  |
 * | class does not exist           | 200  | `false`            | `E`   |
 * | locked by another session      | 403  | —                  | —     |
 *
 * A class that needs no activation reports `false` with an empty message list —
 * indistinguishable, by the flag alone, from a class that does not exist. So the
 * flag says whether ADT did any work, not whether the work succeeded, and only
 * the messages carry the verdict. The lock case the old wording named is a 403
 * and never reached this function at all.
 *
 * Conservative by design: returns a failure detail string ONLY on a positive
 * error signal. Empty, unparseable, or unrecognized bodies return `null`
 * (success) so the many object types whose success-body shape differs are never
 * regressed into false failures.
 *
 * @returns failure detail text, or `null` when no failure signal is present
 */
function detectActivationFailure(responseData: unknown): string | null {
  if (typeof responseData !== 'string' || responseData.trim() === '') {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    parsed = parser.parse(responseData) as Record<string, unknown>;
  } catch {
    return null;
  }

  const messages = parsed?.['chkl:messages'] as
    | {
        msg?: unknown;
      }
    | undefined;
  if (!messages) {
    return null;
  }

  const rawMsg = messages.msg;
  const msgList = Array.isArray(rawMsg) ? rawMsg : rawMsg ? [rawMsg] : [];
  const errorTexts = msgList
    .filter((m) => {
      const severity =
        (m as { type?: unknown; severity?: unknown })?.type ??
        (m as { severity?: unknown })?.severity;
      return typeof severity === 'string' && severity.toUpperCase() === 'E';
    })
    .map((m) =>
      extractActivationMsgText(
        m as Parameters<typeof extractActivationMsgText>[0],
      ),
    );

  return errorTexts.length > 0 ? errorTexts.join('; ') : null;
}

/**
 * Throw unless an activation response is free of error messages.
 *
 * Nine object types each carried a private copy of this check, all written the
 * same way — `activationExecuted && checkExecuted`, with the `<msg>` list never
 * read at all. That shape is wrong twice over:
 *
 * - It refuses a valid response. An object that needs no activation answers
 *   `activationExecuted="false"`, so `AdtClient` threw over objects that were
 *   already active. See `detectActivationFailure` above for the probed table.
 * - It discards what SAP said. A genuine failure carries the reason in
 *   `<msg type="E">` — "Class ZAC_… does not have a TMDIR entry" — and every
 *   copy replaced it with the fixed string "Activation failed".
 *
 * One rule in one place, so the nine cannot drift apart again. Callers keep
 * their own prefix, which is the only part that was ever type-specific.
 *
 * @param objectLabel prefix for the thrown message, e.g. `'Scalar function'`
 * @throws when the response carries at least one error-severity message
 */
export function assertActivationSucceeded(
  objectLabel: string,
  responseData: unknown,
): void {
  const failure = detectActivationFailure(responseData);
  if (failure) {
    throw new Error(`${objectLabel} activation failed: ${failure}`);
  }
}

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
  const lowerName = encodeSapObjectName(name).toLowerCase();

  if (!type) {
    // Try to guess type from name prefix
    if (name.startsWith('ZCL_') || name.startsWith('CL_')) {
      return `/sap/bc/adt/oo/classes/${lowerName}`;
    } else if (name.startsWith('Z') && name.includes('_PROGRAM')) {
      return `/sap/bc/adt/programs/programs/${lowerName}`;
    }
    // Default: assume program
    return `/sap/bc/adt/programs/programs/${lowerName}`;
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
      return `/sap/bc/adt/packages/${lowerName}`;

    case 'CLAS/OC':
    case 'CLAS':
      return `/sap/bc/adt/oo/classes/${lowerName}`;

    case 'PROG/P':
    case 'PROG':
      return `/sap/bc/adt/programs/programs/${lowerName}`;

    case 'FUGR/FF': {
      if (parentName) {
        const lowerParent = encodeSapObjectName(parentName).toLowerCase();
        return `/sap/bc/adt/functions/groups/${lowerParent}/fmodules/${lowerName}`;
      }
      return `/sap/bc/adt/functions/groups/${lowerName}/fmodules/${lowerName}`;
    }

    case 'FUGR':
    case 'FUGR/F':
    case 'FUNC':
      return `/sap/bc/adt/functions/groups/${lowerName}`;

    case 'TABL/DT':
    case 'TABL':
      return `/sap/bc/adt/ddic/tables/${lowerName}`;

    case 'TABL/DS':
    case 'STRU/DS':
    case 'STRU':
      return `/sap/bc/adt/ddic/structures/${lowerName}`;

    case 'DDLS/DF':
    case 'DDLS':
      return `/sap/bc/adt/ddic/ddl/sources/${lowerName}`;

    case 'VIEW/DV':
    case 'VIEW':
      return `/sap/bc/adt/ddic/views/${lowerName}`;

    case 'DTEL/DE':
    case 'DTEL':
      return `/sap/bc/adt/ddic/dataelements/${lowerName}`;

    case 'DOMA/DD':
    case 'DOMA':
      return `/sap/bc/adt/ddic/domains/${lowerName}`;

    case 'INTF/OI':
    case 'INTF':
      return `/sap/bc/adt/oo/interfaces/${lowerName}`;

    case 'TTYP/DF':
    case 'TTYP/TT':
    case 'TTYP':
      return `/sap/bc/adt/ddic/tabletypes/${lowerName}`;

    case 'SRVD/SRV':
    case 'SRVD':
      return `/sap/bc/adt/ddic/srvd/sources/${lowerName}`;

    case 'SRVB/SVB':
    case 'SRVB':
      return `/sap/bc/adt/businessservices/bindings/${lowerName}`;

    case 'DDLX/EX':
    case 'DDLX':
      return `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;

    case 'BDEF/BDO':
    case 'BDEF':
      return `/sap/bc/adt/ddic/bdef/sources/${lowerName}`;

    case 'DCLS/DL':
    case 'DCLS':
      return `/sap/bc/adt/acm/dcl/sources/${lowerName}`;

    case 'DSFD/SCF':
      return `/sap/bc/adt/ddic/dsfd/sources/${lowerName}`;

    case 'DSFI/SFI':
      return `/sap/bc/adt/ddic/dsfi/${lowerName}`;

    case 'ENHO/ENH':
    case 'ENHO':
      return `/sap/bc/adt/enhancements/${lowerName}`;

    default:
      // A guess dressed as a mapping: right when the ADT path happens to be the
      // lowercased type code, silent when it is not. `DEVC/K` is the case that
      // showed it — the address it built exists nowhere, and ADT's complaint
      // arrived inside a 200 where nothing was reading it.
      //
      // Left in place rather than made to throw: the types above are mapped, and
      // the ones that are not are reached by callers passing a type this library
      // never claimed to know. Making that a throw is a separate decision about
      // how strict `IObjectReference` should be.
      return `/sap/bc/adt/${type.toLowerCase()}/${lowerName}`;
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

  // ADT returns HTTP 200 even on failed activation (locked object, syntax
  // errors). Surface an explicit failure signal as a thrown error instead of
  // letting callers report a false success (issue #78).
  const failure = detectActivationFailure(response.data);
  if (failure) {
    throw new Error(`Activation of ${objectName} failed: ${failure}`);
  }

  return response;
}
