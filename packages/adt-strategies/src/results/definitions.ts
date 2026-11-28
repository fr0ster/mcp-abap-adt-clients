/**
 * Reading the definitions of an application log object (`APLO/TYP`), an
 * application job catalog (`SAJC`) and an application job template (`SAJT`):
 * the source (`/source/main`, JSON) and the ADT object document
 * (`blue:blueSource`).
 *
 * Measured on ABAP cloud and on premise (2026-11-28, one object of each type
 * per kind): the source answered `application/json` — a `formatVersion`, a
 * `header`, and the subobjects (APLO), the class (SAJC) or the catalog name
 * (SAJT); the object document answered `application/vnd.sap.adt.blues.v1+xml`
 * (APLO) or `…blues.v2+xml` (SAJC, SAJT), its fields as `adtcore:` attributes
 * of the root. The fields of other objects of these types are unverified, so
 * every field read here is optional.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  field,
  isElement,
  leafText,
  listOf,
  parsedOrNothing,
  XML_TEXT_OPTIONS,
} from '../parsed';
import { rawOf } from '../result';

/** `jsonDocument`: the body parsed as JSON, or `undefined` when it does not parse. */
export const jsonDocument: IResultStrategy<unknown> = (answer) => {
  const text = rawOf(answer);
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
};

/** One `atom:link` of an object document, each attribute as written. */
export interface IBluesLink {
  readonly rel: string | undefined;
  readonly href: string | undefined;
  readonly type: string | undefined;
  readonly title: string | undefined;
}

/** What a `blue:blueSource` object document states, field by field. */
export interface IBluesMetadata {
  readonly name: string | undefined;
  readonly type: string | undefined;
  readonly description: string | undefined;
  readonly language: string | undefined;
  readonly masterLanguage: string | undefined;
  readonly masterSystem: string | undefined;
  readonly abapLanguageVersion: string | undefined;
  readonly version: string | undefined;
  readonly createdAt: string | undefined;
  readonly changedAt: string | undefined;
  readonly createdBy: string | undefined;
  readonly changedBy: string | undefined;
  readonly responsible: string | undefined;
  readonly packageName: string | undefined;
  readonly packageDescription: string | undefined;
  readonly links: readonly IBluesLink[];
}

const bluesParser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: false,
});

const attribute = (node: unknown, name: string): string | undefined =>
  leafText(field(node, `@${name}`));

/**
 * `bluesMetadata`: the object document read, or `undefined` when the body is
 * not XML or its root is not `blue:blueSource`.
 */
export const bluesMetadata: IResultStrategy<IBluesMetadata | undefined> = (
  answer,
) => {
  const xml = rawOf(answer);
  if (xml.trim() === '' || XMLValidator.validate(xml) !== true) {
    return undefined;
  }
  const root = field(parsedOrNothing(bluesParser, xml), 'blue:blueSource');
  if (!isElement(root) || Array.isArray(root)) return undefined;
  const core = (name: string) => attribute(root, `adtcore:${name}`);
  const packageRef = field(root, 'adtcore:packageRef');
  return {
    name: core('name'),
    type: core('type'),
    description: core('description'),
    language: core('language'),
    masterLanguage: core('masterLanguage'),
    masterSystem: core('masterSystem'),
    abapLanguageVersion: core('abapLanguageVersion'),
    version: core('version'),
    createdAt: core('createdAt'),
    changedAt: core('changedAt'),
    createdBy: core('createdBy'),
    changedBy: core('changedBy'),
    responsible: core('responsible'),
    packageName: attribute(packageRef, 'adtcore:name'),
    packageDescription: attribute(packageRef, 'adtcore:description'),
    links: listOf(field(root, 'atom:link')).map((link) => ({
      rel: attribute(link, 'rel'),
      href: attribute(link, 'href'),
      type: attribute(link, 'type'),
      title: attribute(link, 'title'),
    })),
  };
};
