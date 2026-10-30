/**
 * The conformance check's search-name rules (spec 3.6): the search type
 * tables `ADT_SEARCH_TYPES_ONPREM`, `_CLOUD` and `_BASIS_740` against each
 * release's recorded answers (`corpus/adt/informationsystem/<release>/`).
 *
 * Per release: on S/4HANA 2025 and ABAP cloud the table equals the recorded
 * object types list, name for name, `type` for `type`, groups as groups; on
 * SAP_BASIS 7.40, which has no list, every name has a recorded search with a
 * hit and every recorded name the table lacks answered none; on all three,
 * every `main` of the variant's type table is a search name of it, and every
 * evidence name is a recorded case. Every conflict found must be in
 * `SEARCH_TYPE_DIVERGENCES` with its reason, and every entry there must still
 * be found.
 *
 * The second half proves the check bites: a minimal table and answers that
 * pass, and for each rule one change that makes that rule, and only it, fail.
 */

import {
  ADT_SEARCH_TYPES_BASIS_740,
  ADT_SEARCH_TYPES_CLOUD,
  ADT_SEARCH_TYPES_ONPREM,
  type AdtApiTable,
} from '@mcp-abap-adt/interfaces-adt';
import {
  RELEASES,
  type RecordedRelease,
  recordedSearchTypes,
} from '../../helpers/recordedConformance';
import {
  checkSearchTypes,
  type IListedName,
  type ISearchTypeAnswers,
  type ISearchTypeConflict,
  quickSearchHits,
  readObjectTypesList,
  type SearchTypeTable,
} from '../../helpers/searchTypesConformance';
import { TYPE_TABLES } from '../../helpers/typeTableConformance';
import { SEARCH_TYPE_DIVERGENCES } from './recorded';

const SEARCH_TABLES: { readonly [R in RecordedRelease]: SearchTypeTable } = {
  's4-2025': ADT_SEARCH_TYPES_ONPREM,
  'abap-cloud': ADT_SEARCH_TYPES_CLOUD,
  'basis-740': ADT_SEARCH_TYPES_BASIS_740,
};

function typeTableOf(release: RecordedRelease): AdtApiTable<string> {
  const table = TYPE_TABLES[RELEASES[release]];
  if (!table) throw new Error(`no type table for ${release}`);
  return table;
}

const RECORDED: readonly RecordedRelease[] = [
  's4-2025',
  'abap-cloud',
  'basis-740',
];

describe.each(RECORDED)(
  '%s: the search type table against the recorded answers',
  (release) => {
    it('reports exactly the recorded divergences', () => {
      const conflicts = checkSearchTypes(
        SEARCH_TABLES[release],
        typeTableOf(release),
        recordedSearchTypes(release),
      );
      expect(conflicts).toEqual(
        SEARCH_TYPE_DIVERGENCES[release].map(({ rule, name, detail }) => ({
          rule,
          name,
          detail,
        })),
      );
    });
  },
);

describe('what each release recorded', () => {
  it('S/4HANA 2025 lists 385 names in 386 items, HOTA a code and a group', () => {
    const { listed } = recordedSearchTypes('s4-2025');
    expect(listed?.size).toBe(385);
    expect(listed?.get('HOTA')).toEqual({ type: 'HOTA/HDI', group: true });
    expect(listed?.get('STRU')).toEqual({ type: 'TABL/DS', group: false });
  });

  it('ABAP cloud lists 372 names in 373 items', () => {
    expect(recordedSearchTypes('abap-cloud').listed?.size).toBe(372);
  });

  it('7.40 answers no list, and a search per name', () => {
    const { listed, searches } = recordedSearchTypes('basis-740');
    expect(listed).toBeUndefined();
    expect([...searches.keys()].sort()).toEqual(
      [
        ...Object.keys(ADT_SEARCH_TYPES_BASIS_740),
        'STRU',
        'DTAB',
        'REPO',
        'INCL',
        'BADI',
        'NOPE',
      ].sort(),
    );
  });
});

describe('a deliberate break fails the check against the recorded answers', () => {
  it('a recorded list losing a name the table holds: unlisted alone', () => {
    const answers = recordedSearchTypes('s4-2025');
    const listed = new Map(answers.listed);
    listed.delete('DEVC');
    expect(
      checkSearchTypes(ADT_SEARCH_TYPES_ONPREM, typeTableOf('s4-2025'), {
        ...answers,
        listed,
      }),
    ).toEqual([
      {
        rule: 'unlisted',
        name: 'DEVC',
        detail: 'DEVC is no name of the recorded list',
      },
    ]);
  });

  it('a table entry with another code: type alone', () => {
    const { STRU: _stru, ...rest } = ADT_SEARCH_TYPES_ONPREM;
    const table: SearchTypeTable = {
      ...rest,
      STRU: { type: 'TABL/DT', evidence: 'search-types-s4-2025--objecttypes' },
    };
    expect(
      checkSearchTypes(
        table,
        typeTableOf('s4-2025'),
        recordedSearchTypes('s4-2025'),
      ),
    ).toEqual([
      {
        rule: 'type',
        name: 'STRU',
        detail: 'the table says type TABL/DT, the list type TABL/DS',
      },
    ]);
  });
});

/** A type table with one class code whose main type is `CLAS`. */
const FIXTURE_TYPES: AdtApiTable<string> = {
  class: {
    kind: 'class',
    collection: '/sap/bc/adt/oo/classes',
    codes: {
      'CLAS/OC': {
        main: 'CLAS',
        parent: null,
        nameMaxLength: 30,
        operations: ['read'],
        evidence: 'system-description-fixture--07-typestructure',
      },
    },
  },
};

const LISTED_EVIDENCE = 'search-types-fixture--objecttypes';
const SEARCHED_EVIDENCE = 'search-types-basis-740--quick-search';

/** A listed table: a main type, an alias, a group, and a name twice. */
const FIXTURE_LISTED_TABLE: SearchTypeTable = {
  CLAS: { type: 'CLAS/OC', evidence: LISTED_EVIDENCE },
  STRU: { type: 'TABL/DS', evidence: LISTED_EVIDENCE },
  ABAP_TEST_COCKPIT: { group: true, evidence: LISTED_EVIDENCE },
  HOTA: { type: 'HOTA/HDI', group: true, evidence: LISTED_EVIDENCE },
};

const FIXTURE_LIST = new Map<string, IListedName>([
  ['CLAS', { type: 'CLAS/OC', group: false }],
  ['STRU', { type: 'TABL/DS', group: false }],
  ['ABAP_TEST_COCKPIT', { type: undefined, group: true }],
  ['HOTA', { type: 'HOTA/HDI', group: true }],
]);

const FIXTURE_LISTED_ANSWERS: ISearchTypeAnswers = {
  evidence: new Set([LISTED_EVIDENCE]),
  listed: FIXTURE_LIST,
  searches: new Map(),
};

/** A measured table (7.40's shape): one name. */
const FIXTURE_MEASURED_TABLE: SearchTypeTable = {
  CLAS: { answered: ['CLAS/OC'], evidence: SEARCHED_EVIDENCE },
};

const FIXTURE_MEASURED_ANSWERS: ISearchTypeAnswers = {
  evidence: new Set([SEARCHED_EVIDENCE]),
  listed: undefined,
  searches: new Map<string, readonly string[]>([
    ['CLAS', ['CLAS/OC']],
    ['STRU', []],
  ]),
};

const only = (conflicts: ISearchTypeConflict[]) =>
  conflicts.map(({ rule, name }) => `${rule} ${name}`);

describe('the check bites: the fixtures pass', () => {
  it('a listed table that equals its list', () => {
    expect(
      checkSearchTypes(
        FIXTURE_LISTED_TABLE,
        FIXTURE_TYPES,
        FIXTURE_LISTED_ANSWERS,
      ),
    ).toEqual([]);
  });

  it('a measured table whose name answered a hit, and an alias that answered none', () => {
    expect(
      checkSearchTypes(
        FIXTURE_MEASURED_TABLE,
        FIXTURE_TYPES,
        FIXTURE_MEASURED_ANSWERS,
      ),
    ).toEqual([]);
  });
});

describe('the check bites: each rule, alone', () => {
  it('unlisted: a table name the list lacks', () => {
    const listed = new Map(FIXTURE_LIST);
    listed.delete('STRU');
    expect(
      only(
        checkSearchTypes(FIXTURE_LISTED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_LISTED_ANSWERS,
          listed,
        }),
      ),
    ).toEqual(['unlisted STRU']);
  });

  it('unentered: a list name the table lacks', () => {
    const listed = new Map(FIXTURE_LIST);
    listed.set('DTAB', { type: 'TABL/DT', group: false });
    expect(
      only(
        checkSearchTypes(FIXTURE_LISTED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_LISTED_ANSWERS,
          listed,
        }),
      ),
    ).toEqual(['unentered DTAB']);
  });

  it('type: a code other than the list says', () => {
    expect(
      only(
        checkSearchTypes(
          {
            ...FIXTURE_LISTED_TABLE,
            STRU: { type: 'TABL/DT', evidence: LISTED_EVIDENCE },
          },
          FIXTURE_TYPES,
          FIXTURE_LISTED_ANSWERS,
        ),
      ),
    ).toEqual(['type STRU']);
  });

  it('type: a group entered as no group', () => {
    expect(
      only(
        checkSearchTypes(
          {
            ...FIXTURE_LISTED_TABLE,
            HOTA: { type: 'HOTA/HDI', evidence: LISTED_EVIDENCE },
          },
          FIXTURE_TYPES,
          FIXTURE_LISTED_ANSWERS,
        ),
      ),
    ).toEqual(['type HOTA']);
  });

  it('type: a name twice in the list, entered as its code alone', () => {
    const listed = new Map(FIXTURE_LIST);
    listed.set('CLAS', { type: 'CLAS/OC', group: true });
    expect(
      only(
        checkSearchTypes(FIXTURE_LISTED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_LISTED_ANSWERS,
          listed,
        }),
      ),
    ).toEqual(['type CLAS']);
  });

  it('main: a code whose main type is no search name', () => {
    const { CLAS: _clas, ...table } = FIXTURE_MEASURED_TABLE;
    expect(
      only(
        checkSearchTypes(
          {
            ...table,
            INTF: { answered: ['INTF/OI'], evidence: SEARCHED_EVIDENCE },
          },
          FIXTURE_TYPES,
          {
            ...FIXTURE_MEASURED_ANSWERS,
            searches: new Map<string, readonly string[]>([
              ['INTF', ['INTF/OI']],
              ['CLAS', []],
            ]),
          },
        ),
      ),
    ).toEqual(['main CLAS/OC']);
  });

  it('evidence: an evidence name no recorded case carries', () => {
    expect(
      only(
        checkSearchTypes(FIXTURE_LISTED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_LISTED_ANSWERS,
          evidence: new Set(['search-types-fixture--01-objecttypes']),
        }),
      ),
    ).toEqual([
      'evidence ABAP_TEST_COCKPIT',
      'evidence CLAS',
      'evidence HOTA',
      'evidence STRU',
    ]);
  });

  it('no-hits: a measured name whose recorded search answered none', () => {
    expect(
      only(
        checkSearchTypes(FIXTURE_MEASURED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_MEASURED_ANSWERS,
          searches: new Map<string, readonly string[]>([
            ['CLAS', []],
            ['STRU', []],
          ]),
        }),
      ),
    ).toEqual(['no-hits CLAS']);
  });

  it('answered: a measured name whose hits carry another code than the table says', () => {
    expect(
      checkSearchTypes(FIXTURE_MEASURED_TABLE, FIXTURE_TYPES, {
        ...FIXTURE_MEASURED_ANSWERS,
        searches: new Map<string, readonly string[]>([
          ['CLAS', ['PROG/P', 'PROG/P']],
          ['STRU', []],
        ]),
      }).map(({ rule, name, detail }) => `${rule} ${name}: ${detail}`),
    ).toEqual([
      'answered CLAS: the recorded search for CLAS answered PROG/P, the table says CLAS/OC',
    ]);
  });

  it('answered: a hit of one more code than the table says', () => {
    expect(
      only(
        checkSearchTypes(FIXTURE_MEASURED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_MEASURED_ANSWERS,
          searches: new Map<string, readonly string[]>([
            ['CLAS', ['CLAS/OC', 'INTF/OI']],
            ['STRU', []],
          ]),
        }),
      ),
    ).toEqual(['answered CLAS']);
  });

  it('no-hits: a measured name with no recorded search', () => {
    expect(
      only(
        checkSearchTypes(FIXTURE_MEASURED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_MEASURED_ANSWERS,
          searches: new Map<string, readonly string[]>([['STRU', []]]),
        }),
      ),
    ).toEqual(['no-hits CLAS']);
  });

  it('hits-unentered: a recorded name the table lacks that answered a hit', () => {
    expect(
      only(
        checkSearchTypes(FIXTURE_MEASURED_TABLE, FIXTURE_TYPES, {
          ...FIXTURE_MEASURED_ANSWERS,
          searches: new Map<string, readonly string[]>([
            ['CLAS', ['CLAS/OC']],
            ['STRU', ['TABL/DS', 'TABL/DS', 'TABL/DS']],
          ]),
        }),
      ),
    ).toEqual(['hits-unentered STRU']);
  });
});

describe('the readers refuse what is not the recorded shape', () => {
  const list = (items: string, total: number) =>
    '<?xml version="1.0" encoding="utf-8"?><nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem">' +
    `<nameditem:totalItemCount>${total}</nameditem:totalItemCount>${items}</nameditem:namedItemList>`;
  const item = (name: string, data: string) =>
    `<nameditem:namedItem><nameditem:name>${name}</nameditem:name><nameditem:data>${data}</nameditem:data></nameditem:namedItem>`;

  it('reads a name twice as the union of its items', () => {
    expect(
      readObjectTypesList(
        list(
          item('HOTA', 'type:HOTA/HDI;usedBy:quick_search') +
            item('HOTA', 'type:WGRP;usedBy:quick_search'),
          2,
        ),
      ),
    ).toEqual(new Map([['HOTA', { type: 'HOTA/HDI', group: true }]]));
  });

  it('leaves out an item not used by the quick search', () => {
    expect(
      readObjectTypesList(
        list(
          item('CLAS', 'type:CLAS/OC;usedBy:quick_search') +
            item('XXXX', 'type:XXXX;usedBy:virtual_folders'),
          2,
        ),
      ),
    ).toEqual(new Map([['CLAS', { type: 'CLAS/OC', group: false }]]));
  });

  it('an item count other than totalItemCount', () => {
    expect(() =>
      readObjectTypesList(list(item('CLAS', 'type:CLAS/OC'), 2)),
    ).toThrow('object types list: 1 items, totalItemCount 2');
  });

  it('an item without a type', () => {
    expect(() =>
      readObjectTypesList(list(item('CLAS', 'usedBy:quick_search'), 1)),
    ).toThrow('object types list: CLAS has no type');
  });

  it('a name twice with two codes', () => {
    expect(() =>
      readObjectTypesList(
        list(
          item('CLAS', 'type:CLAS/OC;usedBy:quick_search') +
            item('CLAS', 'type:CLAS/OCX;usedBy:quick_search'),
          2,
        ),
      ),
    ).toThrow('object types list: CLAS twice, as CLAS/OC and CLAS/OCX');
  });

  it("a quick search answer reads each object reference's code", () => {
    expect(
      quickSearchHits(
        '<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">' +
          '<adtcore:objectReference adtcore:type="CLAS/OC" adtcore:name="A"/>' +
          '<adtcore:objectReference adtcore:type="CLAS/OC" adtcore:name="B"/>' +
          '</adtcore:objectReferences>',
      ),
    ).toEqual(['CLAS/OC', 'CLAS/OC']);
    expect(() => quickSearchHits('<x/>')).toThrow(
      'quick search: not one objectReferences',
    );
  });
});
