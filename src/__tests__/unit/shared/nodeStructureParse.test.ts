/**
 * The two contract results `AdtUtils` now has to produce.
 *
 * `fetchNodeStructure` and `getAllTypes` answered the envelope until
 * `AdtUtils implements` the atoms forced them to answer what the contract
 * promises. These cases assert the parsing that closed the gap — and one of them
 * exists because the first published shape could not express a walk.
 */

import type { ILogger } from '@mcp-abap-adt/interfaces';
import { parseNamedItems } from '../../../core/shared/allTypes';
import { toNodeContents } from '../../../core/shared/nodeStructure';
import { AdtParseError } from '../../../utils/adtErrors';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

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

describe('toNodeContents', () => {
  it('keeps each child node id with the type it holds', () => {
    const contents = toNodeContents(NODE_XML, logger);

    // The question the first published shape could not answer: bare ids say
    // "there is more below" and nothing about what.
    const includes = contents.childNodes.find((c) => c.objectType === 'PROG/I');
    expect(includes?.nodeId).toBe('000010');

    expect(contents.childNodes).toEqual([
      { objectType: 'PROG/I', nodeId: '000010' },
      { objectType: 'CLAS/OC', nodeId: '000020' },
    ]);
  });

  it('drops a node that cannot be identified or fetched', () => {
    const contents = toNodeContents(NODE_XML, logger);

    // ZBROKEN has no OBJECT_URI. IRepositoryObjectNode requires all four
    // fields, so half a node is not one — dropping it states that instead of
    // handing the caller a hole to discover at run time.
    expect(contents.objects).toEqual([
      {
        objectType: 'PROG/P',
        objectName: 'ZMY_PROGRAM',
        techName: 'ZMY_PROGRAM',
        objectUri: '/sap/bc/adt/programs/programs/zmy_program',
      },
    ]);
  });

  it('answers empty for an empty document — nothing is not a failure', () => {
    expect(toNodeContents('', logger)).toEqual({
      objects: [],
      childNodes: [],
    });
  });

  it('raises rather than answering empty for a document it cannot read', () => {
    // This case asserted the opposite when it was written, which is how a defect
    // gets pinned by its own coverage. "The package is empty" and "we were handed
    // something else entirely" are different answers, and the second is what an
    // expired session's logon page looks like.
    //
    // The throw is the DEFAULT, not the law: deciding what counts as an error
    // belongs to an error strategy the consumer supplies (decision 19). Until
    // that exists, failing loudly is the safe default rather than a judgement
    // imposed for good.
    expect(() => toNodeContents('<not-xml', logger)).toThrow(AdtParseError);
    expect(() =>
      toNodeContents('<html><body>Logon</body></html>', logger),
    ).toThrow(AdtParseError);
  });
});

const TYPES_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditems">' +
  '<nameditem:namedItem>' +
  '<nameditem:name>CLAS/OC</nameditem:name>' +
  '<nameditem:description>Class</nameditem:description>' +
  '</nameditem:namedItem>' +
  // No description — the entry is still an entry.
  '<nameditem:namedItem>' +
  '<nameditem:name>PROG/P</nameditem:name>' +
  '</nameditem:namedItem>' +
  // No name — nothing can refer to it.
  '<nameditem:namedItem>' +
  '<nameditem:description>Nameless</nameditem:description>' +
  '</nameditem:namedItem>' +
  '</nameditem:namedItemList>';

describe('parseNamedItems', () => {
  it('keeps the name verbatim and defaults a missing description', () => {
    expect(parseNamedItems(TYPES_XML, logger)).toEqual([
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

    expect(parseNamedItems(one, logger)).toEqual([
      { name: 'TABL/DT', description: 'Table' },
    ]);
  });

  it('answers empty for an empty document, and raises for an unreadable one', () => {
    expect(parseNamedItems('', logger)).toEqual([]);

    expect(() => parseNamedItems('<not-xml', logger)).toThrow(AdtParseError);
    expect(() =>
      parseNamedItems('<html><body>Logon</body></html>', logger),
    ).toThrow(AdtParseError);
  });
});
