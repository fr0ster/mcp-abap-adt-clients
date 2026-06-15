/**
 * List the function modules of a function group via ADT node structure.
 *
 * The package/include APIs do not surface a function group's modules; only a
 * two-step nodestructure drill-down does (root -> FUGR/FF type node -> names).
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchNodeStructure } from './nodeStructure';

// NODE_ID values are zero-padded ("000007"); value coercion would turn them
// into numbers and lose the zeros, so it is disabled here.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// fetchNodeStructure may resolve (not reject) on a non-2xx depending on the
// connection's validateStatus; guard explicitly so a non-2xx never yields [].
function assertOk(res: { status?: number }, context: string): void {
  const status = res?.status;
  if (typeof status === 'number' && (status < 200 || status >= 300)) {
    throw new Error(
      `Node structure request failed (${context}): HTTP ${status}`,
    );
  }
}

function parseValidated(xml: string, context: string): Record<string, unknown> {
  // Layer 1: well-formedness. fast-xml-parser tolerates malformed input, so
  // reject it explicitly before parsing.
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(
      `Invalid node structure XML (${context}): ${validation.err?.msg ?? 'malformed'}`,
    );
  }
  return parser.parse(xml) as Record<string, unknown>;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

// Layer 2: expected structure. XMLValidator only proves well-formedness; a
// valid <html/> error page or bare <asx:abap/> would pass it and be misread as
// "no FM". Assert the asx:abap -> asx:values -> DATA chain of KEYS is present and
// throw if absent. DATA itself may be empty: an empty <DATA/> is parsed as "" and
// is a valid-empty payload (e.g. a drill with no TREE_CONTENT) -> normalize to {}.
function dataNode(
  parsed: Record<string, unknown>,
  context: string,
): Record<string, unknown> {
  const abap = parsed?.['asx:abap'];
  const values = isObject(abap) ? abap['asx:values'] : undefined;
  if (!isObject(values) || !('DATA' in values)) {
    throw new Error(
      `Unexpected node structure (${context}): missing asx:abap/asx:values/DATA envelope`,
    );
  }
  const data = values.DATA;
  // An empty <DATA/> is parsed as "" (valid-empty payload) -> {}. Any other
  // non-object value (e.g. <DATA>error</DATA> -> "error") is an unexpected shape
  // and must throw rather than be silently treated as empty.
  if (data === '') {
    return {};
  }
  if (!isObject(data)) {
    throw new Error(
      `Unexpected node structure (${context}): DATA is not an element`,
    );
  }
  return data;
}

export async function listFunctionModules(
  connection: IAbapConnection,
  functionGroupName: string,
): Promise<string[]> {
  if (!functionGroupName) {
    throw new Error('Function group name is required');
  }
  const name = functionGroupName.toUpperCase();

  // Root: find the FUGR/FF type node id (string, leading zeros preserved).
  const rootRes = await fetchNodeStructure(
    connection,
    'FUGR/F',
    name,
    '000000',
    true,
  );
  assertOk(rootRes, `root ${name}`);
  const rootData = dataNode(
    parseValidated(String(rootRes.data), `root ${name}`),
    `root ${name}`,
  );
  // A genuine FUGR node structure always returns its type catalog. Its complete
  // absence (no key) means we did not get a node structure (e.g. an error
  // envelope) -> throw. An empty `<OBJECT_TYPES/>` is parsed as "" — the key is
  // present, there is simply no FUGR/FF -> [] (a valid-empty result, not an error).
  // So check for KEY presence, not object type.
  if (!('OBJECT_TYPES' in rootData)) {
    throw new Error(
      `Unexpected node structure (root ${name}): missing OBJECT_TYPES`,
    );
  }
  const objectTypes = rootData.OBJECT_TYPES;
  const types = asArray<Record<string, unknown>>(
    isObject(objectTypes)
      ? (objectTypes.SEU_ADT_OBJECT_TYPE_INFO as never)
      : undefined,
  );
  const ff = types.find((t) => t?.OBJECT_TYPE === 'FUGR/FF');
  const nodeId = ff?.NODE_ID;
  if (typeof nodeId !== 'string' || nodeId === '') {
    return [];
  }

  // Drill: read the function module OBJECT_NAMEs.
  const drillRes = await fetchNodeStructure(
    connection,
    'FUGR/F',
    name,
    nodeId,
    true,
  );
  assertOk(drillRes, `drill ${name}`);
  const drillData = dataNode(
    parseValidated(String(drillRes.data), `drill ${name}`),
    `drill ${name}`,
  );
  const nodes = asArray<Record<string, unknown>>(
    (drillData.TREE_CONTENT as Record<string, unknown>)
      ?.SEU_ADT_REPOSITORY_OBJ_NODE as never,
  );

  const seen = new Set<string>();
  const result: string[] = [];
  for (const node of nodes) {
    if (node?.OBJECT_TYPE !== 'FUGR/FF') continue;
    const objName = node?.OBJECT_NAME;
    if (typeof objName !== 'string' || objName.trim() === '') continue;
    const fm = objName.trim();
    const key = fm.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(fm);
  }
  return result;
}
