/**
 * Readings of the cross-cutting answers — search, the type catalogue, the
 * repository tree, the inactive list, where-used, and a started activation run.
 *
 * Moved from adt-clients, where five of them were the defaults of `AdtUtils`
 * and two called `throwIfSapError` from inside the reading — a verdict about
 * the server taken by the part that is only meant to shape a value. The client
 * now answers every document as it arrived; a caller who wants one of these
 * shapes passes it in the reading set, and one who wants a refusal named passes
 * an `analyse` (`analyseException`, `analyseAny`).
 *
 * **None of these throws on a document it does not recognise.** An exception
 * document, a logon page, or an empty body reads as the empty shape: that is
 * what the reading can honestly say it found. Whether the answer was a refusal
 * is the error strategy's question, and it runs before this one is asked.
 */

import type {
  IObjectReference,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { rawOf } from '../result';

type XmlRecord = Record<string, unknown>;

const asArray = (value: unknown): XmlRecord[] =>
  value === undefined || value === null || value === ''
    ? []
    : ((Array.isArray(value) ? value : [value]) as XmlRecord[]);

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** What every object ADT names has in common. */
export interface IAdtObjectHit {
  /** Object name. */
  name: string;
  /** ADT object type code, e.g. 'CLAS/OC', 'DDLS/DF', 'DEVC/K'. */
  type: string;
  /** ADT URI of the object, where the producer knows it. */
  uri?: string;
  /** Package containing the object, where the producer knows it. */
  packageName?: string;
  /** Human-readable description, where the producer knows it. */
  description?: string;
}

/** One hit of an object search. */
export interface ISearchResult extends IAdtObjectHit {
  /** Search always reports a description, even when empty. */
  description: string;
}

/** One object that uses the object asked about. */
export interface IWhereUsedReference extends IAdtObjectHit {
  /** ADT URI of the referencing object — always known for a where-used hit. */
  uri: string;
  /** Parent URI (for hierarchical display). */
  parentUri?: string;
  /** Responsible user. */
  responsible?: string;
  /** Whether this is a direct result or a container. */
  isResult: boolean;
  /** Usage information (e.g. 'gradeDirect,includeProductive'). */
  usageInformation?: string;
  /** Object identifier for navigation. */
  objectIdentifier?: string;
}

/**
 * What a where-used run answers, read.
 *
 * The document does not name what was searched, so neither does this: the
 * caller knows what they asked for.
 */
export interface IWhereUsedListResult {
  /** Total number of references found. */
  totalReferences: number;
  /** Result description from SAP. */
  resultDescription: string;
  /** Referencing objects, packages excluded. */
  references: IWhereUsedReference[];
}

/** What the inactive-objects listing answers, read. */
export interface IInactiveObjectsResponse {
  objects: IObjectReference[];
}

/** One entry of a named-item list — a URI and its description. */
export interface INamedItem {
  /** A URI, as the server writes it — not a short code. */
  name: string;
  description: string;
}

/**
 * One object under a repository node. The four fields are the ones a caller
 * needs to identify and fetch it; a node the server sends without all four is
 * not one.
 */
export interface IRepositoryObjectNode {
  objectType: string;
  objectName: string;
  techName: string;
  objectUri: string;
}

/**
 * One child level: an object type, and the node id holding objects of it.
 * `SEU_ADT_OBJECT_TYPE_INFO` pairs the two, and the pair is the unit — an id on
 * its own cannot say which node holds `PROG/I`.
 */
export interface IRepositoryNodeChild {
  objectType: string;
  nodeId: string;
}

/** One level of the repository tree: its objects, and how to ask for what is below. */
export interface IRepositoryNodeContents {
  objects: IRepositoryObjectNode[];
  childNodes: IRepositoryNodeChild[];
}

/** The node-structure document's two halves, the nodes still as parsed XML. */
export interface IParsedNodeStructure {
  nodes: XmlRecord[];
  objectTypes: IRepositoryNodeChild[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const searchParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * An attribute ADT may or may not namespace-qualify. The quickSearch payload is
 * not consistent across releases about the `adtcore:` prefix, so both are read.
 */
const searchAttr = (node: XmlRecord, name: string): string | undefined => {
  const value = node[`@_adtcore:${name}`] ?? node[`@_${name}`];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

/**
 * A quickSearch document, read into hits. A hit without a name or a type is
 * dropped — a caller cannot act on it and the repository does not produce one.
 */
export function readSearchHits(xml: string): ISearchResult[] {
  if (!xml.trim()) return [];
  const parsed = searchParser.parse(xml) as XmlRecord;
  const root = (parsed['adtcore:objectReferences'] ??
    parsed.objectReferences) as XmlRecord | undefined;
  if (!root || typeof root !== 'object') return [];

  const results: ISearchResult[] = [];
  for (const ref of asArray(
    root['adtcore:objectReference'] ?? root.objectReference,
  )) {
    const name = searchAttr(ref, 'name');
    const type = searchAttr(ref, 'type');
    if (!name || !type) continue;
    results.push({
      name,
      type,
      description: searchAttr(ref, 'description') ?? '',
      packageName: searchAttr(ref, 'packageName'),
      uri: searchAttr(ref, 'uri'),
    });
  }
  return results;
}

/** The hits of an object search — `/informationsystem/search`. */
export const utilSearchHits: IResultStrategy<ISearchResult[]> = (answer) =>
  readSearchHits(rawOf(answer));

// ---------------------------------------------------------------------------
// Named items — the type catalogue
// ---------------------------------------------------------------------------

const namedItemParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
});

/**
 * `nameditem:namedItemList`, read. `name` is kept exactly as the server writes
 * it; an entry without one is dropped. A document that is not this one reads
 * as no items.
 */
export function readNamedItems(xml: string): INamedItem[] {
  if (!xml.trim()) return [];
  const parsed = namedItemParser.parse(xml) as XmlRecord;
  const list = parsed['nameditem:namedItemList'] as XmlRecord | undefined;
  if (!list || typeof list !== 'object') return [];

  const result: INamedItem[] = [];
  for (const item of asArray(list['nameditem:namedItem'])) {
    const name = item?.['nameditem:name'];
    if (name === undefined || name === null || name === '') continue;
    result.push({
      name: String(name),
      description: String(item?.['nameditem:description'] ?? ''),
    });
  }
  return result;
}

/** A named-item list — `/informationsystem/objecttypes`. */
export const utilNamedItems: IResultStrategy<INamedItem[]> = (answer) =>
  readNamedItems(rawOf(answer));

// ---------------------------------------------------------------------------
// Node structure
// ---------------------------------------------------------------------------

// `parseTagValue: false` because a NODE_ID is a code, not a count: left on its
// default, `<NODE_ID>000010</NODE_ID>` arrives as the number 10, and that id
// goes straight back to the server as `node_id`.
const nodeParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const nodeValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    const record = value as XmlRecord;
    const text = record['#text'] ?? record._text;
    if (
      typeof text === 'string' ||
      typeof text === 'number' ||
      typeof text === 'boolean'
    ) {
      return String(text);
    }
  }
  return undefined;
};

/**
 * The node-structure document, parsed into its two halves. A document that is
 * not this one — an exception, a logon page, nothing — reads as an empty level.
 */
export function readNodeStructure(xml: string): IParsedNodeStructure {
  if (!xml.trim()) return { nodes: [], objectTypes: [] };
  const parsed = nodeParser.parse(xml) as XmlRecord;
  const abap = parsed?.['asx:abap'] as XmlRecord | undefined;
  const data = (abap?.['asx:values'] as XmlRecord | undefined)?.DATA as
    | XmlRecord
    | undefined;
  if (!data || typeof data !== 'object') return { nodes: [], objectTypes: [] };

  const nodes = asArray(
    (data.TREE_CONTENT as XmlRecord | undefined)?.SEU_ADT_REPOSITORY_OBJ_NODE,
  );
  const objectTypes: IRepositoryNodeChild[] = [];
  for (const info of asArray(
    (data.OBJECT_TYPES as XmlRecord | undefined)?.SEU_ADT_OBJECT_TYPE_INFO,
  )) {
    const objectType = nodeValue(info?.OBJECT_TYPE);
    const nodeId = nodeValue(info?.NODE_ID);
    if (objectType && nodeId) objectTypes.push({ objectType, nodeId });
  }
  return { nodes, objectTypes };
}

/**
 * One level of the repository tree — `/repository/nodestructure`: the objects
 * here, and the typed child nodes to ask for next. A node missing any of the
 * four identity fields is dropped.
 */
export const utilNodeContents: IResultStrategy<IRepositoryNodeContents> = (
  answer,
) => {
  const { nodes, objectTypes } = readNodeStructure(rawOf(answer));
  const objects: IRepositoryObjectNode[] = [];
  for (const node of nodes) {
    const objectType = nodeValue(node?.OBJECT_TYPE);
    const objectName = nodeValue(node?.OBJECT_NAME);
    const techName = nodeValue(node?.TECH_NAME);
    const objectUri = nodeValue(node?.OBJECT_URI);
    if (objectType && objectName && techName && objectUri) {
      objects.push({ objectType, objectName, techName, objectUri });
    }
  }
  return { objects, childNodes: objectTypes };
};

// ---------------------------------------------------------------------------
// Inactive objects
// ---------------------------------------------------------------------------

const inactiveParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * What `/activation/inactiveobjects` answers, read into references a caller can
 * hand straight to `activateObjectsGroup`.
 */
export const utilInactiveObjects: IResultStrategy<IInactiveObjectsResponse> = (
  answer,
) => {
  const xml = rawOf(answer);
  const objects: IObjectReference[] = [];
  if (!xml.trim()) return { objects };
  const parsed = inactiveParser.parse(xml) as XmlRecord;
  const root = parsed['ioc:inactiveObjects'] as XmlRecord | undefined;
  if (!root || typeof root !== 'object') return { objects };

  for (const entry of asArray(root['ioc:entry'])) {
    const ref = (entry['ioc:object'] as XmlRecord | undefined)?.['ioc:ref'] as
      | XmlRecord
      | undefined;
    if (!ref) continue;
    objects.push({
      type: String(ref['@_adtcore:type'] ?? ''),
      name: String(ref['@_adtcore:name'] ?? ''),
    });
  }
  return { objects };
};

// ---------------------------------------------------------------------------
// Where-used
// ---------------------------------------------------------------------------

// The prefix SAP binds to the usageReferences namespace is system-dependent
// (`usagereferences:` or `usageReferences:`), so prefixes are stripped.
const whereUsedParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/**
 * A where-used answer — `/usageReferences` — read into references. Packages are
 * skipped: `DEVC/K` entries are container nodes here, not places of use.
 */
export const utilWhereUsedReferences: IResultStrategy<IWhereUsedListResult> = (
  answer,
) => {
  const xml = rawOf(answer);
  const empty = { totalReferences: 0, resultDescription: '', references: [] };
  if (!xml.trim()) return empty;
  const root = (whereUsedParser.parse(xml) as XmlRecord)
    ?.usageReferenceResult as XmlRecord | undefined;
  if (!root || typeof root !== 'object') return empty;

  const references: IWhereUsedReference[] = [];
  for (const entry of asArray(
    (root.referencedObjects as XmlRecord | undefined)?.referencedObject,
  )) {
    const adtObject = entry.adtObject as XmlRecord | undefined;
    if (!adtObject) continue;
    const type = String(adtObject['@_type'] ?? '');
    if (type === 'DEVC/K') continue;
    const packageRef = adtObject.packageRef as XmlRecord | undefined;
    references.push({
      uri: String(entry['@_uri'] ?? ''),
      name: String(adtObject['@_name'] ?? ''),
      type,
      parentUri: entry['@_parentUri'] as string | undefined,
      packageName: packageRef?.['@_name'] as string | undefined,
      responsible: adtObject['@_responsible'] as string | undefined,
      isResult: entry['@_isResult'] === 'true',
      usageInformation: entry['@_usageInformation'] as string | undefined,
      objectIdentifier: entry.objectIdentifier as string | undefined,
    });
  }

  return {
    totalReferences: Number.parseInt(
      String(root['@_numberOfResults'] ?? '0'),
      10,
    ),
    resultDescription: String(root['@_resultDescription'] ?? ''),
    references,
  };
};

// ---------------------------------------------------------------------------
// Activation run
// ---------------------------------------------------------------------------

/** A header's value, whether the transport gave a string or a list of them. */
function headerText(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  if (value === undefined || value === null || typeof value === 'object') {
    return undefined;
  }
  return String(value);
}

/**
 * The run id in a `Location` value — `/activation/runs/{runId}`. For a caller
 * who kept the exchange and reads the id later.
 */
export function extractRunId(location: unknown): string | null {
  const text = headerText(location);
  if (!text) return null;
  const match = text.match(/\/activation\/runs\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * The run id a started activation answers with. `/activation/runs` answers
 * `202` with the id in `Location` and a body that carries nothing, and both
 * members that continue the sequence take an id.
 *
 * `''` when no header carried one — this reading saying it found none. Whether
 * a start without an id means anything is the caller's question.
 */
export const utilActivationRunId: IResultStrategy<string> = (answer) => {
  const headers = (answer.headers ?? {}) as XmlRecord;
  const location =
    headers.location ??
    headers.Location ??
    headers['content-location'] ??
    headers['Content-Location'];
  return extractRunId(location) ?? '';
};
