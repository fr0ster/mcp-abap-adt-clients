/**
 * Enumerate the children of a function group via ADT node structure.
 *
 * The package/include APIs do not surface a function group's children; only a
 * two-step nodestructure drill-down does (root -> child-type node -> names).
 * This is the shared core behind listFunctionModules (FUGR/FF) and
 * listFunctionGroupIncludes (FUGR/I).
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchNodeStructure } from './nodeStructure';

/** Function-group child node types reachable via the drill-down. */
export type FunctionGroupChildType = 'FUGR/FF' | 'FUGR/I';

// NODE_ID values are zero-padded ("000007"); value coercion would turn them
// into numbers and lose the zeros, so it is disabled here.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

// True only for a single element record. Arrays are excluded: the parser
// represents structurally-invalid duplicate containers (two <DATA/>, two
// <TREE_CONTENT>, two <OBJECT_TYPES>) as arrays, which must be rejected as a
// wrong shape, not silently treated as empty. Legitimate repeated entries
// (multiple SEU_ADT_* nodes) are arrays handled by asArray, not isObject.
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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

// Read the node list inside a container element (OBJECT_TYPES / TREE_CONTENT).
// An absent container or an empty one (`<TREE_CONTENT/>` -> "") is valid-empty
// -> []. Any other scalar (`<TREE_CONTENT>error</TREE_CONTENT>` -> "error") is an
// unexpected shape and must throw rather than be silently treated as empty.
//
// The same applies one level deeper: each inner entry (SEU_ADT_OBJECT_TYPE_INFO /
// SEU_ADT_REPOSITORY_OBJ_NODE) must be an element. A scalar entry (e.g.
// `<SEU_ADT_OBJECT_TYPE_INFO>error</...>`) would otherwise be silently skipped
// (no OBJECT_TYPE -> no match), yielding a wrong [] instead of a throw.
function extractNodeList(
  container: unknown,
  innerKey: string,
  containerName: string,
  context: string,
): Record<string, unknown>[] {
  if (container === undefined || container === null || container === '') {
    return [];
  }
  if (!isObject(container)) {
    throw new Error(
      `Unexpected node structure (${context}): ${containerName} is not an element`,
    );
  }
  const list = asArray<unknown>(container[innerKey]);
  for (const item of list) {
    if (!isObject(item)) {
      throw new Error(
        `Unexpected node structure (${context}): ${containerName} contains a non-element entry`,
      );
    }
  }
  return list as Record<string, unknown>[];
}

// Layer 2: expected structure. XMLValidator only proves well-formedness; a
// valid <html/> error page or bare <asx:abap/> would pass it and be misread as
// "no children". Assert the asx:abap -> asx:values -> DATA chain of KEYS is
// present and throw if absent. DATA itself may be empty: an empty <DATA/> is
// parsed as "" and is a valid-empty payload (e.g. a drill with no TREE_CONTENT)
// -> normalize to {}. Any other scalar DATA is an unexpected shape -> throw.
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

/**
 * List the children of a function group that match a given ADT object type.
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Function group name (case-insensitive)
 * @param childType - Child node type to enumerate ('FUGR/FF' modules, 'FUGR/I' includes)
 * @returns Child object names, deduped by uppercased key (first occurrence wins,
 *          document order preserved). `[]` for a valid-empty result; throws on a
 *          malformed, non-2xx, or wrong-shape response.
 */
export async function listFunctionGroupChildren(
  connection: IAbapConnection,
  functionGroupName: string,
  childType: FunctionGroupChildType,
): Promise<string[]> {
  if (!functionGroupName) {
    throw new Error('Function group name is required');
  }
  const name = functionGroupName.toUpperCase();

  // Root: find the child-type node id (string, leading zeros preserved).
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
  // present, there is simply no matching child -> [] (valid-empty, not an error).
  // So check for KEY presence, not object type.
  if (!('OBJECT_TYPES' in rootData)) {
    throw new Error(
      `Unexpected node structure (root ${name}): missing OBJECT_TYPES`,
    );
  }
  const types = extractNodeList(
    rootData.OBJECT_TYPES,
    'SEU_ADT_OBJECT_TYPE_INFO',
    'OBJECT_TYPES',
    `root ${name}`,
  );
  const typeInfo = types.find((t) => t?.OBJECT_TYPE === childType);
  const nodeId = typeInfo?.NODE_ID;
  if (typeof nodeId !== 'string' || nodeId === '') {
    return [];
  }

  // Drill: read the child OBJECT_NAMEs.
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
  const nodes = extractNodeList(
    drillData.TREE_CONTENT,
    'SEU_ADT_REPOSITORY_OBJ_NODE',
    'TREE_CONTENT',
    `drill ${name}`,
  );

  const seen = new Set<string>();
  const result: string[] = [];
  for (const node of nodes) {
    if (node?.OBJECT_TYPE !== childType) continue;
    const objName = node?.OBJECT_NAME;
    if (typeof objName !== 'string' || objName.trim() === '') continue;
    const child = objName.trim();
    const key = child.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(child);
  }
  return result;
}
