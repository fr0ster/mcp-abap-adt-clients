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

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { parseNamedItems } from './allTypes';
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

/** What a where-used run answers, read. */
export interface IWhereUsedListResult {
  /** Object that was searched */
  objectName: string;
  /** Object type that was searched */
  objectType: string;
  /** Total number of references found */
  totalReferences: number;
  /** Result description from SAP */
  resultDescription: string;
  /** List of referencing objects (excluding packages) */
  references: IWhereUsedReference[];
}

/** An object reference, as group operations and inactive listings carry it. */
export interface IObjectReference extends IAdtObjectHit {
  parentName?: string;
}

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

/** One node of a package tree. */
export interface IPackageHierarchyNode extends IAdtObjectHit {
  /** Coarse classification of the node, derived from its `type` code. */
  kind?: PackageHierarchySupportedType;
  /** Whether this node is a subpackage. */
  isPackage: boolean;
  codeFormat?: PackageHierarchyCodeFormat;
  restoreStatus?: 'ok' | 'not-implemented';
  children?: IPackageHierarchyNode[];
}

/** One item of a flat package listing. */
export interface IPackageContentItem extends IAdtObjectHit {
  /** Coarse classification of the item, derived from its `type` code. */
  kind?: PackageHierarchySupportedType;
  /** Package containing this object — always known when listing a package. */
  packageName: string;
  /** Whether this item is a subpackage */
  isPackage: boolean;
}

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
