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
 * **Of these, only `utilInactiveObjects` throws on a document it does not
 * recognise** (since 0.28.0): an activation is confirmed off the inactive
 * list, and an empty one read off the wrong document would confirm one that
 * did not happen. The others read an exception document, a logon page, or an
 * empty body as the empty shape: that is what the reading can honestly say it
 * found. Whether the answer was a refusal is the error strategy's question,
 * and it runs before this one is asked.
 *
 * **Values are text as written** (`XML_TEXT_OPTIONS`): nothing is coerced to a
 * number, and references decode as an XML parser decodes them.
 */

import type {
  IAdtAnsweredObject,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { type AdtHeaderMap, firstOf } from '../headers';
import { readInactiveListText } from '../inactiveList';
import {
  at,
  field,
  isElement,
  leafText,
  listOf,
  ownText,
  parsedOrNothing,
  parsedText,
  XML_TEXT_OPTIONS,
} from '../parsed';
import { rawOf } from '../result';
import { answeredObject } from './answeredObject';

type XmlRecord = Record<string, unknown>;

/** A parsed element that is one element, not a list of them. */
const isRecord = (value: unknown): value is XmlRecord =>
  isElement(value) && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/**
 * What every object ADT names has in common. Its code is an
 * `IAdtAnsweredObject`: `type` when the ADT type tables know it, else
 * `unknownType` with the text ADT sent.
 */
export type IAdtObjectHit = IAdtAnsweredObject & {
  /** Object name. */
  name: string;
  /** ADT URI of the object, where the producer knows it. */
  uri?: string;
  /** Package containing the object, where the producer knows it. */
  packageName?: string;
  /** Human-readable description, where the producer knows it. */
  description?: string;
};

/** One hit of an object search. */
export type ISearchResult = IAdtObjectHit & {
  /** Search always reports a description, even when empty. */
  description: string;
};

/**
 * What a where-used reference is: `package` for a `DEVC/K` node — the
 * containers SAP lists the places of use under —, `object` for anything else.
 */
export type WhereUsedReferenceKind = 'package' | 'object';

/** One reference of a where-used answer: a place of use, or a package above one. */
export type IWhereUsedReference = IAdtObjectHit & {
  /** Since 0.28.0: whether this is a package node or an object. */
  kind: WhereUsedReferenceKind;
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
};

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
  /**
   * Every reference the document holds, in document order — package nodes
   * included since 0.28.0 (`kind` says which is which); which of them to show
   * is the caller's decision.
   */
  references: IWhereUsedReference[];
}

/**
 * One object of the inactive-objects listing: its name, its code, and the
 * address SAP listed it at. A known code is an `IObjectReference` to hand to
 * `activateObjectsGroup`; an `unknownType` is not one, so a caller decides
 * about it.
 *
 * **The address, not the name, identifies a text elements entry.** SAP
 * listed a class's text elements as `PROG/PX` named after the class pool
 * (`ZCL_…====CP`) at `/textelements/classes/{class}` (measured on premise),
 * and a function group's as `PROG/PX` `SAPL{GROUP}` at
 * `/textelements/functiongroups/{group}` (measured on the cloud), each with
 * its object as `parentUri` (`CL_SEDX_ADT_SRC_UTIL=>
 * get_type_and_name_from_uri`, Code). A `PROG/PX` reference without a `uri`
 * is addressed `/textelements/programs/{name}`, which for these names is no
 * object; `uri` is the address SAP listed.
 */
export type IInactiveObject = IAdtAnsweredObject & {
  name: string;
  /** `adtcore:uri` as listed, when the entry carries one. */
  uri?: string;
  /** `adtcore:parentUri` as listed: the object a part belongs to. */
  parentUri?: string;
};

/** What the inactive-objects listing answers, read. */
export interface IInactiveObjectsResponse {
  objects: IInactiveObject[];
}

/** One entry of a named-item list — a URI and its description. */
export interface INamedItem {
  /** A URI, as the server writes it — not a short code. */
  name: string;
  /**
   * `nameditem:description` as written; absent when the entry carries none
   * (until 0.28.0 an absent one read as `''`).
   */
  description?: string;
}

/**
 * One object under a repository node. The four fields are the ones a caller
 * needs to identify and fetch it; a node SAP lists without one of them is
 * answered in `incompleteObjects` instead (since 0.28.1; dropped before).
 */
export type IRepositoryObjectNode = IAdtAnsweredObject & {
  objectName: string;
  techName: string;
  objectUri: string;
  /** Since 0.28.0: `DESCRIPTION` as written, when the node carries one. */
  description?: string;
};

/**
 * An object node SAP lists without its `OBJECT_NAME`, `TECH_NAME` or
 * `OBJECT_URI` (since 0.28.1): every field it carries, the ones it lacks
 * absent. Until 0.28.1 such a node was dropped, and the walks list them.
 */
export type IRepositoryIncompleteNode = IAdtAnsweredObject & {
  objectName?: string;
  techName?: string;
  objectUri?: string;
  description?: string;
};

/**
 * A node SAP listed but could not load (since 0.28.1). SAP answers such a
 * line of its tree with an entry of no `OBJECT_TYPE`, its message `SEU_ADT
 * 101` "Error loading node:" in `OBJECT_NAME` and its explanation in
 * `TECH_NAME` (`CL_SEU_ADT_RES_REPO_STRUCTURE->create_tree_content`;
 * measured on premise, 2026-11-22, for a package's `VIEW/DV` node). None of
 * SAP's text is kept, and there is no type to keep: the entry has none. The
 * node's type is the child node the level was asked for by.
 */
export interface IRepositoryNotLoadedNode {
  notLoaded: true;
}

/**
 * One child level: an object type, and the node id holding objects of it.
 * `SEU_ADT_OBJECT_TYPE_INFO` pairs the two, and the pair is the unit — an id on
 * its own cannot say which node holds `PROG/I`.
 */
export type IRepositoryNodeChild = IAdtAnsweredObject & {
  nodeId: string;
};

/** One level of the repository tree: its objects, and how to ask for what is below. */
export interface IRepositoryNodeContents {
  objects: IRepositoryObjectNode[];
  childNodes: IRepositoryNodeChild[];
  /**
   * Since 0.28.1: each node SAP could not load, in document order; present
   * only when the level lists one.
   */
  notLoaded?: IRepositoryNotLoadedNode[];
  /**
   * Since 0.28.1: each object node SAP lists without one of the identity
   * fields, in document order; present only when the level lists one.
   */
  incompleteObjects?: IRepositoryIncompleteNode[];
}

/** The node-structure document's two halves, the nodes still as parsed XML. */
export interface IParsedNodeStructure {
  nodes: XmlRecord[];
  objectTypes: IRepositoryNodeChild[];
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * One parser options set for every reading below: values as written
 * (`XML_TEXT_OPTIONS` — `007` stays `007`, `&#x26;` is `&`), with the
 * parser's attribute marker the readings address them by.
 */
const textParser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/** The same, namespace prefixes stripped, for documents whose prefix varies. */
const bareParser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/** A document parsed — `undefined` for an empty body or text that is not well-formed XML. */
function parsedWith(parser: XMLParser, xml: string): unknown {
  if (xml.trim() === '' || XMLValidator.validate(xml) !== true) {
    return undefined;
  }
  return parsedText(parser, xml);
}

/** A non-empty attribute or leaf, trimmed; `undefined` otherwise. */
const trimmedText = (value: unknown): string | undefined => {
  const text = leafText(value)?.trim();
  return text === undefined || text === '' ? undefined : text;
};

/** A leaf, or an element's text, as written; `undefined` when neither. */
const textOf = (value: unknown): string | undefined => ownText(value);

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * An attribute ADT may or may not namespace-qualify. The quickSearch payload is
 * not consistent across releases about the `adtcore:` prefix, so both are read.
 */
const searchAttr = (node: unknown, name: string): string | undefined =>
  trimmedText(field(node, `@_adtcore:${name}`)) ??
  trimmedText(field(node, `@_${name}`));

/**
 * A quickSearch document, read into hits. A hit without a name or a type is
 * dropped — a caller cannot act on it and the repository does not produce one.
 * References are decoded as an XML parser decodes them (`&#x26;` is `&`).
 */
export function readSearchHits(xml: string): ISearchResult[] {
  const parsed = parsedWith(textParser, xml);
  const root =
    field(parsed, 'adtcore:objectReferences') ??
    field(parsed, 'objectReferences');
  const results: ISearchResult[] = [];
  for (const ref of listOf(
    field(root, 'adtcore:objectReference') ?? field(root, 'objectReference'),
  )) {
    const name = searchAttr(ref, 'name');
    const type = searchAttr(ref, 'type');
    if (!name || !type) continue;
    results.push({
      name,
      ...answeredObject(type),
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

/**
 * `nameditem:namedItemList`, read. `name` and `description` are kept exactly
 * as the server writes them — `007` is `007`, never the number 7 — and a
 * description the entry does not carry stays absent; an entry without a name
 * is dropped. A document that is not this one reads as no items.
 */
export function readNamedItems(xml: string): INamedItem[] {
  const list = field(parsedWith(textParser, xml), 'nameditem:namedItemList');
  const result: INamedItem[] = [];
  for (const item of listOf(field(list, 'nameditem:namedItem'))) {
    const name = textOf(field(item, 'nameditem:name'));
    if (name === undefined || name === '') continue;
    const description = textOf(field(item, 'nameditem:description'));
    result.push(description === undefined ? { name } : { name, description });
  }
  return result;
}

/** A named-item list — `/informationsystem/objecttypes`. */
export const utilNamedItems: IResultStrategy<INamedItem[]> = (answer) =>
  readNamedItems(rawOf(answer));

// ---------------------------------------------------------------------------
// Node structure
// ---------------------------------------------------------------------------

// Values as written because a NODE_ID is a code, not a count: coerced,
// `<NODE_ID>000010</NODE_ID>` arrives as the number 10, and that id goes
// straight back to the server as `node_id`.
const nodeParser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

/** A node's field as text; an empty element is `''`, an absent one `undefined`. */
const nodeValue = (node: unknown, key: string): string | undefined =>
  textOf(field(node, key));

/** A node's field when it holds text; `undefined` when absent or empty. */
const nodeText = (node: unknown, key: string): string | undefined => {
  const value = nodeValue(node, key);
  return value === '' ? undefined : value;
};

/**
 * The node-structure document, parsed into its two halves. A document that is
 * not this one — an exception, a logon page, nothing — reads as an empty level.
 * Since 0.28.1 every row is a node, an empty one an empty record.
 */
export function readNodeStructure(xml: string): IParsedNodeStructure {
  const data = at(
    parsedWith(nodeParser, xml),
    'asx:abap',
    'asx:values',
    'DATA',
  );
  // Every row is kept: an empty one (`<SEU_ADT_REPOSITORY_OBJ_NODE/>`, which
  // the parser makes `''`) or one holding only text reads as a node with no
  // fields, so the readings above it account for it instead of losing it.
  const nodes = listOf(
    at(data, 'TREE_CONTENT', 'SEU_ADT_REPOSITORY_OBJ_NODE'),
  ).map((node): XmlRecord => (isRecord(node) ? node : {}));
  const objectTypes: IRepositoryNodeChild[] = [];
  for (const info of listOf(
    at(data, 'OBJECT_TYPES', 'SEU_ADT_OBJECT_TYPE_INFO'),
  )) {
    const objectType = nodeText(info, 'OBJECT_TYPE');
    const nodeId = nodeText(info, 'NODE_ID');
    if (objectType && nodeId) {
      objectTypes.push({ ...answeredObject(objectType), nodeId });
    }
  }
  return { nodes, objectTypes };
}

/**
 * One level of the repository tree — `/repository/nodestructure`: the objects
 * here, each with its description where the node carries one, and the typed
 * child nodes to ask for next. Since 0.28.1 nothing SAP lists is dropped: a
 * node without one of the four identity fields is in `incompleteObjects`,
 * and an entry with no `OBJECT_TYPE` — SAP's message for a node it could not
 * load — is in `notLoaded`, without its text.
 */
export const utilNodeContents: IResultStrategy<IRepositoryNodeContents> = (
  answer,
) => {
  const { nodes, objectTypes } = readNodeStructure(rawOf(answer));
  const objects: IRepositoryObjectNode[] = [];
  const incompleteObjects: IRepositoryIncompleteNode[] = [];
  const notLoaded: IRepositoryNotLoadedNode[] = [];
  for (const node of nodes) {
    const objectType = nodeText(node, 'OBJECT_TYPE');
    if (objectType === undefined) {
      notLoaded.push({ notLoaded: true });
      continue;
    }
    const objectName = nodeText(node, 'OBJECT_NAME');
    const techName = nodeText(node, 'TECH_NAME');
    const objectUri = nodeText(node, 'OBJECT_URI');
    const description = nodeValue(node, 'DESCRIPTION');
    const described = description === undefined ? {} : { description };
    if (
      objectName !== undefined &&
      techName !== undefined &&
      objectUri !== undefined
    ) {
      objects.push({
        ...answeredObject(objectType),
        objectName,
        techName,
        objectUri,
        ...described,
      });
      continue;
    }
    incompleteObjects.push({
      ...answeredObject(objectType),
      ...(objectName === undefined ? {} : { objectName }),
      ...(techName === undefined ? {} : { techName }),
      ...(objectUri === undefined ? {} : { objectUri }),
      ...described,
    });
  }
  return {
    objects,
    childNodes: objectTypes,
    ...(notLoaded.length === 0 ? {} : { notLoaded }),
    ...(incompleteObjects.length === 0 ? {} : { incompleteObjects }),
  };
};

// ---------------------------------------------------------------------------
// Inactive objects
// ---------------------------------------------------------------------------

/** The words `utilInactiveObjects` refuses an answer with; nothing of the document. */
export const INACTIVE_OBJECTS_REFUSAL =
  'utilInactiveObjects: the answer is no inactive-objects list';

/**
 * What `/activation/inactiveobjects` answers, read into references a caller can
 * hand straight to `activateObjectsGroup`, in either form SAP answers it:
 *
 * - `ioc:inactiveObjects` — every `ioc:ref` of every `ioc:object` of every
 *   `ioc:entry`; a transport's `ioc:ref` is not an object and is not read;
 * - `adtcore:objectReferences`, the flat list of SAP_BASIS 7.40 (recorded
 *   `activation-class-basis-740`) — every `adtcore:objectReference`.
 *
 * Read by `readInactiveList`, the one reader the activation verdict
 * (`stillInactiveAmong`) shares: names by namespace URI, not prefix, and
 * an entry, object or reference of another name refuses the whole list.
 *
 * **Any other answer is refused** (`INACTIVE_OBJECTS_REFUSAL`) — an empty
 * body, an exception, a logon page, text that is not XML. An activation is
 * confirmed off this list, and an empty one read off the wrong document would
 * confirm one that did not happen. Until 0.28.0 such an answer read as no
 * objects, and so did the 7.40 form.
 */
export const utilInactiveObjects: IResultStrategy<IInactiveObjectsResponse> = (
  answer,
) => {
  const listed = readInactiveListText(rawOf(answer));
  if (listed === null) throw new Error(INACTIVE_OBJECTS_REFUSAL);
  return {
    objects: listed.map(({ name, type, uri, parentUri }) => ({
      ...answeredObject(type ?? ''),
      name,
      ...(uri === undefined ? {} : { uri }),
      ...(parentUri === undefined ? {} : { parentUri }),
    })),
  };
};

// ---------------------------------------------------------------------------
// Where-used
// ---------------------------------------------------------------------------

/**
 * A where-used answer — `/usageReferences` — read into references: every
 * `referencedObject` the document holds, in document order, each with its
 * `kind`. A `DEVC/K` entry is a `package` — the container nodes SAP lists the
 * places of use under —, anything else an `object`; until 0.28.0 the packages
 * were dropped. The prefix SAP binds to the namespace is system-dependent
 * (`usagereferences:` or `usageReferences:`), so prefixes are stripped.
 */
export const utilWhereUsedReferences: IResultStrategy<IWhereUsedListResult> = (
  answer,
) => {
  const root = field(
    parsedWith(bareParser, rawOf(answer)),
    'usageReferenceResult',
  );
  if (!isElement(root)) {
    return { totalReferences: 0, resultDescription: '', references: [] };
  }

  const references: IWhereUsedReference[] = [];
  for (const entry of listOf(
    at(root, 'referencedObjects', 'referencedObject'),
  )) {
    const adtObject = field(entry, 'adtObject');
    if (!isElement(adtObject)) continue;
    const code = answeredObject(leafText(field(adtObject, '@_type')) ?? '');
    const description = leafText(field(adtObject, '@_description'));
    references.push({
      kind: code.type === 'DEVC/K' ? 'package' : 'object',
      uri: leafText(field(entry, '@_uri')) ?? '',
      name: leafText(field(adtObject, '@_name')) ?? '',
      ...code,
      ...(description === undefined ? {} : { description }),
      parentUri: leafText(field(entry, '@_parentUri')),
      packageName: leafText(at(adtObject, 'packageRef', '@_name')),
      responsible: leafText(field(adtObject, '@_responsible')),
      isResult: leafText(field(entry, '@_isResult')) === 'true',
      usageInformation: leafText(field(entry, '@_usageInformation')),
      objectIdentifier: textOf(field(entry, 'objectIdentifier')),
    });
  }

  return {
    totalReferences: Number.parseInt(
      leafText(field(root, '@_numberOfResults')) ?? '0',
      10,
    ),
    resultDescription: leafText(field(root, '@_resultDescription')) ?? '',
    references,
  };
};

// ---------------------------------------------------------------------------
// Activation run
// ---------------------------------------------------------------------------

/** A header's value, whether the transport gave a string or a list of them. */
function headerText(value: unknown): string | undefined {
  if (Array.isArray(value))
    return value.length ? String(firstOf(value)) : undefined;
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
  const headers: AdtHeaderMap = answer.headers ?? {};
  const location =
    headers.location ??
    headers.Location ??
    headers['content-location'] ??
    headers['Content-Location'];
  return extractRunId(location) ?? '';
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * The collection a system offers background activation runs on. Membership is
 * exact: a collection whose path only starts with it is another collection.
 */
export const ACTIVATION_RUNS_COLLECTION = '/sap/bc/adt/activation/runs';

const discoveryParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

/**
 * What `GET /sap/bc/adt/discovery` answers, read into the paths of its
 * collections: every `app:collection/@href` that is a path (starts with `/`),
 * in every `app:workspace`. An absolute `href` names another address, not a
 * collection of this system's ADT, and is skipped.
 *
 * Which group-activation endpoint a system offers is in this set: a consumer
 * asks `has(ACTIVATION_RUNS_COLLECTION)` and calls `activateObjectsGroup`
 * (`/activation/runs`) when it does, `activateObjects` (`/activation`) when it
 * does not. An answer that is no `app:service` document — an exception, a
 * logon page, an empty body, XML that is not well-formed — reads as the empty
 * set, which a consumer answers as "discovery could not be read": every
 * system's discovery lists collections.
 */
export const utilDiscoveryCollections: IResultStrategy<ReadonlySet<string>> = (
  answer,
) => {
  const collections = new Set<string>();
  const xml = rawOf(answer);
  if (xml.trim() === '' || XMLValidator.validate(xml) !== true) {
    return collections;
  }
  const parsed: unknown = parsedOrNothing(discoveryParser, xml);
  const service = field(parsed, 'service');
  if (!isElement(service)) return collections;
  for (const workspace of listOf(field(service, 'workspace'))) {
    for (const collection of listOf(field(workspace, 'collection'))) {
      const href = leafText(at(collection, '@href'));
      if (href?.startsWith('/')) collections.add(href);
    }
  }
  return collections;
};
