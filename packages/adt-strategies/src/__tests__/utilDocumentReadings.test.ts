import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  readSearchHits,
  utilInactiveObjects,
  utilNamedItems,
  utilNodeContents,
  utilSearchHits,
  utilWhereUsedReferences,
} from '../results/utils';
import { stepsOf, stepTagged } from './corpus';
import { NAMED_ITEMS, SEARCH_ENTITY } from './serverDocuments';

/**
 * The readings the server team found reading something other than what the
 * document holds (adt-strategies 0.28.0), each pinned on the document it was
 * found with: a recording of adt-clients' corpus (`stepTagged`), or a
 * document of the server's tests (`serverDocuments.ts`, which names the file
 * each came from).
 */
const wire = (data: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
});

// ---------------------------------------------------------------------------
// utilWhereUsedReferences
// ---------------------------------------------------------------------------

describe('utilWhereUsedReferences keeps every reference the document holds', () => {
  const answer = stepTagged(
    'read-where-used-list-structure',
    'informationsystem-usagereferences',
  );

  it('reads the four references of the recorded document, packages included, each with its kind', () => {
    const { references } = utilWhereUsedReferences(answer);
    expect(references.map((r) => [r.kind, r.type, r.name])).toEqual([
      ['object', 'BDEF/BDO', 'ZMCP_SHR_I_ROOT'],
      ['package', 'DEVC/K', 'ZADT_BLD_PKG03'],
      ['package', 'DEVC/K', 'ZLOCAL'],
      ['package', 'DEVC/K', 'ZMCP_SHR_PKG'],
    ]);
    expect(references[0]).toMatchObject({
      uri: '/sap/bc/adt/bo/behaviordefinitions/zmcp_shr_i_root',
      parentUri: '/sap/bc/adt/packages/zmcp_shr_pkg',
      packageName: 'ZMCP_SHR_PKG',
      responsible: 'SAPUSER01',
      isResult: false,
      usageInformation: 'gradeDirect,includeProductive',
      objectIdentifier:
        'ObjectType_BDEF/BDO;ZMCP_SHR_I_ROOT;\\TY:ZBP_MCP_SHR_I_ROOT',
    });
    expect(references[2].parentUri).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// utilInactiveObjects
// ---------------------------------------------------------------------------

describe('utilInactiveObjects reads both forms and refuses any other', () => {
  it('reads the 7.40 adtcore:objectReferences form (recorded on SAP_BASIS 7.40 SP04)', () => {
    const { objects } = utilInactiveObjects(
      stepTagged('activation-class-basis-740', 'inactiveobjects'),
    );
    expect(objects.map((o) => [o.type, o.name, o.uri])).toEqual([
      [
        'CLAS/OC',
        'ZMCP_BLD_CLSUT_L1',
        '/sap/bc/adt/oo/classes/zmcp_bld_clsut_l1',
      ],
      [
        'CLAS/OC',
        'ZMCP_TMP_177_DQQY',
        '/sap/bc/adt/oo/classes/zmcp_tmp_177_dqqy',
      ],
      [
        'PROG/P',
        'ZMCP_SYS_PROG_H1',
        '/sap/bc/adt/programs/programs/zmcp_sys_prog_h1',
      ],
      [
        'PROG/P',
        'ZMCP_SYS_PROG_L1',
        '/sap/bc/adt/programs/programs/zmcp_sys_prog_l1',
      ],
      ['PROG/P', 'ZOK_TESTER', '/sap/bc/adt/programs/programs/zok_tester'],
    ]);
  });

  it('reads every object of an entry and every reference of an object', () => {
    const ref = (name: string) =>
      `<ioc:ref adtcore:uri="/sap/bc/adt/oo/classes/${name.toLowerCase()}" adtcore:type="CLAS/OC" adtcore:name="${name}"/>`;
    const listing =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">' +
      `<ioc:entry><ioc:object>${ref('ZCL_A')}${ref('ZCL_B')}</ioc:object><ioc:object>${ref('ZCL_C')}</ioc:object><ioc:transport/></ioc:entry>` +
      '</ioc:inactiveObjects>';
    expect(
      utilInactiveObjects(wire(listing)).objects.map((o) => o.name),
    ).toEqual(['ZCL_A', 'ZCL_B', 'ZCL_C']);
  });

  it('reads the recorded S/4HANA 2025 listing as before', () => {
    const { objects } = utilInactiveObjects(
      stepTagged('activation-group-alone-s4-2025', 'inactiveobjects'),
    );
    expect(objects.map((o) => o.name)).toEqual([
      'ZACT751P9325',
      'SAPLZACT751P9325',
    ]);
  });

  it.each([
    ['an exception document', '<exc:exception xmlns:exc="x"/>'],
    ['a logon page', '<html><body>Logon</body></html>'],
    ['an empty body', ''],
    ['a body that is not XML', '<ioc:inactiveObjects'],
  ])('refuses %s, in fixed words', (_what, data) => {
    expect(() => utilInactiveObjects(wire(data))).toThrow(
      'utilInactiveObjects: the answer is no inactive-objects list',
    );
  });
});

// ---------------------------------------------------------------------------
// utilSearchHits
// ---------------------------------------------------------------------------

describe('utilSearchHits decodes references as an XML parser does', () => {
  it('reads &#x26; as &', () => {
    expect(utilSearchHits(wire(SEARCH_ENTITY))[0].description).toBe(
      'this & that',
    );
  });

  it('decodes decimal and hex references and the predefined entities in one pass', () => {
    const hit = (description: string) =>
      readSearchHits(
        `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:type="CLAS/OC" adtcore:name="ZCL_A" adtcore:description="${description}"/></adtcore:objectReferences>`,
      )[0].description;
    expect(hit('&#38;&#x3C;&#X3c;&lt;&gt;&quot;&apos;&amp;')).toBe(
      '&<&#X3c;<>"\'&',
    );
    expect(hit('&amp;#x26;')).toBe('&#x26;');
    expect(hit('&#x1F600;')).toBe('\u{1F600}');
    expect(hit('&nbsp;&#0;&#xD800;&;&#x;')).toBe('&nbsp;&#0;&#xD800;&;&#x;');
  });
});

// ---------------------------------------------------------------------------
// utilNamedItems
// ---------------------------------------------------------------------------

describe('utilNamedItems keeps text as written', () => {
  it('keeps 007 as 007 and an absent description absent', () => {
    const items = utilNamedItems(wire(NAMED_ITEMS));
    expect(items).toEqual([
      { name: '007', description: 'leading zeros' },
      { name: 'NODESC' },
    ]);
    // A present `description: undefined` is refused, not only a missing one.
    expect(items[1] !== undefined && 'description' in items[1]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// utilNodeContents
// ---------------------------------------------------------------------------

describe('utilNodeContents keeps the node descriptions', () => {
  it('reads each object’s description off the recorded node structure', () => {
    const { objects } = utilNodeContents(
      // Step 02: one object, with its description.
      stepsOf('read-object-tree-structure')[1],
    );
    expect(objects).toEqual([
      expect.objectContaining({
        objectName: 'ZMCP_SHR_I_ROOT',
        description:
          'Shared BDEF for BehaviorDefinition and BehaviorImplementatio',
      }),
    ]);
  });
});
