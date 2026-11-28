/**
 * `writeAndActivate` asks the library to judge the activation: a refusal
 * inside the 200 (activationExecuted="false", a message of type E) is read
 * by `analyseActivation`, and a refused activation fails the write.
 */
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

const { writeAndActivate } = require('../../helpers/test-helper');

describe('writeAndActivate asks for the activation verdict', () => {
  const answer = (ok: boolean, value: unknown = '') =>
    ok
      ? { ok: true, getResult: () => ({ value }) }
      : {
          ok: false,
          getError: () => ({
            origin: 'refusal',
            message: 'activationExecuted="false"',
          }),
        };
  const handler = (activated: boolean) => ({
    lock: jest.fn(async () => answer(true, 'H')),
    update: jest.fn(async () => answer(true)),
    unlock: jest.fn(async () => answer(true)),
    activate: jest.fn(async () => answer(activated)),
  });

  it('passes a judge that refuses activationExecuted="false" and an exception document', async () => {
    const { ADT_NO_FAILURE } = require('@mcp-abap-adt/interfaces-adt');
    const h = handler(true);
    await writeAndActivate(h, { className: 'ZX' }, { source: 'x' });
    const { analyse } = (h.activate.mock.calls[0] as unknown[])[1] as {
      analyse: (v: unknown, w: unknown) => unknown;
    };
    for (const data of [
      '<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg type="W" objDescr="Class ZX"><shortText><txt>Object is locked in another session</txt></shortText></msg></chkl:messages>',
      '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><message lang="EN">No authorization</message></exc:exception>',
    ]) {
      expect(analyse(ADT_NO_FAILURE, { status: 200, data })).not.toBe(
        ADT_NO_FAILURE,
      );
    }
  });

  it('fails on a refused activation', async () => {
    await expect(
      writeAndActivate(handler(false), { className: 'ZX' }, { source: 'x' }),
    ).rejects.toThrow(/activate failed .*activationExecuted="false"/);
  });

  /**
   * A re-activation with nothing to do answers the silent checklist, and since
   * adt-clients 49.0.0 the member reads no list: the setup reads it and judges
   * as a caller does — `analyseActivation` with the uris the activation POST
   * named (`stillInactiveAmong`: by `uri` or `parentUri`) (C7).
   */
  describe('after a silent checklist, the inactive list decides by the uris the POST named', () => {
    const SILENT =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="false"/></chkl:messages>';
    const CLASS_URI = '/sap/bc/adt/oo/classes/zx';
    type Listed = {
      uri: string;
      type: string;
      name: string;
      parentUri?: string;
    };
    const list = (objects: Listed[]) =>
      `<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">${objects
        .map(
          (o) =>
            `<ioc:entry><ioc:object ioc:user="U" ioc:deleted="false"><ioc:ref adtcore:uri="${o.uri}" adtcore:type="${o.type}" adtcore:name="${o.name}"${o.parentUri ? ` adtcore:parentUri="${o.parentUri}"` : ''}/></ioc:object></ioc:entry>`,
        )
        .join('')}</ioc:inactiveObjects>`;
    const silentHandler = (listed: Listed[] | Error) => {
      const sent: string[] = [];
      const connection = {
        connect: async () => undefined,
        getBaseUrl: async () => '',
        getSessionId: () => null,
        setSessionType: () => undefined,
        makeAdtRequest: async (options: {
          method: string;
          url: string;
          data?: unknown;
        }) => {
          sent.push(`${options.method} ${options.url}`);
          if (options.method === 'POST') {
            return { status: 200, statusText: 'OK', headers: {}, data: SILENT };
          }
          if (listed instanceof Error) throw listed;
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: list(listed),
          };
        },
      };
      const failure = {
        ok: false,
        getError: () => ({
          origin: 'refusal',
          message: 'not decided',
          response: {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: SILENT,
          },
        }),
      };
      return {
        sent,
        handler: {
          connection,
          lock: jest.fn(async () => answer(true, 'H')),
          update: jest.fn(async () => answer(true)),
          unlock: jest.fn(async () => answer(true)),
          // A member: its POST goes through its connection, naming the class.
          activate: jest.fn(async () => {
            await connection.makeAdtRequest({
              method: 'POST',
              url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
              data: `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="${CLASS_URI}" adtcore:name="ZX"/></adtcore:objectReferences>`,
            });
            return failure;
          }),
        },
      };
    };

    it('the uri not listed: activated, after one read of the list', async () => {
      const { handler: h, sent } = silentHandler([
        {
          uri: '/sap/bc/adt/oo/classes/zother',
          type: 'CLAS/OC',
          name: 'ZOTHER',
        },
      ]);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).resolves.toBeUndefined();
      expect(sent).toEqual([
        'POST /sap/bc/adt/activation?method=activate&preauditRequested=true',
        'GET /sap/bc/adt/activation/inactiveobjects',
      ]);
    });

    it('the uri still listed: the setup fails', async () => {
      const { handler: h } = silentHandler([
        { uri: CLASS_URI, type: 'CLAS/OC', name: 'ZX' },
      ]);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).rejects.toThrow(/inactive list still names/);
    });

    it('a listed child under the named uri, with another name: the setup fails', async () => {
      const { handler: h } = silentHandler([
        {
          uri: `${CLASS_URI}/includes/testclasses`,
          type: 'CLAS/OCN',
          name: 'ZX=========CCAU',
          parentUri: CLASS_URI,
        },
      ]);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).rejects.toThrow(/inactive list still names/);
    });

    it('another object of the same name and another uri: activated', async () => {
      const { handler: h } = silentHandler([
        { uri: '/sap/bc/adt/programs/programs/zx', type: 'PROG/P', name: 'ZX' },
      ]);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).resolves.toBeUndefined();
    });

    it('a list that cannot be read: the setup fails', async () => {
      const { handler: h } = silentHandler(
        Object.assign(new Error('Request failed with status code 500'), {
          response: { status: 500, statusText: 'x', headers: {}, data: '' },
        }),
      );
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).rejects.toThrow(/could not be read|could not be decided/);
    });
  });
});
