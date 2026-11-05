/**
 * Element info — what `AdtUtils.getStructureElementInfo`
 * (`GET /sap/bc/adt/ddic/elementinfo?path=`) and
 * `AdtUtils.getServiceDefinitionElementInfo`
 * (`GET /sap/bc/adt/ddic/srvd/elementinfo?path=`) answer, read.
 *
 * Measured on premise and on ABAP cloud (2026-11-05): one root
 * `abapsource:elementInfo` naming the object (`adtcore:uri`, `adtcore:type`,
 * `adtcore:name`, an `abapsource:documentation` short text), its
 * `abapsource:properties` entries, `atom:link`s, and one nested
 * `abapsource:elementInfo` per component, flat, the object's package
 * (`DEVC/K`) last.
 *
 * - **A structure:** every component in order. An include or an append is a
 *   `TABL/DS` element named `.include` / `.append`, with `ddicIncludeName`
 *   (the included structure) and the included structure's source URI; every
 *   field inside one carries `ddicIsPartOfInclude` (the include it is in) and
 *   `ddicIncludeHierarchyLevel` (1 directly inside a top-level include), and
 *   a nested include carries them too. A component of the structure itself
 *   carries neither. A named include (`_x : include s`) is an `.include`
 *   like any other: its group name is not stated. An append
 *   (`extend type`) is listed as `.append`, with its fields.
 * - **A service definition:** one element per exposed entity, its name as
 *   the DDL source writes it, its DDL source URI and an `alias` entry when
 *   the `expose` has an `as` (none without); not in source order. Entities
 *   an extension exposes are listed too, and the extension is linked.
 *
 * A name that does not exist answers `200` with an element info that names
 * nothing; it reads as no name and no components — whether that was a
 * refusal is the caller's question.
 */

import type {
  IAdtAnsweredObject,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field, isElement, leafText, listOf } from '../parsed';
import { rawOf } from '../result';
import { answeredObject } from './answeredObject';

/** The object an element info is about; nothing for a name that is not. */
export type IElementInfoObject = Partial<IAdtAnsweredObject> & {
  name: string | undefined;
  uri: string | undefined;
  /** The short text (`abapsource:documentation rel="shorttext"`). */
  description: string | undefined;
};

/** The package the answer names last. */
export interface IElementInfoPackage {
  name: string;
  uri: string | undefined;
}

/** One `atom:link` of the object, as SAP wrote it. */
export interface IElementInfoLink {
  rel: string;
  href: string;
  title: string | undefined;
}

/** One component of a structure, in document order. */
export type IStructureComponent = IAdtAnsweredObject & {
  /** The field's name, or `.include` / `.append`. */
  name: string;
  /** An include's or append's source URI; absent for a field. */
  uri: string | undefined;
  description: string | undefined;
  /** The structure an `.include` / `.append` names (`ddicIncludeName`). */
  includeName: string | undefined;
  /** The include this component sits in (`ddicIsPartOfInclude`). */
  partOfInclude: string | undefined;
  /** How deep in includes it sits (`ddicIncludeHierarchyLevel`). */
  includeLevel: number | undefined;
  /** A field's data element (`ddicDataElement`); absent for a built-in type. */
  dataElement: string | undefined;
  /** A field's ABAP Dictionary type (`ddicDataType`), as SAP writes it. */
  dataType: string | undefined;
  /** A field's length (`ddicLength`). */
  length: number | undefined;
  /** A field's decimals (`ddicDecimals`), where SAP states them. */
  decimals: number | undefined;
  /** `ddicIsKey`, where SAP states it. */
  isKey: boolean | undefined;
  /** Every property entry, its text as written. */
  properties: Record<string, string>;
};

/** A structure's element info. */
export type IStructureElementInfo = IElementInfoObject & {
  /** Every component, in document order. */
  components: IStructureComponent[];
  /** The components that name a structure: each `.include` and `.append`. */
  includes: IStructureComponent[];
  package: IElementInfoPackage | undefined;
};

/** One entity a service definition exposes. */
export type IExposedEntity = IAdtAnsweredObject & {
  /** The entity's name, as its DDL source writes it. */
  name: string;
  /** Its DDL source URI. */
  uri: string | undefined;
  /** The `as` of its `expose`; absent when there is none. */
  alias: string | undefined;
  description: string | undefined;
};

/** A service definition's element info. */
export type IServiceDefinitionElementInfo = IElementInfoObject & {
  /** Every exposed entity, in document order (not the source's). */
  entities: IExposedEntity[];
  /** The definition's links: each extension's (`…/ddic/srvd/extention`). */
  links: IElementInfoLink[];
  package: IElementInfoPackage | undefined;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
});

const ELEMENT = 'abapsource:elementInfo';

const attr = (node: unknown, name: string): string | undefined =>
  leafText(field(node, `@_${name}`));

/** The text of an element that may carry attributes; `''` when empty. */
function text(node: unknown): string | undefined {
  const leaf = leafText(node);
  if (leaf !== undefined) return leaf;
  if (!isElement(node)) return undefined;
  return leafText(field(node, '#text')) ?? '';
}

/** A non-negative integer written in decimal digits, else `undefined`. */
function digits(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) return undefined;
  for (const character of value) {
    if (character < '0' || character > '9') return undefined;
  }
  return Number(value);
}

function flag(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function properties(node: unknown): Record<string, string> {
  const read: Record<string, string> = {};
  const entries = field(
    field(node, 'abapsource:properties'),
    'abapsource:entry',
  );
  for (const entry of listOf(entries)) {
    const key = attr(entry, 'abapsource:key');
    const value = text(entry);
    if (key !== undefined && value !== undefined) read[key] = value;
  }
  return read;
}

function description(node: unknown): string | undefined {
  for (const doc of listOf(field(node, 'abapsource:documentation'))) {
    if (attr(doc, 'abapsource:rel') === 'shorttext') return text(doc);
  }
  return undefined;
}

function links(node: unknown): IElementInfoLink[] {
  const read: IElementInfoLink[] = [];
  for (const link of listOf(field(node, 'atom:link'))) {
    const rel = attr(link, 'rel');
    const href = attr(link, 'href');
    if (rel !== undefined && href !== undefined) {
      read.push({ rel, href, title: attr(link, 'title') });
    }
  }
  return read;
}

/** One nested element, its code read, or nothing without a code and name. */
interface IChild {
  object: IAdtAnsweredObject;
  name: string;
  node: unknown;
}

/** The root, its object, its package and its other children. */
function readRoot(xml: string): {
  root: unknown;
  object: IElementInfoObject;
  children: IChild[];
  package: IElementInfoPackage | undefined;
} {
  const root: unknown = xml.trim() ? field(parser.parse(xml), ELEMENT) : {};
  const type = attr(root, 'adtcore:type');
  const object: IElementInfoObject = {
    ...(type === undefined ? {} : answeredObject(type)),
    name: attr(root, 'adtcore:name'),
    uri: attr(root, 'adtcore:uri'),
    description: description(root),
  };
  const children: IChild[] = [];
  let found: IElementInfoPackage | undefined;
  for (const node of listOf(field(root, ELEMENT))) {
    const code = attr(node, 'adtcore:type');
    const name = attr(node, 'adtcore:name');
    if (code === undefined || name === undefined) continue;
    const read = answeredObject(code);
    if (read.type === 'DEVC/K') {
      found = { name, uri: attr(node, 'adtcore:uri') };
    } else {
      children.push({ object: read, name, node });
    }
  }
  return { root, object, children, package: found };
}

function component({ object, name, node }: IChild): IStructureComponent {
  const entries = properties(node);
  return {
    ...object,
    name,
    uri: attr(node, 'adtcore:uri'),
    description: description(node),
    includeName: entries.ddicIncludeName,
    partOfInclude: entries.ddicIsPartOfInclude,
    includeLevel: digits(entries.ddicIncludeHierarchyLevel),
    dataElement: entries.ddicDataElement,
    dataType: entries.ddicDataType,
    length: digits(entries.ddicLength),
    decimals: digits(entries.ddicDecimals),
    isKey: flag(entries.ddicIsKey),
    properties: entries,
  };
}

/** A structure's element-info document, read. */
export function readStructureElementInfo(xml: string): IStructureElementInfo {
  const read = readRoot(xml);
  const components = read.children.map(component);
  return {
    ...read.object,
    components,
    includes: components.filter((c) => c.includeName !== undefined),
    package: read.package,
  };
}

/** A service definition's element-info document, read. */
export function readServiceDefinitionElementInfo(
  xml: string,
): IServiceDefinitionElementInfo {
  const read = readRoot(xml);
  return {
    ...read.object,
    entities: read.children.map(({ object, name, node }) => ({
      ...object,
      name,
      uri: attr(node, 'adtcore:uri'),
      alias: properties(node).alias,
      description: description(node),
    })),
    links: links(read.root),
    package: read.package,
  };
}

/** {@link readStructureElementInfo} as a result strategy. */
export const structureElementInfo: IResultStrategy<IStructureElementInfo> = (
  answer,
) => readStructureElementInfo(rawOf(answer));

/** {@link readServiceDefinitionElementInfo} as a result strategy. */
export const serviceDefinitionElementInfo: IResultStrategy<
  IServiceDefinitionElementInfo
> = (answer) => readServiceDefinitionElementInfo(rawOf(answer));
