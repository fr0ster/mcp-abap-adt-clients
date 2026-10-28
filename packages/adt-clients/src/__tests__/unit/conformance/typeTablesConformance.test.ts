/**
 * The conformance check of the ADT type tables, against the recorded answers
 * of each release (spec 4; corpus README, `conformance/`).
 *
 * Per release, the table of its variant is held to the release's
 * `typestructure`, `discovery` and — where samples are recorded — each
 * sample's `urimapper` and metadata answers. Every conflict found must be in
 * the committed divergence list (`recorded.ts`) with its reason, and every
 * entry of that list must still be found; the capability list and the
 * coverage are asserted as recorded lists. A change to a table, to the library
 * or to a recorded answer that changes what the check finds is an edit of
 * those lists, visible in review.
 *
 * The second half proves the check bites: a minimal table and minimal answers
 * that pass, and for each rule one change — to a table entry or to an answer —
 * that makes that rule, and only it, fail.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADT_TYPES_ONPREM,
  type AdtApiTable,
  type AdtOperations,
} from '@mcp-abap-adt/interfaces-adt';
import {
  CORPUS,
  type IIndexedSample,
  RELEASES,
  type RecordedRelease,
  recordedAnswers,
  sampleAnswer,
} from '../../helpers/recordedConformance';
import {
  checkTypeTable,
  codesWithTwoMeanings,
  conflictLine,
  type IConflict,
  type IReleaseAnswers,
  readDiscovery,
  readHasSourceLink,
  readTypeStructure,
  readUrimapperUri,
  type SampleAnswer,
  TYPE_TABLES,
} from '../../helpers/typeTableConformance';
import {
  CREATE_WITHOUT_CAPABILITY,
  DIVERGENCES,
  NO_READABLE_SAMPLE,
  recordedCoverage,
} from './recorded';

const lines = (conflicts: readonly IConflict[]): string[] =>
  conflicts.map(conflictLine).sort();

function tableOf(release: RecordedRelease): AdtApiTable<string> {
  const table = TYPE_TABLES[RELEASES[release]];
  if (!table) throw new Error(`no table for ${release}`);
  return table;
}

describe('one meaning per code', () => {
  it('every code of every entry of every table has one kind and one collection', () => {
    expect(codesWithTwoMeanings(TYPE_TABLES)).toEqual([]);
  });
});

const RECORDED: readonly RecordedRelease[] = [
  's4-2025',
  'abap-cloud',
  'basis-740',
];

describe.each(RECORDED)(
  '%s: the table against the recorded answers',
  (release) => {
    const report = checkTypeTable(tableOf(release), recordedAnswers(release));

    it('finds exactly the committed divergences', () => {
      expect(lines(report.conflicts)).toEqual(lines(DIVERGENCES[release]));
    });

    it('every divergence carries its reason', () => {
      for (const divergence of DIVERGENCES[release]) {
        expect(divergence.reason.length).toBeGreaterThan(0);
      }
    });

    it('lists apart exactly the recorded creates without CREATE', () => {
      expect(report.createWithoutCapability).toEqual(
        CREATE_WITHOUT_CAPABILITY[release],
      );
    });

    it('reports exactly the recorded coverage', () => {
      const recorded = recordedCoverage(release);
      expect(report.notCreated).toEqual(recorded.notCreated);
      expect(Object.keys(report.unserved)).toEqual(recorded.unserved);
    });

    it('names every sample with no readable answer', () => {
      expect(report.unreadable).toEqual(NO_READABLE_SAMPLE[release]);
    });
  },
);

describe('basis-740: answers not recorded (the SAP_BASIS 7.40 system is unavailable)', () => {
  // The 7.40 table's sample-based rules (address, source) are not run; the
  // other rules run above against its recorded discovery and typestructure.
  it('has no conformance/basis-740/ yet — when it is recorded, this fails and the sample rules run', () => {
    expect(existsSync(join(CORPUS, 'conformance', 'basis-740'))).toBe(false);
    expect(recordedAnswers('basis-740').samples).toBeUndefined();
  });
  it.todo(
    'basis-740: address — urimapper answers not recorded (the 7.40 system is unavailable)',
  );
  it.todo(
    'basis-740: source — metadata answers not recorded (the 7.40 system is unavailable)',
  );
});

describe('a deliberate break fails the check against the recorded answers', () => {
  it('a table entry: CLAS/OC accepting a longer name than S/4HANA 2025 lists', () => {
    const facts = ADT_TYPES_ONPREM.class.codes['CLAS/OC'];
    const broken: AdtApiTable<string> = {
      ...ADT_TYPES_ONPREM,
      class: {
        ...ADT_TYPES_ONPREM.class,
        codes: { 'CLAS/OC': { ...facts, nameMaxLength: 31 } },
      },
    };
    const report = checkTypeTable(broken, recordedAnswers('s4-2025'));
    expect(lines(report.conflicts)).toContain(
      'name-length: class CLAS/OC: nameMaxLength 31 exceeds OBJNAME_MAXLENGTH 30',
    );
  });

  it('a recorded answer: S/4HANA 2025 not advertising the class collection', () => {
    const recorded = recordedAnswers('s4-2025');
    const collections = new Map(recorded.collections);
    collections.delete('/sap/bc/adt/oo/classes');
    const report = checkTypeTable(ADT_TYPES_ONPREM, {
      ...recorded,
      collections,
    });
    expect(lines(report.conflicts)).toContain(
      'collection: class CLAS/OC: /sap/bc/adt/oo/classes is not advertised',
    );
  });
});

// ---------------------------------------------------------------------------
// The check bites: one fixture per rule
// ---------------------------------------------------------------------------

const EVIDENCE = 'system-description-fixture--07-typestructure';

interface ITableChange {
  classOps?: AdtOperations;
  classLength?: number;
  functionGroupCollection?: `/sap/bc/${string}`;
  functionModuleParent?: 'functionGroup' | null;
  classKind?: Lowercase<string>;
}

/** A class, a function group and its function module. */
function fixtureTable(change: ITableChange = {}): AdtApiTable<string> {
  return {
    class: {
      kind: change.classKind ?? 'class',
      collection: '/sap/bc/adt/oo/classes',
      codes: {
        'CLAS/OC': {
          parent: null,
          nameMaxLength: change.classLength ?? 30,
          operations: change.classOps ?? [
            'create',
            'read',
            'source',
            'updateMetadata',
            'run',
            'profile',
          ],
          evidence: EVIDENCE,
        },
      },
    },
    functionGroup: {
      kind: 'function_group',
      collection:
        change.functionGroupCollection ?? '/sap/bc/adt/functions/groups',
      codes: {
        'FUGR/F': {
          parent: null,
          nameMaxLength: 26,
          operations: ['read'],
          evidence: EVIDENCE,
        },
      },
    },
    functionModule: {
      kind: 'function_module',
      collection: '/sap/bc/adt/functions/groups',
      codes: {
        'FUGR/FF': {
          parent:
            change.functionModuleParent === undefined
              ? 'functionGroup'
              : change.functionModuleParent,
          nameMaxLength: 30,
          operations: ['read', 'source', 'updateMetadata'],
          evidence: EVIDENCE,
        },
      },
    },
  };
}

interface IDescriptor {
  code: string;
  label: string;
  parent: string;
  length: number;
  capabilities: string[];
}

const BASE_TYPES: IDescriptor[] = [
  {
    code: 'CLAS/OC',
    label: 'Class',
    parent: '',
    length: 30,
    capabilities: ['EXECUTE', 'CREATE', 'PROFILE'],
  },
  {
    code: 'FUGR/F',
    label: 'Function Group',
    parent: '',
    length: 26,
    capabilities: [],
  },
  {
    code: 'FUGR/FF',
    label: 'Function Module',
    parent: 'FUGR/F',
    length: 30,
    capabilities: [],
  },
  {
    code: 'ZZZZ/Z',
    label: 'Other',
    parent: '',
    length: 30,
    capabilities: ['CREATE'],
  },
];

function typestructureXml(types: IDescriptor[]): string {
  const descriptor = (t: IDescriptor) =>
    [
      '<SEU_ADT_OBJECT_TYPE_DESCRIPTOR>',
      `<OBJECT_TYPE>${t.code}</OBJECT_TYPE>`,
      `<OBJECT_TYPE_LABEL>${t.label}</OBJECT_TYPE_LABEL>`,
      t.parent
        ? `<PARENT_OBJECT_TYPE>${t.parent}</PARENT_OBJECT_TYPE>`
        : '<PARENT_OBJECT_TYPE/>',
      `<OBJNAME_MAXLENGTH>${t.length}</OBJNAME_MAXLENGTH>`,
      t.capabilities.length
        ? `<CAPABILITIES>${t.capabilities.map((c) => `<SEU_ACTION>${c}</SEU_ACTION>`).join('')}</CAPABILITIES>`
        : '<CAPABILITIES/>',
      // Another user's authorization must not be read as a capability.
      '<USER_AUTHORIZATIONS><SEU_ACTION>EXECUTE</SEU_ACTION></USER_AUTHORIZATIONS>',
      '</SEU_ADT_OBJECT_TYPE_DESCRIPTOR>',
    ].join('');
  return `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>${types.map(descriptor).join('')}</DATA></asx:values></asx:abap>`;
}

interface ICollectionFixture {
  href: string;
  accepts: string[];
  templateLinks?: { template: string; type: string }[];
}

const BASE_COLLECTIONS: ICollectionFixture[] = [
  {
    href: '/sap/bc/adt/oo/classes',
    accepts: ['application/vnd.sap.adt.oo.classes.v4+xml'],
  },
  {
    href: '/sap/bc/adt/functions/groups',
    accepts: ['application/vnd.sap.adt.functions.groups.v3+xml'],
    templateLinks: [
      {
        template: '/sap/bc/adt/functions/groups/{groupname}/fmodules',
        type: 'application/vnd.sap.adt.functions.fmodules.v3+xml',
      },
    ],
  },
];

function discoveryXml(collections: ICollectionFixture[]): string {
  const collection = (c: ICollectionFixture) =>
    [
      `<app:collection href="${c.href}">`,
      c.accepts.length
        ? c.accepts.map((a) => `<app:accept>${a}</app:accept>`).join('')
        : '<app:accept/>',
      '<adtcomp:templateLinks xmlns:adtcomp="http://www.sap.com/adt/compatibility">',
      ...(c.templateLinks ?? []).map(
        (l) =>
          `<adtcomp:templateLink template="${l.template}" type="${l.type}"/>`,
      ),
      '</adtcomp:templateLinks>',
      '</app:collection>',
    ].join('');
  return `<?xml version="1.0" encoding="utf-8"?><app:service xmlns:app="http://www.w3.org/2007/app"><app:workspace>${collections.map(collection).join('')}</app:workspace></app:service>`;
}

const urimapperXml = (uri: string) =>
  `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReference adtcore:uri="${uri}" adtcore:type="X" adtcore:name="X" xmlns:adtcore="http://www.sap.com/adt/core"/>`;

const SOURCE = 'http://www.sap.com/adt/relations/source';

/** A metadata document with these links on its root, `type` omitted when `''`. */
function metadataXml(links: { rel: string; type: string }[]): string {
  const link = (l: { rel: string; type: string }) =>
    `<atom:link href="source/main" rel="${l.rel}"${l.type ? ` type="${l.type}"` : ''} xmlns:atom="http://www.w3.org/2005/Atom"/>`;
  return `<?xml version="1.0" encoding="utf-8"?><adtcore:object xmlns:adtcore="http://www.sap.com/adt/core">${links.map(link).join('')}</adtcore:object>`;
}

interface ISampleFixture {
  name: string;
  parent: string | null;
  uri: string;
  metadata: string;
  metadataStatus?: number;
}

const BASE_SAMPLES: Record<string, ISampleFixture> = {
  'CLAS/OC': {
    name: 'ZCL_X',
    parent: null,
    uri: '/sap/bc/adt/oo/classes/zcl_x',
    metadata: metadataXml([
      { rel: SOURCE, type: 'text/plain' },
      { rel: SOURCE, type: 'text/html' },
    ]),
  },
  'FUGR/F': {
    name: 'ZFG',
    parent: null,
    uri: '/sap/bc/adt/functions/groups/zfg',
    metadata: metadataXml([
      { rel: SOURCE, type: 'text/html' },
      {
        rel: 'http://www.sap.com/adt/relations/sources/textelements',
        type: '',
      },
    ]),
  },
  'FUGR/FF': {
    name: 'Z_FM',
    parent: 'ZFG',
    uri: '/sap/bc/adt/functions/groups/zfg/fmodules/z_fm',
    metadata: metadataXml([{ rel: SOURCE, type: '' }]),
  },
};

interface IAnswerChange {
  types?: IDescriptor[];
  collections?: ICollectionFixture[];
  samples?: Record<string, ISampleFixture> | null;
}

/** The fixture's answers, read through the same readers as the recorded ones. */
function fixtureAnswers(change: IAnswerChange = {}): IReleaseAnswers {
  const samples = change.samples === undefined ? BASE_SAMPLES : change.samples;
  let read: Map<string, SampleAnswer> | undefined;
  if (samples) {
    read = new Map();
    for (const [code, s] of Object.entries(samples)) {
      const indexed: IIndexedSample = {
        name: s.name,
        parent: s.parent,
        reason: undefined,
        files: { template: '', urimapper: '', metadata: '' },
      };
      read.set(
        code,
        sampleAnswer(
          indexed,
          { status: 200, body: urimapperXml(s.uri) },
          { status: s.metadataStatus ?? 200, body: s.metadata },
        ),
      );
    }
  }
  return {
    types: readTypeStructure(typestructureXml(change.types ?? BASE_TYPES)),
    collections: readDiscovery(
      discoveryXml(change.collections ?? BASE_COLLECTIONS),
    ),
    samples: read,
  };
}

const typesWith = (code: string, change: Partial<IDescriptor>) =>
  BASE_TYPES.map((t) => (t.code === code ? { ...t, ...change } : t));

const samplesWith = (code: string, change: Partial<ISampleFixture>) => {
  const base = BASE_SAMPLES[code];
  if (!base) throw new Error(`no base sample ${code}`);
  return { ...BASE_SAMPLES, [code]: { ...base, ...change } };
};

const conflictsOf = (table: AdtApiTable<string>, answers: IReleaseAnswers) =>
  lines(checkTypeTable(table, answers).conflicts);

describe('the check bites: the fixture passes', () => {
  it('a table and answers that agree report no conflict', () => {
    const report = checkTypeTable(fixtureTable(), fixtureAnswers());
    expect(lines(report.conflicts)).toEqual([]);
    expect(report.createWithoutCapability).toEqual([]);
    expect(report.notCreated).toEqual(['ZZZZ/Z']);
    expect(report.unserved).toEqual({ 'ZZZZ/Z': 'Other' });
    expect(report.unreadable).toEqual({});
  });
});

describe('the check bites: each conflict rule, alone', () => {
  it.each<[string, AdtApiTable<string>, IReleaseAnswers, string]>([
    [
      'listed — an answer without the code',
      fixtureTable(),
      fixtureAnswers({
        types: BASE_TYPES.filter((t) => t.code !== 'CLAS/OC'),
      }),
      'listed: class CLAS/OC: not in typestructure',
    ],
    [
      'parent — an answer naming no parent',
      fixtureTable(),
      fixtureAnswers({ types: typesWith('FUGR/FF', { parent: '' }) }),
      "parent: functionModule FUGR/FF: the table's parent functionGroup has code(s) [FUGR/F], typestructure lists ''",
    ],
    [
      'parent — a table entry naming no parent',
      fixtureTable({ functionModuleParent: null }),
      fixtureAnswers(),
      "parent: functionModule FUGR/FF: the table's parent (none) has code(s) [], typestructure lists 'FUGR/F'",
    ],
    [
      'name-length — a table entry accepting a longer name',
      fixtureTable({ classLength: 31 }),
      fixtureAnswers(),
      'name-length: class CLAS/OC: nameMaxLength 31 exceeds OBJNAME_MAXLENGTH 30',
    ],
    [
      'name-length — an answer listing a shorter name',
      fixtureTable(),
      fixtureAnswers({ types: typesWith('FUGR/F', { length: 25 }) }),
      'name-length: functionGroup FUGR/F: nameMaxLength 26 exceeds OBJNAME_MAXLENGTH 25',
    ],
    [
      'collection — a table entry in a collection discovery does not advertise',
      fixtureTable({
        functionGroupCollection: '/sap/bc/adt/functions/gruppen',
      }),
      fixtureAnswers(),
      'collection: functionGroup FUGR/F: /sap/bc/adt/functions/gruppen is not advertised',
    ],
    [
      'address — a urimapper answer the library does not build',
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('CLAS/OC', {
          uri: '/sap/bc/adt/oo/classes/zcl_y',
        }),
      }),
      'address: class CLAS/OC: the library addresses /sap/bc/adt/oo/classes/zcl_x, urimapper answers /sap/bc/adt/oo/classes/zcl_y',
    ],
    [
      'address — a parented sample under another parent',
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('FUGR/FF', {
          uri: '/sap/bc/adt/functions/groups/zother/fmodules/z_fm',
        }),
      }),
      'address: functionModule FUGR/FF: the library addresses /sap/bc/adt/functions/groups/zfg/fmodules/z_fm, urimapper answers /sap/bc/adt/functions/groups/zother/fmodules/z_fm',
    ],
    [
      'execute — run where the answer lists no EXECUTE',
      fixtureTable(),
      fixtureAnswers({
        types: typesWith('CLAS/OC', { capabilities: ['CREATE', 'PROFILE'] }),
      }),
      'execute: class CLAS/OC: run listed, EXECUTE is not',
    ],
    [
      'execute — EXECUTE where no entry runs',
      fixtureTable({
        classOps: ['create', 'read', 'source', 'updateMetadata', 'profile'],
      }),
      fixtureAnswers(),
      'execute: * CLAS/OC: EXECUTE listed, no entry runs it',
    ],
    [
      'profile — profile where the answer lists no PROFILE',
      fixtureTable(),
      fixtureAnswers({
        types: typesWith('CLAS/OC', { capabilities: ['EXECUTE', 'CREATE'] }),
      }),
      'profile: class CLAS/OC: profile listed, PROFILE is not',
    ],
    [
      'profile — PROFILE where no entry profiles',
      fixtureTable({
        classOps: ['create', 'read', 'source', 'updateMetadata', 'run'],
      }),
      fixtureAnswers(),
      'profile: * CLAS/OC: PROFILE listed, no entry profiles it',
    ],
    [
      'source — listed, where the document links only an HTML source',
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('CLAS/OC', {
          metadata: metadataXml([{ rel: SOURCE, type: 'text/html' }]),
        }),
      }),
      'source: class CLAS/OC: source listed, the metadata document links no text/plain or untyped source',
    ],
    [
      'source — not listed, where the document links a plain-text source',
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('FUGR/F', {
          metadata: metadataXml([
            { rel: SOURCE, type: 'text/plain; charset=utf-8' },
          ]),
        }),
      }),
      'source: functionGroup FUGR/F: source not listed, the metadata document links a text/plain or untyped source',
    ],
    [
      'source — not listed, where the document links an untyped source',
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('FUGR/F', {
          metadata: metadataXml([{ rel: SOURCE, type: '' }]),
        }),
      }),
      'source: functionGroup FUGR/F: source not listed, the metadata document links a text/plain or untyped source',
    ],
    [
      'metadata-type — a collection that accepts another type',
      fixtureTable(),
      fixtureAnswers({
        collections: [
          {
            href: '/sap/bc/adt/oo/classes',
            accepts: ['application/vnd.sap.adt.oo.classes.v3+xml'],
          },
          ...BASE_COLLECTIONS.slice(1),
        ],
      }),
      "metadata-type: class CLAS/OC: application/vnd.sap.adt.oo.classes.v4+xml is not among /sap/bc/adt/oo/classes's app:accept [application/vnd.sap.adt.oo.classes.v3+xml]",
    ],
    [
      "metadata-type — a parented code's template link of another type",
      fixtureTable(),
      fixtureAnswers({
        collections: [
          ...BASE_COLLECTIONS.slice(0, 1),
          {
            href: '/sap/bc/adt/functions/groups',
            accepts: ['application/vnd.sap.adt.functions.groups.v3+xml'],
            templateLinks: [
              {
                template: '/sap/bc/adt/functions/groups/{groupname}/fmodules',
                type: 'application/vnd.sap.adt.functions.fmodules.v2+xml',
              },
            ],
          },
        ],
      }),
      "metadata-type: functionModule FUGR/FF: application/vnd.sap.adt.functions.fmodules.v3+xml is not among /sap/bc/adt/functions/groups's app:accept [application/vnd.sap.adt.functions.fmodules.v2+xml]",
    ],
    [
      'sample — a release with samples and none for a code',
      fixtureTable(),
      fixtureAnswers({
        samples: Object.fromEntries(
          Object.entries(BASE_SAMPLES).filter(([code]) => code !== 'CLAS/OC'),
        ),
      }),
      'sample: class CLAS/OC: no sample is recorded',
    ],
  ])('%s', (_case, table, answers, expected) => {
    expect(conflictsOf(table, answers)).toEqual([expected]);
  });
});

describe('the check bites: what is not a conflict', () => {
  it('create without CREATE is listed apart', () => {
    const report = checkTypeTable(
      fixtureTable(),
      fixtureAnswers({
        types: typesWith('CLAS/OC', { capabilities: ['EXECUTE', 'PROFILE'] }),
      }),
    );
    expect(lines(report.conflicts)).toEqual([]);
    expect(report.createWithoutCapability).toEqual(['CLAS/OC']);
  });

  it('CREATE that no entry creates goes into the coverage', () => {
    const report = checkTypeTable(
      fixtureTable({
        classOps: ['read', 'source', 'updateMetadata', 'run', 'profile'],
      }),
      fixtureAnswers(),
    );
    expect(lines(report.conflicts)).toEqual([]);
    expect(report.notCreated).toEqual(['CLAS/OC', 'ZZZZ/Z']);
    expect(report.unserved).toEqual({ 'ZZZZ/Z': 'Other' });
  });

  it('a sample whose metadata read answered 403 is named, and its sample rules are not run', () => {
    const report = checkTypeTable(
      fixtureTable(),
      fixtureAnswers({
        samples: samplesWith('CLAS/OC', {
          uri: '/sap/bc/adt/oo/classes/zcl_y',
          metadata: metadataXml([]),
          metadataStatus: 403,
        }),
      }),
    );
    expect(lines(report.conflicts)).toEqual([]);
    expect(report.unreadable).toEqual({
      'CLAS/OC': 'the metadata read answered 403',
    });
  });

  it('a release with no recorded samples runs no sample rule', () => {
    expect(
      conflictsOf(fixtureTable(), fixtureAnswers({ samples: null })),
    ).toEqual([]);
  });

  it('a release that advertises no app:accept anywhere runs no metadata-type rule', () => {
    expect(
      conflictsOf(
        fixtureTable(),
        fixtureAnswers({
          collections: BASE_COLLECTIONS.map((c) => ({ ...c, accepts: [] })),
        }),
      ),
    ).toEqual([]);
  });
});

describe('the check bites: one meaning per code', () => {
  it('a code with two kinds', () => {
    expect(
      codesWithTwoMeanings({
        a: fixtureTable(),
        b: fixtureTable({ classKind: 'klass' }),
      }),
    ).toEqual(['CLAS/OC: kinds class, klass']);
  });
  it('a code in two collections', () => {
    expect(
      codesWithTwoMeanings({
        a: fixtureTable(),
        b: fixtureTable({ functionGroupCollection: '/sap/bc/adt/fg' }),
      }),
    ).toEqual([
      'FUGR/F: collections /sap/bc/adt/fg, /sap/bc/adt/functions/groups',
    ]);
  });
});

describe('the readers refuse what is not the recorded shape', () => {
  it('a typestructure with a code twice', () => {
    expect(() =>
      readTypeStructure(
        typestructureXml([...BASE_TYPES, ...BASE_TYPES.slice(0, 1)]),
      ),
    ).toThrow('CLAS/OC twice');
  });
  it('a urimapper answer with no object reference', () => {
    expect(() => readUrimapperUri('<?xml version="1.0"?><x/>')).toThrow(
      'expected one objectReference, found 0',
    );
  });
  it('text that is not XML', () => {
    expect(() => readHasSourceLink('<a><b></a>')).toThrow(
      'metadata is not XML',
    );
  });
});
