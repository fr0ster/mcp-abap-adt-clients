import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  extractRunId,
  readNamedItems,
  readNodeStructure,
  readSearchHits,
  utilActivationRunId,
  utilInactiveObjects,
  utilNamedItems,
  utilNodeContents,
  utilSearchHits,
  utilWhereUsedReferences,
} from '../results/utils';

/**
 * The cross-cutting readings, moved with their tests from adt-clients
 * (`parseSearchResults.test.ts`, `shared/nodeStructureParse.test.ts`,
 * `shared/whereUsedReferences.test.ts`, the reading half of
 * `shared/activationRunSequence.test.ts`), where five of them were `AdtUtils`'
 * defaults.
 *
 * One behaviour changed on the way, deliberately: a document the reading does
 * not recognise — an `exc:exception`, a logon page — reads as the empty shape
 * instead of throwing. Two of these called `throwIfSapError` inside the reading,
 * which is a verdict about the server taken by the part meant to shape a value;
 * that is the error strategy's to take, and it runs first.
 */
const wire = (data: string, headers: Record<string, unknown> = {}) =>
  ({ status: 200, statusText: 'OK', headers, data }) as IAdtWireResponse;

const EXCEPTION =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNotFound"/>' +
  '<message lang="EN">Resource does not exist</message></exc:exception>';

const LOGON = '<html><body>Logon</body></html>';

// ---------------------------------------------------------------------------

// Captured verbatim from an SAP BTP trial system (quickSearch, query Z*). Every
// attribute carries the `adtcore:` prefix, and the second entry has no
// description — which is why `description` is normalised to ''.
const PREFIXED = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/packages/z" adtcore:type="DEVC/K" adtcore:name="Z" adtcore:packageName="Z" adtcore:description="gcek development"/><adtcore:objectReference adtcore:uri="/sap/bc/adt/vit/wb/object_type/sicftyp/object_name/ZX" adtcore:type="SICF/TYP" adtcore:name="ZX" adtcore:packageName="Z_RAG_PRO1"/></adtcore:objectReferences>`;

const UNPREFIXED = `<?xml version="1.0" encoding="UTF-8"?>
<objectReferences>
  <objectReference uri="/sap/bc/adt/oo/classes/zcl_a" type="CLAS/OC"
    name="ZCL_A" packageName="ZPKG" description="First class"/>
</objectReferences>`;

describe('utilSearchHits', () => {
  it('reads namespace-prefixed attributes', () => {
    const hits = utilSearchHits(wire(PREFIXED));
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      name: 'Z',
      type: 'DEVC/K',
      description: 'gcek development',
      packageName: 'Z',
      uri: '/sap/bc/adt/packages/z',
    });
  });

  // Not observed on the trial, which prefixes everything. Kept because the
  // reading accepts both and dropping the case would leave that untested.
  it('also reads unprefixed attributes and a single hit', () => {
    const hits = readSearchHits(UNPREFIXED);
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('ZCL_A');
    expect(hits[0].type).toBe('CLAS/OC');
  });

  it('reports an absent description as an empty string, not undefined', () => {
    const hits = readSearchHits(PREFIXED);
    expect(hits[1].description).toBe('');
    expect(hits[1].packageName).toBe('Z_RAG_PRO1');
  });

  it('drops a reference with no name or no type', () => {
    const partial = `<objectReferences>
      <objectReference type="CLAS/OC"/>
      <objectReference name="ZCL_OK" type="CLAS/OC"/>
      <objectReference name="ZCL_NO_TYPE"/>
    </objectReferences>`;
    expect(readSearchHits(partial).map((h) => h.name)).toEqual(['ZCL_OK']);
  });

  it('answers no hits for a payload with none, and for a document it does not recognise', () => {
    expect(readSearchHits('<objectReferences/>')).toEqual([]);
    expect(readSearchHits('<somethingElse/>')).toEqual([]);
    expect(utilSearchHits(wire(''))).toEqual([]);
    expect(utilSearchHits(wire(EXCEPTION))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

const NODE_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>' +
  '<TREE_CONTENT>' +
  '<SEU_ADT_REPOSITORY_OBJ_NODE>' +
  '<OBJECT_TYPE>PROG/P</OBJECT_TYPE><OBJECT_NAME>ZMY_PROGRAM</OBJECT_NAME>' +
  '<TECH_NAME>ZMY_PROGRAM</TECH_NAME>' +
  '<OBJECT_URI>/sap/bc/adt/programs/programs/zmy_program</OBJECT_URI>' +
  '</SEU_ADT_REPOSITORY_OBJ_NODE>' +
  // Missing OBJECT_URI — cannot be fetched, so it is not a node.
  '<SEU_ADT_REPOSITORY_OBJ_NODE>' +
  '<OBJECT_TYPE>PROG/I</OBJECT_TYPE><OBJECT_NAME>ZBROKEN</OBJECT_NAME>' +
  '<TECH_NAME>ZBROKEN</TECH_NAME>' +
  '</SEU_ADT_REPOSITORY_OBJ_NODE>' +
  '</TREE_CONTENT>' +
  '<OBJECT_TYPES>' +
  '<SEU_ADT_OBJECT_TYPE_INFO>' +
  '<OBJECT_TYPE>PROG/I</OBJECT_TYPE><NODE_ID>000010</NODE_ID>' +
  '<OBJECT_TYPE_LABEL>Includes</OBJECT_TYPE_LABEL>' +
  '</SEU_ADT_OBJECT_TYPE_INFO>' +
  '<SEU_ADT_OBJECT_TYPE_INFO>' +
  '<OBJECT_TYPE>CLAS/OC</OBJECT_TYPE><NODE_ID>000020</NODE_ID>' +
  '</SEU_ADT_OBJECT_TYPE_INFO>' +
  '</OBJECT_TYPES>' +
  '</DATA></asx:values></asx:abap>';

describe('utilNodeContents', () => {
  it('keeps each child node id with the type it holds, leading zeros intact', () => {
    const contents = utilNodeContents(wire(NODE_XML));
    expect(contents.childNodes).toEqual([
      { objectType: 'PROG/I', nodeId: '000010' },
      { objectType: 'CLAS/OC', nodeId: '000020' },
    ]);
  });

  it('drops a node that cannot be identified or fetched', () => {
    expect(utilNodeContents(wire(NODE_XML)).objects).toEqual([
      {
        objectType: 'PROG/P',
        objectName: 'ZMY_PROGRAM',
        techName: 'ZMY_PROGRAM',
        objectUri: '/sap/bc/adt/programs/programs/zmy_program',
      },
    ]);
  });

  it('answers an empty level for an empty document', () => {
    expect(utilNodeContents(wire(''))).toEqual({
      objects: [],
      childNodes: [],
    });
  });

  it('answers an empty level, not a throw, for a document that is not this one', () => {
    // In adt-clients this threw — `throwIfSapError` for the exception document,
    // `AdtParseError` for the logon page. Telling "the server said no" from
    // "empty" is the error strategy's (analyseException / analyseAny), which
    // runs before a reading is asked; the reading says what it found.
    const empty = { objects: [], childNodes: [] };
    expect(utilNodeContents(wire(EXCEPTION))).toEqual(empty);
    expect(utilNodeContents(wire(LOGON))).toEqual(empty);
  });

  it('hands the raw nodes to a caller walking the tree', () => {
    const { nodes, objectTypes } = readNodeStructure(NODE_XML);
    expect(nodes).toHaveLength(2);
    expect(objectTypes).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

const TYPES_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditems">' +
  '<nameditem:namedItem>' +
  '<nameditem:name>CLAS/OC</nameditem:name>' +
  '<nameditem:description>Class</nameditem:description>' +
  '</nameditem:namedItem>' +
  '<nameditem:namedItem>' +
  '<nameditem:name>PROG/P</nameditem:name>' +
  '</nameditem:namedItem>' +
  '<nameditem:namedItem>' +
  '<nameditem:description>Nameless</nameditem:description>' +
  '</nameditem:namedItem>' +
  '</nameditem:namedItemList>';

describe('utilNamedItems', () => {
  it('keeps the name verbatim and defaults a missing description', () => {
    expect(utilNamedItems(wire(TYPES_XML))).toEqual([
      { name: 'CLAS/OC', description: 'Class' },
      { name: 'PROG/P', description: '' },
    ]);
  });

  it('reads a single entry the parser does not wrap in an array', () => {
    const one =
      '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditems">' +
      '<nameditem:namedItem><nameditem:name>TABL/DT</nameditem:name>' +
      '<nameditem:description>Table</nameditem:description>' +
      '</nameditem:namedItem></nameditem:namedItemList>';
    expect(readNamedItems(one)).toEqual([
      { name: 'TABL/DT', description: 'Table' },
    ]);
  });

  it('answers no items for an empty document, and for one that is not this one', () => {
    // Formerly a throw, for the reason given on utilNodeContents above.
    expect(readNamedItems('')).toEqual([]);
    expect(utilNamedItems(wire(EXCEPTION))).toEqual([]);
    expect(utilNamedItems(wire(LOGON))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

const INACTIVE_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<ioc:entry><ioc:object ioc:user="DEV"><ioc:ref adtcore:uri="/sap/bc/adt/oo/classes/zcl_a" adtcore:type="CLAS/OC" adtcore:name="ZCL_A"/></ioc:object></ioc:entry>' +
  '<ioc:entry><ioc:object ioc:user="DEV"><ioc:ref adtcore:uri="/sap/bc/adt/ddic/tables/zt" adtcore:type="TABL/DT" adtcore:name="ZT"/></ioc:object></ioc:entry>' +
  // A transport entry carries no object — nothing to activate.
  '<ioc:entry><ioc:transport/></ioc:entry>' +
  '</ioc:inactiveObjects>';

describe('utilInactiveObjects', () => {
  it('reads each entry into a reference activateObjectsGroup takes', () => {
    expect(utilInactiveObjects(wire(INACTIVE_XML))).toEqual({
      objects: [
        { type: 'CLAS/OC', name: 'ZCL_A' },
        { type: 'TABL/DT', name: 'ZT' },
      ],
    });
  });

  it('answers no objects for an empty listing and for a document that is not one', () => {
    expect(utilInactiveObjects(wire(''))).toEqual({ objects: [] });
    expect(utilInactiveObjects(wire(EXCEPTION))).toEqual({ objects: [] });
  });
});

// ---------------------------------------------------------------------------

// The prefix is system-dependent: some releases emit `usagereferences:`, others
// `usageReferences:` (camel-case, observed live). The reading must not care.
const resultWith = (prefix: string) =>
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<${prefix}:usageReferenceResult xmlns:${prefix}="http://www.sap.com/adt/ris/usageReferences" numberOfResults="2" resultDescription="References for: VBAK">` +
  `<${prefix}:referencedObjects>` +
  `<${prefix}:referencedObject uri="/a" parentUri="/p" isResult="false" usageInformation="gradeDirect">` +
  `<${prefix}:adtObject adtcore:responsible="DEV" adtcore:name="ZAPPEND_VBAK" adtcore:type="TABL/DS" adtcore:description="d" xmlns:adtcore="http://www.sap.com/adt/core">` +
  `<adtcore:packageRef adtcore:name="ZPKG"/></${prefix}:adtObject></${prefix}:referencedObject>` +
  `<${prefix}:referencedObject uri="/b">` +
  `<${prefix}:adtObject adtcore:name="CL_FOO" adtcore:type="CLAS/OC" xmlns:adtcore="http://www.sap.com/adt/core"/>` +
  `</${prefix}:referencedObject></${prefix}:referencedObjects></${prefix}:usageReferenceResult>`;

describe('utilWhereUsedReferences', () => {
  for (const prefix of ['usagereferences', 'usageReferences']) {
    it(`reads the result regardless of the "${prefix}:" namespace prefix`, () => {
      const result = utilWhereUsedReferences(wire(resultWith(prefix)));
      expect(result.totalReferences).toBe(2);
      expect(result.resultDescription).toBe('References for: VBAK');
      expect(result.references).toHaveLength(2);
      const append = result.references.find((r) => r.type === 'TABL/DS');
      expect(append?.name).toBe('ZAPPEND_VBAK');
      expect(append?.packageName).toBe('ZPKG');
      expect(append?.responsible).toBe('DEV');
      expect(append?.parentUri).toBe('/p');
      expect(append?.usageInformation).toBe('gradeDirect');
    });
  }

  it('skips packages, which are container nodes and not uses', () => {
    const withPackage =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<u:usageReferenceResult xmlns:u="http://www.sap.com/adt/ris/usageReferences" numberOfResults="1">` +
      `<u:referencedObjects><u:referencedObject uri="/p">` +
      `<u:adtObject adtcore:name="ZPKG" adtcore:type="DEVC/K" xmlns:adtcore="http://www.sap.com/adt/core"/>` +
      `</u:referencedObject></u:referencedObjects></u:usageReferenceResult>`;
    expect(utilWhereUsedReferences(wire(withPackage)).references).toHaveLength(
      0,
    );
  });

  it('answers an empty reading for a document it does not recognise', () => {
    const result = utilWhereUsedReferences(wire('<html>logon</html>'));
    expect(result.totalReferences).toBe(0);
    expect(result.references).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('utilActivationRunId', () => {
  const RUN_ID = 'ACT0000000042';

  it('reads the id out of Location, whichever case the transport used', () => {
    expect(
      utilActivationRunId(
        wire('', { location: `/sap/bc/adt/activation/runs/${RUN_ID}` }),
      ),
    ).toBe(RUN_ID);
    expect(
      utilActivationRunId(
        wire('', { Location: [`/sap/bc/adt/activation/runs/${RUN_ID}`] }),
      ),
    ).toBe(RUN_ID);
  });

  it('answers empty when no header carried an id — not a verdict', () => {
    expect(utilActivationRunId(wire(''))).toBe('');
  });

  it('exports the header helper a caller composes with', () => {
    expect(extractRunId(`/sap/bc/adt/activation/runs/${RUN_ID}`)).toBe(RUN_ID);
    expect(extractRunId('/sap/bc/adt/somewhere/else')).toBeNull();
    expect(extractRunId(undefined)).toBeNull();
  });
});
