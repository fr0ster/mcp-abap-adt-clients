/**
 * The text elements' requests — one each, answered as they arrived.
 *
 * The lock is the text elements' own, taken on
 * `/sap/bc/adt/textelements/{kind}/{name}` (lock class `TEXT`, Code:
 * `CL_SEDX_ADT_RES_TEXTELEMENT`), which the program's or the class's lock
 * does not cover. A part is read and written at `…/source/{part}` with the
 * part's own media type: with any other `Accept` SAP answered an HTML page
 * (measured on premise).
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { TEXT_ELEMENTS } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import { textElementsBody } from './body';
import type {
  ITextElementsUpdateConfig,
  TextElementsObjectKind,
  TextElementsPart,
  TextElementsReadVersion,
} from './types';

/** The media type of each part: its `Accept`, and its write's `Content-Type`. */
export const TEXT_ELEMENTS_MEDIA_TYPES = {
  symbols: 'application/vnd.sap.adt.textelements.symbols.v1',
  selections: 'application/vnd.sap.adt.textelements.selections.v1',
  headings: 'application/vnd.sap.adt.textelements.headings.v1',
} as const satisfies { readonly [P in TextElementsPart]: string };

/** `GET …/source/{part}[?version=…]`, with the part's media type as `Accept`. */
export async function readTextElementsPart(
  connection: IAbapConnection,
  kind: TextElementsObjectKind,
  name: string,
  part: TextElementsPart,
  version: TextElementsReadVersion | undefined,
): Promise<IAdtWireResponse> {
  const query = version === undefined ? '' : `?version=${version}`;
  return connection.makeAdtRequest({
    url: `${TEXT_ELEMENTS.uri(kind, name)}/source/${part}${query}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: TEXT_ELEMENTS_MEDIA_TYPES[part] },
  });
}

/** `POST …/{name}?_action=LOCK&accessMode=MODIFY`. */
export async function lockTextElements(
  connection: IAbapConnection,
  kind: TextElementsObjectKind,
  name: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TEXT_ELEMENTS.uri(kind, name)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}

/** `POST …/{name}?_action=UNLOCK&lockHandle=…`. */
export async function unlockTextElements(
  connection: IAbapConnection,
  kind: TextElementsObjectKind,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TEXT_ELEMENTS.uri(kind, name)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: {},
  });
}

/**
 * `PUT …/source/{part}?lockHandle=…[&corrNr=…]`, the whole part built from
 * the caller's typed list. SAP deletes what the list leaves out.
 */
export async function updateTextElementsPart(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  config: ITextElementsUpdateConfig,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TEXT_ELEMENTS.uri(config.objectKind, config.objectName)}/source/${config.part}${writeQuery(lockHandle, config.transportRequest)}`,
    method: 'PUT',
    timeout: 0,
    data: textElementsBody(config),
    // `'kept'`: a guarded text elements write is not measured, so the
    // caller's Content-Type goes as given.
    headers: updateRequestHeaders(headers, ifMatch, 'kept'),
  });
}
