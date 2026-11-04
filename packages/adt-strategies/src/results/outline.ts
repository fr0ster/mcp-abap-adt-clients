/**
 * An object's outline — what `AdtUtils.getObjectOutline` answers
 * (`GET <object uri>/objectstructure`), read into a tree.
 *
 * Measured on premise and on ABAP cloud (2026-11-04): one root
 * `abapsource:objectStructureElement` with nested ones, each with its
 * `adtcore:type` and `adtcore:name`, and `atom:link`s whose `rel` ends in
 * `definitionIdentifier`, `implementationIdentifier`, `definitionBlock` or
 * `implementationBlock`. A class's and an interface's links name a position,
 * `<include>#start=l,c;end=l,c` — lines from 1, columns from 0, `end`
 * exclusive, checked against every source read back; a program's and a
 * function group's name their target (`#type=…;name=…`) or a source URI
 * only. No element carries a signature: a method's is the text its
 * `definitionBlock` spans.
 *
 * A document that is not an outline — an exception, nothing — reads as no
 * root; whether it was a refusal is the error strategy's question.
 */

import type {
  IAdtAnsweredObject,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field, isElement, leafText, listOf } from '../parsed';
import { rawOf } from '../result';
import { answeredObject } from './answeredObject';

/** A position in a source: line from 1, column from 0. */
export interface IOutlinePoint {
  line: number;
  column: number;
}

/** One link of an element, as SAP wrote it and as far as it reads. */
export interface IOutlineLink {
  /** The last segment of `rel`: `definitionIdentifier`, `definitionBlock`, … */
  rel: string;
  /** `href` as written — relative to the answer's `xml:base` for a class. */
  href: string;
  /** `href` before its `#`: the source the link points into. */
  source: string;
  /** The fragment after `#`, as written; absent when there is none. */
  fragment: string | undefined;
  /** `start` of a `#start=l,c;end=l,c` fragment; absent otherwise. */
  start: IOutlinePoint | undefined;
  /** `end` (exclusive) of that fragment; absent otherwise. */
  end: IOutlinePoint | undefined;
  /** The link's own `type`, when SAP gives one (an implemented method's). */
  type: string | undefined;
}

/** One element of the outline, with its children in document order. */
export type IOutlineElement = IAdtAnsweredObject & {
  name: string;
  /** `public` | `protected` | `private`, where SAP states one. */
  visibility: string | undefined;
  /** `instance` | `static`, where SAP states one. */
  level: string | undefined;
  /** The class or interface a component belongs to (`clif_name`). */
  clifName: string | undefined;
  /** The include a program component sits in (`include`). */
  include: string | undefined;
  /** The short text, when the read asked for descriptions. */
  description: string | undefined;
  /** `true` where SAP marks the component a constant. */
  constant: boolean;
  /** `true` where SAP marks it read-only. */
  readOnly: boolean;
  /** `true` where SAP marks it final (the class itself). */
  final: boolean;
  links: IOutlineLink[];
  children: IOutlineElement[];
};

/** The outline: its root and the answer's `xml:base`. */
export interface IObjectOutline {
  /** The base relative links resolve against; absent when not given. */
  base: string | undefined;
  /** The object itself; absent for a document that is not an outline. */
  root: IOutlineElement | undefined;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
});

const ELEMENT = 'abapsource:objectStructureElement';

const attr = (node: unknown, name: string): string | undefined =>
  leafText(field(node, `@_${name}`));

/** A non-negative integer written in decimal digits, else `undefined`. */
function digits(text: string): number | undefined {
  if (text.length === 0) return undefined;
  for (const character of text) {
    if (character < '0' || character > '9') return undefined;
  }
  return Number(text);
}

/** `l,c`, or `undefined` when the text is not one. */
function point(text: string | undefined): IOutlinePoint | undefined {
  if (text === undefined) return undefined;
  const comma = text.indexOf(',');
  if (comma === -1) return undefined;
  const line = digits(text.slice(0, comma));
  const column = digits(text.slice(comma + 1));
  return line === undefined || column === undefined
    ? undefined
    : { line, column };
}

/** The `key=value` pairs of a fragment, split on `;`. */
function fragmentPairs(fragment: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const part of fragment.split(';')) {
    const equals = part.indexOf('=');
    if (equals > 0) pairs.set(part.slice(0, equals), part.slice(equals + 1));
  }
  return pairs;
}

function readLink(node: unknown): IOutlineLink | undefined {
  const rel = attr(node, 'rel');
  const href = attr(node, 'href');
  if (rel === undefined || href === undefined) return undefined;
  const hash = href.indexOf('#');
  const fragment = hash === -1 ? undefined : href.slice(hash + 1);
  const pairs =
    fragment === undefined
      ? new Map<string, string>()
      : fragmentPairs(fragment);
  return {
    rel: rel.slice(rel.lastIndexOf('/') + 1),
    href,
    source: hash === -1 ? href : href.slice(0, hash),
    fragment,
    start: point(pairs.get('start')),
    end: point(pairs.get('end')),
    type: attr(node, 'type'),
  };
}

function readElement(node: unknown): IOutlineElement | undefined {
  if (!isElement(node)) return undefined;
  const type = attr(node, 'adtcore:type');
  const name = attr(node, 'adtcore:name');
  if (type === undefined || name === undefined) return undefined;
  const links: IOutlineLink[] = [];
  for (const link of listOf(field(node, 'atom:link'))) {
    const read = readLink(link);
    if (read !== undefined) links.push(read);
  }
  const children: IOutlineElement[] = [];
  for (const child of listOf(field(node, ELEMENT))) {
    const read = readElement(child);
    if (read !== undefined) children.push(read);
  }
  return {
    ...answeredObject(type),
    name,
    visibility: attr(node, 'visibility'),
    level: attr(node, 'level'),
    clifName: attr(node, 'clif_name'),
    include: attr(node, 'include'),
    description: attr(node, 'description'),
    constant: attr(node, 'constant') === 'true',
    readOnly: attr(node, 'readOnly') === 'true',
    final: attr(node, 'final') === 'true',
    links,
    children,
  };
}

/** An outline document, read into its tree. */
export function readObjectOutline(xml: string): IObjectOutline {
  if (!xml.trim()) return { base: undefined, root: undefined };
  const parsed: unknown = parser.parse(xml);
  const root = field(parsed, ELEMENT);
  return {
    base: attr(root, 'xml:base'),
    root: readElement(root),
  };
}

/** {@link readObjectOutline} as a result strategy, for a caller's set. */
export const objectOutline: IResultStrategy<IObjectOutline> = (answer) =>
  readObjectOutline(rawOf(answer));
