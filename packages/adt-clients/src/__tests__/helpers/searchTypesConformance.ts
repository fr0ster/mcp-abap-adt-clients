/**
 * The conformance check's search-name rules (spec 3.6): the search type
 * tables of `@mcp-abap-adt/interfaces-adt` (`ADT_SEARCH_TYPES_ONPREM`,
 * `_CLOUD`, `_BASIS_740`) held against what each release recorded
 * (`corpus/adt/informationsystem/<release>/`).
 *
 * Seven rules:
 *
 * - `unlisted` — a name of the table that the release's recorded object
 *   types list does not hold;
 * - `unentered` — a name of the recorded list that the table does not hold;
 * - `type` — a name whose `type` or `group` differs from what the list says
 *   of it: the code its item selects, and whether an item of it is a group
 *   (`type:WGRP`); a name the list holds twice (`HOTA`, a code and a group)
 *   is both;
 * - `main` — a code of the variant's type table whose `main` is no search
 *   name of the variant: the main type a consumer sends as the filter would
 *   not compile;
 * - `evidence` — an entry whose evidence names no recorded case of the
 *   release;
 * - `no-hits` — on a release with no list (7.40), a name of the table whose
 *   recorded quick search answered no hit, or that has no recorded search;
 * - `hits-unentered` — on such a release, a recorded quick search that
 *   answered a hit for a name the table does not hold.
 *
 * **An evidence name is a recorded case.** `<case>--<step tag>` names the
 * exchanges of `informationsystem/<release>/` whose sidecar says that `case`
 * and that `stepTag`: one for a list (`search-types-s4-2025--objecttypes`),
 * one per name searched on 7.40 (`search-types-basis-740--quick-search`).
 *
 * The answers are data from outside the type system, read with runtime
 * checks; the tables are typed and read as typed.
 */

import type {
  AdtApiTable,
  AdtListedSearchType,
  AdtSearchTypeTable,
  IAdtMeasuredSearchType,
} from '@mcp-abap-adt/interfaces-adt';
import { parseAnswer } from './typeTableConformance';
import { elementsNamed, textOf } from './xmlTree';

/** A search type table, read as the shape its entries satisfy. */
export type SearchTypeTable = AdtSearchTypeTable<
  AdtListedSearchType<string> | IAdtMeasuredSearchType
>;

/** Which search-name rule a conflict breaks. */
export type SearchTypeRule =
  | 'unlisted'
  | 'unentered'
  | 'type'
  | 'main'
  | 'evidence'
  | 'no-hits'
  | 'hits-unentered';

export interface ISearchTypeConflict {
  readonly rule: SearchTypeRule;
  /** The search name, or for `main` the code whose main type it is. */
  readonly name: string;
  readonly detail: string;
}

/** What the recorded list says of one name: the code it selects, a group. */
export interface IListedName {
  readonly type: string | undefined;
  readonly group: boolean;
}

/** The type the list writes for a group. */
const GROUP_TYPE = 'WGRP';

/**
 * The quick-search names of an object types list
 * (`GET /repository/informationsystem/objecttypes?…&data=usedByProvider`),
 * by name. Each `namedItem`'s `data` is `type:<code>;usedBy:<users>`; an item
 * whose users do not include `quick_search` names no filter and is left out.
 * A name listed twice is the union of its items, as the search reads it.
 *
 * A document that is not the recorded shape throws: no items, an item count
 * other than `totalItemCount`, an item without a name or a type, a name
 * listed twice with two codes.
 */
export function readObjectTypesList(
  xml: string,
): ReadonlyMap<string, IListedName> {
  const document = parseAnswer(xml, 'object types list');
  const items = elementsNamed(document, 'namedItem');
  if (items.length === 0) throw new Error('object types list: no namedItem');
  const [total] = elementsNamed(document, 'totalItemCount');
  if (!total || Number(textOf(total)) !== items.length) {
    throw new Error(
      `object types list: ${items.length} items, totalItemCount ${total ? textOf(total) : 'absent'}`,
    );
  }
  const names = new Map<string, IListedName>();
  for (const item of items) {
    const name = textOf(item, 'name');
    const data = textOf(item, 'data');
    if (!name) throw new Error('object types list: an item without a name');
    const fields = new Map<string, string>();
    for (const field of data.split(';')) {
      const colon = field.indexOf(':');
      if (colon > 0) fields.set(field.slice(0, colon), field.slice(colon + 1));
    }
    const type = fields.get('type');
    if (!type) throw new Error(`object types list: ${name} has no type`);
    const usedBy = (fields.get('usedBy') ?? '').split(',');
    if (!usedBy.includes('quick_search')) continue;
    const before = names.get(name);
    const code = type === GROUP_TYPE ? undefined : type;
    if (before?.type && code && before.type !== code) {
      throw new Error(
        `object types list: ${name} twice, as ${before.type} and ${code}`,
      );
    }
    names.set(name, {
      type: code ?? before?.type,
      group: type === GROUP_TYPE || (before?.group ?? false),
    });
  }
  return names;
}

/** How many objects a recorded quick search answered. */
export function quickSearchHits(xml: string): number {
  const document = parseAnswer(xml, 'quick search');
  if (elementsNamed(document, 'objectReferences').length !== 1) {
    throw new Error('quick search: not one objectReferences');
  }
  return elementsNamed(document, 'objectReference').length;
}

function describe(listed: IListedName): string {
  const parts = [
    listed.type ? `type ${listed.type}` : '',
    listed.group ? 'a group' : '',
  ].filter((part) => part !== '');
  return parts.length > 0 ? parts.join(' and ') : 'neither type nor group';
}

/** The table against a release's recorded list: `unlisted`, `unentered`, `type`. */
export function checkListedSearchTypes(
  table: SearchTypeTable,
  listed: ReadonlyMap<string, IListedName>,
): ISearchTypeConflict[] {
  const conflicts: ISearchTypeConflict[] = [];
  for (const [name, entry] of Object.entries(table)) {
    const item = listed.get(name);
    if (!item) {
      conflicts.push({
        rule: 'unlisted',
        name,
        detail: `${name} is no name of the recorded list`,
      });
      continue;
    }
    const entered: IListedName = {
      type: entry.type,
      group: entry.group === true,
    };
    if (entered.type !== item.type || entered.group !== item.group) {
      conflicts.push({
        rule: 'type',
        name,
        detail: `the table says ${describe(entered)}, the list ${describe(item)}`,
      });
    }
  }
  for (const name of listed.keys()) {
    if (!Object.hasOwn(table, name)) {
      conflicts.push({
        rule: 'unentered',
        name,
        detail: `${name} is a name of the recorded list the table lacks`,
      });
    }
  }
  return conflicts;
}

/** Every `main` of the variant's type table is a search name: `main`. */
export function checkMainTypes(
  typeTable: AdtApiTable<string>,
  table: SearchTypeTable,
): ISearchTypeConflict[] {
  const conflicts: ISearchTypeConflict[] = [];
  for (const entry of Object.values(typeTable)) {
    if (!entry) continue;
    for (const [code, facts] of Object.entries(entry.codes)) {
      if (!Object.hasOwn(table, facts.main)) {
        conflicts.push({
          rule: 'main',
          name: code,
          detail: `${code}'s main type ${facts.main} is no search name`,
        });
      }
    }
  }
  return conflicts;
}

/** Every entry's evidence is a recorded case of the release: `evidence`. */
export function checkSearchEvidence(
  table: SearchTypeTable,
  recordedEvidence: ReadonlySet<string>,
): ISearchTypeConflict[] {
  return Object.entries(table)
    .filter(([, entry]) => !recordedEvidence.has(entry.evidence))
    .map(([name, entry]) => ({
      rule: 'evidence',
      name,
      detail: `${entry.evidence} is no recorded case`,
    }));
}

/**
 * The table of a release with no list against its recorded quick searches,
 * by name and hit count: `no-hits`, `hits-unentered`.
 */
export function checkMeasuredSearchTypes(
  table: SearchTypeTable,
  searches: ReadonlyMap<string, number>,
): ISearchTypeConflict[] {
  const conflicts: ISearchTypeConflict[] = [];
  for (const name of Object.keys(table)) {
    const hits = searches.get(name);
    if (hits === undefined || hits === 0) {
      conflicts.push({
        rule: 'no-hits',
        name,
        detail:
          hits === undefined
            ? `${name} has no recorded search`
            : `the recorded search for ${name} answered no hit`,
      });
    }
  }
  for (const [name, hits] of searches) {
    if (hits > 0 && !Object.hasOwn(table, name)) {
      conflicts.push({
        rule: 'hits-unentered',
        name,
        detail: `the recorded search for ${name} answered ${hits} hit(s), and the table lacks it`,
      });
    }
  }
  return conflicts;
}

/** What one release recorded for the search names. */
export interface ISearchTypeAnswers {
  /** The `<case>--<stepTag>` of every recorded exchange. */
  readonly evidence: ReadonlySet<string>;
  /** The object types list, where the release answered one. */
  readonly listed: ReadonlyMap<string, IListedName> | undefined;
  /** Each recorded quick search's filter and hit count. */
  readonly searches: ReadonlyMap<string, number>;
}

/** Every conflict of one release's tables with its answers, sorted. */
export function checkSearchTypes(
  table: SearchTypeTable,
  typeTable: AdtApiTable<string>,
  answers: ISearchTypeAnswers,
): ISearchTypeConflict[] {
  const conflicts = [
    ...(answers.listed
      ? checkListedSearchTypes(table, answers.listed)
      : checkMeasuredSearchTypes(table, answers.searches)),
    ...checkMainTypes(typeTable, table),
    ...checkSearchEvidence(table, answers.evidence),
  ];
  return conflicts.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.name.localeCompare(b.name),
  );
}
