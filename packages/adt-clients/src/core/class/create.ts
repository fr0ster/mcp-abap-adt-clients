/**
 * Class create operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { HttpError } from '@mcp-abap-adt/interfaces-network';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { TYPE_CODE } from '../../constants/typeCodes';
import { CLASS } from '../../endpoints/objects';
import { limitDescription, safeStringify } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { ICreateClassParams } from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Low-level: Create class object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateClassParams,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(
    limitDescription(args.description || args.class_name || ''),
  );
  const name = escapeXmlAttr(args.class_name);
  const packageName = escapeXmlAttr(args.package_name);
  const url = `${CLASS.collection}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const masterSystem = args.master_system || '';

  const finalAttr = args.final ? 'true' : 'false';
  // `class:abstract` is the attribute SAP's own class metadata carries
  // (corpus: `class:abstract="false"`; a standard abstract class reads
  // `class:abstract="true"`). Written only when the caller says. Measured on
  // premise (2026-11-04): a create carrying `class:abstract="true"` answered
  // 200 and left the class not abstract (SEOCLASSDF-CLSABSTRCT blank), while
  // `class:final="true"` in the same body was taken — the system decides; the
  // source's ABSTRACT is what makes a class abstract there.
  const abstractAttr =
    args.abstract === undefined
      ? ''
      : ` class:abstract="${args.abstract ? 'true' : 'false'}"`;
  const visibilityAttr = args.create_protected ? 'protected' : 'public';

  const superClassXml = args.superclass
    ? `<class:superClassRef adtcore:name="${escapeXmlAttr(args.superclass)}"/>`
    : '<class:superClassRef/>';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  // No adtcore:responsible: a class create stores that attribute as the
  // class's creator (createdBy), while the responsible person is always the
  // logon user. Measured on-premise (2026-10-04): a create sending another
  // user as responsible left responsible = logon user, createdBy = that user;
  // no ADT request changes it afterwards (the metadata PUT ignores it).
  const abapSourceNamespace = args.template_xml
    ? ' xmlns:abapsource="http://www.sap.com/adt/abapsource"'
    : '';
  const templateSection = args.template_xml
    ? `\n\n  ${args.template_xml}\n\n`
    : '\n\n';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core"${abapSourceNamespace} adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${name}" adtcore:type="${TYPE_CODE.class}"${masterSystemAttr} class:final="${finalAttr}"${abstractAttr} class:visibility="${visibilityAttr}">



  <adtcore:packageRef adtcore:name="${packageName}"/>



  ${templateSection}



  <class:include adtcore:name="${TYPE_CODE.class}" adtcore:type="${TYPE_CODE.class}" class:includeType="testclasses"/>



  ${superClassXml}



</class:abapClass>`;

  // Log request details for debugging authorization issues
  if (debugEnabled) {
    logger?.debug?.(`[DEBUG] Creating class - URL: ${url}`);
    logger?.debug?.(`[DEBUG] Creating class - Method: POST`);
    logger?.debug?.(
      `[DEBUG] Creating class - Headers: ${JSON.stringify(headers, null, 2)}`,
    );
    logger?.debug?.(
      `[DEBUG] Creating class - Body (first 500 chars): ${metadataXml.substring(0, 500)}`,
    );
  }

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: 0,
      data: metadataXml,
      headers: createRequestHeaders(headers, args.masterLanguage),
    });
    return response;
  } catch (error: unknown) {
    const e = error as HttpError;
    // Log error details for debugging
    if (e.response && debugEnabled) {
      logger?.error?.(
        `[ERROR] Create class failed - Status: ${e.response.status}`,
      );
      logger?.error?.(
        `[ERROR] Create class failed - StatusText: ${e.response.statusText}`,
      );
      logger?.error?.(
        `[ERROR] Create class failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`,
      );
      logger?.error?.(
        `[ERROR] Create class failed - Response data (first 1000 chars):`,
        typeof e.response.data === 'string'
          ? e.response.data.substring(0, 1000)
          : safeStringify(e.response.data).substring(0, 1000),
      );
    }
    throw error;
  }
}
