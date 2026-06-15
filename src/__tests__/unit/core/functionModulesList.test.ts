import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { listFunctionModules } from '../../../core/shared/functionModulesList';

const ROOT_XML = (nodeId = '000007') =>
  `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT/><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><NODE_ID>${nodeId}</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/I</OBJECT_TYPE><NODE_ID>000002</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`;

const ROOT_NO_FF = `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT/><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/I</OBJECT_TYPE><NODE_ID>000002</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`;

const drillXml = (names: string[]) =>
  `<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT>${names
    .map(
      (n) =>
        `<SEU_ADT_REPOSITORY_OBJ_NODE><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><OBJECT_NAME>${n}</OBJECT_NAME></SEU_ADT_REPOSITORY_OBJ_NODE>`,
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

describe('listFunctionModules', () => {
  it('returns FM names; drills with the exact string node_id (leading zeros kept)', async () => {
    const conn = connFrom((id) =>
      id === '000000'
        ? ROOT_XML('000007')
        : drillXml(['Z_AC_SHR_FM01', 'Z_AC_SHR_FM02']),
    );
    const result = await listFunctionModules(conn, 'ZAC_SHR_FUGR');
    expect(result).toEqual(['Z_AC_SHR_FM01', 'Z_AC_SHR_FM02']);
    const calls = (conn.makeAdtRequest as jest.Mock).mock.calls;
    expect(calls[1][0].params.node_id).toBe('000007'); // string, not 7
  });

  it('uppercases the group name in the request', async () => {
    const conn = connFrom((id) =>
      id === '000000' ? ROOT_XML() : drillXml(['Z_FM']),
    );
    await listFunctionModules(conn, 'zac_shr_fugr');
    expect(
      (conn.makeAdtRequest as jest.Mock).mock.calls[0][0].params.parent_name,
    ).toBe('ZAC_SHR_FUGR');
  });

  it('dedupes by uppercased key, first occurrence wins', async () => {
    const conn = connFrom((id) =>
      id === '000000' ? ROOT_XML() : drillXml(['z_fm', 'Z_FM']),
    );
    expect(await listFunctionModules(conn, 'G')).toEqual(['z_fm']);
  });

  it('returns [] and makes no drill call when there is no FUGR/FF type', async () => {
    const conn = connFrom(() => ROOT_NO_FF);
    expect(await listFunctionModules(conn, 'G')).toEqual([]);
    expect((conn.makeAdtRequest as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('returns [] for an empty but present <OBJECT_TYPES/> (parsed as "")', async () => {
    const conn = connFrom(
      () =>
        '<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><OBJECT_TYPES/></DATA></asx:values></asx:abap>',
    );
    expect(await listFunctionModules(conn, 'G')).toEqual([]);
    expect((conn.makeAdtRequest as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('returns [] when the drill has no OBJECT_NAME', async () => {
    const conn = connFrom((id) =>
      id === '000000' ? ROOT_XML() : drillXml([]),
    );
    expect(await listFunctionModules(conn, 'G')).toEqual([]);
  });

  it('returns [] when the drill response is an empty <DATA/> (no TREE_CONTENT)', async () => {
    const conn = connFrom((id) =>
      id === '000000'
        ? ROOT_XML()
        : '<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA/></asx:values></asx:abap>',
    );
    expect(await listFunctionModules(conn, 'G')).toEqual([]);
  });

  it('throws on malformed XML (does not return [])', async () => {
    const conn = connFrom(() => '<asx:abap><asx:values><DATA><OBJECT_TYPES>'); // unclosed
    await expect(listFunctionModules(conn, 'G')).rejects.toThrow();
  });

  it('throws on well-formed but unexpected XML (no asx:abap/DATA envelope)', async () => {
    const conn = connFrom(() => '<html><body>error</body></html>'); // valid XML, wrong shape
    await expect(listFunctionModules(conn, 'G')).rejects.toThrow();
  });

  it('throws when the root has the envelope but no OBJECT_TYPES', async () => {
    const conn = connFrom(
      () =>
        '<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT/></DATA></asx:values></asx:abap>',
    );
    await expect(listFunctionModules(conn, 'G')).rejects.toThrow();
  });

  it('throws on a non-2xx response that resolves (does not return [])', async () => {
    const makeAdtRequest = jest.fn(async () => ({
      status: 500,
      data: ROOT_XML(),
    }));
    const conn = { makeAdtRequest } as unknown as IAbapConnection;
    await expect(listFunctionModules(conn, 'G')).rejects.toThrow();
  });
});

describe('AdtUtils.listFunctionModules', () => {
  it('delegates to listFunctionModules through getUtils-style usage', async () => {
    const makeAdtRequest = jest.fn(async (opts: any) => ({
      status: 200,
      data:
        opts.params.node_id === '000000'
          ? `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><OBJECT_TYPES><SEU_ADT_OBJECT_TYPE_INFO><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><NODE_ID>000007</NODE_ID></SEU_ADT_OBJECT_TYPE_INFO></OBJECT_TYPES></DATA></asx:values></asx:abap>`
          : `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><TREE_CONTENT><SEU_ADT_REPOSITORY_OBJ_NODE><OBJECT_TYPE>FUGR/FF</OBJECT_TYPE><OBJECT_NAME>Z_FM1</OBJECT_NAME></SEU_ADT_REPOSITORY_OBJ_NODE></TREE_CONTENT></DATA></asx:values></asx:abap>`,
    }));
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const utils = new AdtUtils({ makeAdtRequest } as any, logger as any);
    expect(await utils.listFunctionModules('zfugr')).toEqual(['Z_FM1']);
  });
});
