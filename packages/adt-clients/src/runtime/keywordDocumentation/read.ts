/**
 * The ABAP keyword documentation, `/sap/bc/adt/docu/abap/langu`: one `GET`
 * per form — the query (`query=`), the topic (`object=`) and the position
 * (`uri=`). Each parameter is sent only when given, as given; the member
 * reads nothing of the page and fixes no `version` or `format`.
 */

import type {
  IKeywordDocumentationOptions,
  IKeywordDocumentationPositionParams,
  IKeywordDocumentationQueryParams,
  IKeywordDocumentationTopicParams,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_KEYWORD_DOCUMENTATION } from '../../constants/contentTypes';
import { KEYWORD_DOCUMENTATION } from '../../endpoints/objects';

/** The form's own parameter, then `language`, `version`, `format`, each only when given. */
function parametersOf(
  form: Record<string, string>,
  params: {
    language?: string | undefined;
    version?: string | undefined;
    format?: string | undefined;
  },
): Record<string, string> {
  const out: Record<string, string> = { ...form };
  if (params.language !== undefined) out.language = params.language;
  if (params.version !== undefined) out.version = params.version;
  if (params.format !== undefined) out.format = params.format;
  return out;
}

function get(
  connection: IAbapConnection,
  params: Record<string, string>,
  options: IKeywordDocumentationOptions | undefined,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: KEYWORD_DOCUMENTATION.collection,
    method: 'GET',
    timeout: 0,
    params,
    headers: { Accept: options?.accept ?? ACCEPT_KEYWORD_DOCUMENTATION },
  });
}

/** The query form: the documentation's page for a keyword or term. */
export function getKeywordDocumentationQuery(
  connection: IAbapConnection,
  params: IKeywordDocumentationQueryParams,
  options?: IKeywordDocumentationOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    parametersOf({ query: params.query }, params),
    options,
  );
}

/** The topic form: one topic by the name a documentation link carries. */
export function getKeywordDocumentationTopic(
  connection: IAbapConnection,
  params: IKeywordDocumentationTopicParams,
  options?: IKeywordDocumentationOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    parametersOf({ object: params.object }, params),
    options,
  );
}

/** The position form: the documentation for a position in a source. */
export function getKeywordDocumentationPosition(
  connection: IAbapConnection,
  params: IKeywordDocumentationPositionParams,
  options?: IKeywordDocumentationOptions,
): Promise<IAdtWireResponse> {
  return get(connection, parametersOf({ uri: params.uri }, params), options);
}
