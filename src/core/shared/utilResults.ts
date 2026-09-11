/**
 * The shapes the cross-cutting readings build, and the readings that build
 * them.
 *
 * These lived in `@mcp-abap-adt/interfaces` until 31.0.0. Decision 24 took them
 * out: `IAdtInformationSystem<TSearch, TWhereUsed, TTypes>` and its neighbours
 * say a member answers *something*, and what that something looks like is the
 * reading's to name — so a shape lives here, beside the strategy that produces
 * it.
 *
 * Where a reading is already written as a function that both requests and
 * parses — the package walks, the where-used list — the strategy here is the
 * parse half of it, applied to an answer that was fetched separately.
 */

import type {
  IObjectReference,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { parseNamedItems } from './allTypes';
import { extractRunId } from './groupActivation';
import { toNodeContents } from './nodeStructure';
import { parseSearchResults } from './search';

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
  /** Parent URI (for hierarchical display) */
  parentUri?: string;
  /** Responsible user */
  responsible?: string;
  /** Whether this is a direct result or container */
  isResult: boolean;
  /** Usage information (e.g., 'gradeDirect,includeProductive') */
  usageInformation?: string;
  /** Object identifier for navigation */
  objectIdentifier?: string;
}

/**
 * What a where-used run answers, read.
 *
 * **No `objectName` or `objectType` since 19.0.0.** A reading sees the answer
 * and nothing else, and the document does not name what was searched — those
 * two fields were copied from the call's own parameters by a member that had
 * them in hand. The caller knows what they asked for.
 */
export interface IWhereUsedListResult {
  /** Total number of references found */
  totalReferences: number;
  /** Result description from SAP */
  resultDescription: string;
  /** List of referencing objects (excluding packages) */
  references: IWhereUsedReference[];
}

/*
 * `IObjectReference` is the contract's, not this module's.
 *
 * It is a **parameter**: `activateObjectsGroup`, `checkDeletionGroup` and
 * `deleteObjectsGroup` take it, so a caller cannot make the call without it —
 * which is why it stayed in the contract when the result shapes left in 31.0.0.
 * The copy here extended `IAdtObjectHit`, a result shape, deriving an input from
 * an output and picking up a `packageName` that nothing reads.
 */
export type { IObjectReference } from '@mcp-abap-adt/interfaces';

/** What the inactive-objects listing answers, read. */
export interface IInactiveObjectsResponse {
  objects: IObjectReference[];
  xmlStr?: string;
}

/** The object types a package walk understands. */
export type PackageHierarchySupportedType =
  | 'package'
  | 'domain'
  | 'dataElement'
  | 'structure'
  | 'table'
  | 'tableType'
  | 'view'
  | 'class'
  | 'interface'
  | 'program'
  | 'functionGroup'
  | 'functionModule'
  | 'serviceDefinition'
  | 'metadataExtension'
  | 'behaviorDefinition'
  | 'behaviorImplementation';

export type PackageHierarchyCodeFormat = 'source' | 'xml';

/** How far a package listing walks. */
export interface IGetPackageContentsListOptions {
  includeSubpackages?: boolean;
  maxDepth?: number;
  includeDescriptions?: boolean;
}

/** How far a package tree walks. */
export interface IGetPackageHierarchyOptions {
  includeSubpackages?: boolean;
  maxDepth?: number;
  includeDescriptions?: boolean;
}

/** One entry of a named-item list — a URI and its description. */
export interface INamedItem {
  /** A URI, as the server writes it — not a short code. */
  name: string;
  description: string;
}

/**
 * One object under a repository node.
 *
 * The four fields are the ones a caller needs to identify and fetch the object;
 * a node the server sends without all four is not one.
 */
export interface IRepositoryObjectNode {
  objectType: string;
  objectName: string;
  techName: string;
  objectUri: string;
}

/**
 * One child level: an object type, and the node id holding objects of it.
 *
 * `SEU_ADT_OBJECT_TYPE_INFO` pairs the two, and the pair is the unit. An id on
 * its own answers "there is more below" and nothing else — the caller cannot ask
 * for the includes of a program, because which id holds `PROG/I` is exactly what
 * was dropped.
 */
export interface IRepositoryNodeChild {
  objectType: string;
  nodeId: string;
}

/**
 * What one level of the repository tree answers with.
 *
 * `childNodes` is what makes the walk possible: what is below, and how to ask
 * for it. A result without it would force the caller back to the raw document.
 */
export interface IRepositoryNodeContents {
  objects: IRepositoryObjectNode[];
  childNodes: IRepositoryNodeChild[];
}

/** The hits of an object search. */
export const searchHits: IResultStrategy<ISearchResult[]> = (answer) =>
  parseSearchResults(String(answer.data ?? ''));

/** One level of the repository tree: its objects, and how to ask for what is below. */
export const nodeContents: IResultStrategy<IRepositoryNodeContents> = (
  answer,
) => toNodeContents(String(answer.data ?? ''));

/** A named-item list — the types, the traces, whatever the endpoint names. */
export const namedItems: IResultStrategy<INamedItem[]> = (answer) =>
  parseNamedItems(String(answer.data ?? ''));

/**
 * A where-used answer, read into references.
 *
 * Not the default — `whereUsed` defaults to the document, because a reference
 * list drops what a caller may want. Named and exported so a caller who does
 * want this shape asks for it by passing it in their reading set.
 *
 * Packages are skipped: `DEVC/K` entries are container nodes in this document,
 * not places the object is used.
 */
export const whereUsedReferences: IResultStrategy<IWhereUsedListResult> = (
  answer,
) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const root = parser.parse(String(answer.data ?? ''))?.usageReferenceResult;

  if (!root) {
    return { totalReferences: 0, resultDescription: '', references: [] };
  }

  const raw = root.referencedObjects?.referencedObject;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const references: IWhereUsedReference[] = [];

  for (const entry of list) {
    const adtObject = entry.adtObject;
    if (!adtObject) continue;
    const type = adtObject['@_type'] || '';
    if (type === 'DEVC/K') continue;

    references.push({
      uri: entry['@_uri'] || '',
      name: adtObject['@_name'] || '',
      type,
      parentUri: entry['@_parentUri'],
      packageName: adtObject.packageRef?.['@_name'],
      responsible: adtObject['@_responsible'],
      isResult: entry['@_isResult'] === 'true',
      usageInformation: entry['@_usageInformation'],
      objectIdentifier: entry.objectIdentifier,
    });
  }

  return {
    totalReferences: Number.parseInt(root['@_numberOfResults'] || '0', 10),
    resultDescription: root['@_resultDescription'] || '',
    references,
  };
};

/**
 * The run id a started activation answers with.
 *
 * `/activation/runs` answers `202` and puts the id in `Location` — the body
 * carries nothing a caller needs. So this is the **default** reading for
 * `activateObjectsGroup`: without it the id is discarded and the two members
 * that take one, {@link getActivationRun} and {@link getActivationResults},
 * cannot be reached at all.
 *
 * A caller who wants the response itself passes `wireItself` in their reading
 * set, and one who wants the body passes `rawDocument`.
 *
 * Answers `''` when no header carried an id. That is not a verdict about the
 * server — it is this reading saying it found none, and whether a start without
 * an id means anything is the caller's question.
 */
export const activationRunId: IResultStrategy<string> = (answer) => {
  const headers = answer.headers as Record<string, unknown> | undefined;
  const location =
    headers?.location ??
    headers?.Location ??
    headers?.['content-location'] ??
    headers?.['Content-Location'];

  return extractRunId(location as never) ?? '';
};
