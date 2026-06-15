import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { listFunctionGroupIncludes } from '../../../core/shared/functionGroupIncludesList';

// Root catalog exposing the FUGR/I (includes) type node, alongside FUGR/FF so the
// wrapper proves it picks the includes node, not the modules node.
const ROOT_XML = (includesNodeId = '000002') =>
  `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT/><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><NODE_ID>000007</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/I</OBJECT_TYPE><NODE_ID>${includesNodeId}</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`;

const ROOT_NO_INCLUDES = `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT/><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><NODE_ID>000007</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`;

// Drill response — `nodes` is a list of [objectType, objectName] pairs so a test
// can mix in non-FUGR/I nodes and assert they are filtered out.
const drillXml = (nodes: Array<[string, string]>) =>
  `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT>${nodes
    .map(
      ([type, name]) =>
        `<SEU_ADT_REPOSITORY_OBJ_NODE><OBJECT_TYPE>${type}</OBJECT_TYPE><OBJECT_NAME>${name}</OBJECT_NAME></SEU_ADT_REPOSITORY_OBJ_NODE>`,
    )
    .join('')}</TREE_CONTENT></DATA></asx:values></asx:abap>`;

function connFrom(byNodeId: (nodeId: string) => unknown): IAbapConnection {
  const makeAdtRequest = jest.fn(async (opts: any) => {
    const r = byNodeId(opts.params.node_id);
    if (r instanceof Error) throw r;
    return { status: 200, data: r };
  });
  return { makeAdtRequest } as unknown as IAbapConnection;
}

describe('listFunctionGroupIncludes', () => {
  it('returns include names and drills the FUGR/I node id (string, zeros kept)', async () => {
    const conn = connFrom((id) =>
      id === '000000'
        ? ROOT_XML('000002')
        : drillXml([
            ['FUGR/I', 'LZAC_SHR_FUGRTOP'],
            ['FUGR/I', 'LZAC_SHR_FUGRUXX'],
          ]),
    );
    const result = await listFunctionGroupIncludes(conn, 'ZAC_SHR_FUGR');
    expect(result).toEqual(['LZAC_SHR_FUGRTOP', 'LZAC_SHR_FUGRUXX']);
    // Second call drills the includes node (000002), not the modules node (000007).
    expect(
      (conn.makeAdtRequest as jest.Mock).mock.calls[1][0].params.node_id,
    ).toBe('000002');
  });

  it('collects only FUGR/I nodes, ignoring other node types in the drill', async () => {
    const conn = connFrom((id) =>
      id === '000000'
        ? ROOT_XML()
        : drillXml([
            ['FUGR/I', 'LZTOP'],
            ['FUGR/FF', 'Z_SOME_FM'],
            ['FUGR/PX', 'SAPLZ'],
          ]),
    );
    expect(await listFunctionGroupIncludes(conn, 'G')).toEqual(['LZTOP']);
  });

  it('returns [] and makes no drill call when there is no FUGR/I type', async () => {
    const conn = connFrom(() => ROOT_NO_INCLUDES);
    expect(await listFunctionGroupIncludes(conn, 'G')).toEqual([]);
    expect((conn.makeAdtRequest as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('throws on malformed XML (does not return [])', async () => {
    const conn = connFrom(() => '<asx:abap><asx:values><DATA><OBJECT_TYPES>');
    await expect(listFunctionGroupIncludes(conn, 'G')).rejects.toThrow();
  });
});

describe('AdtUtils.listFunctionGroupIncludes', () => {
  it('delegates to listFunctionGroupIncludes through getUtils-style usage', async () => {
    const makeAdtRequest = jest.fn(async (opts: any) => ({
      status: 200,
      data:
        opts.params.node_id === '000000'
          ? `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/I</OBJECT_TYPE><NODE_ID>000002</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`
          : `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT><SEU_ADT_REPOSITORY_OBJ_NODE><OBJECT_TYPE>FUGR/I</OBJECT_TYPE><OBJECT_NAME>LZTOP</OBJECT_NAME></SEU_ADT_REPOSITORY_OBJ_NODE></TREE_CONTENT></DATA></asx:values></asx:abap>`,
    }));
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const utils = new AdtUtils({ makeAdtRequest } as any, logger as any);
    expect(await utils.listFunctionGroupIncludes('zfugr')).toEqual(['LZTOP']);
  });
});
