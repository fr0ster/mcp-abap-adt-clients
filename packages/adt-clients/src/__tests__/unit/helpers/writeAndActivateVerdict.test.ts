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
   * adt-clients 49.0.0 the member reads no list: the setup reads it and
   * decides by the object's name (C7).
   */
  describe('after a silent checklist, the inactive list decides', () => {
    const SILENT =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="false"/></chkl:messages>';
    const list = (names: string[]) =>
      `<?xml version="1.0" encoding="utf-8"?><ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">${names
        .map(
          (name) =>
            `<ioc:entry><ioc:object ioc:user="U" ioc:deleted="false"><ioc:ref adtcore:uri="/sap/bc/adt/oo/classes/${name.toLowerCase()}" adtcore:type="CLAS/OC" adtcore:name="${name}"/></ioc:object></ioc:entry>`,
        )
        .join('')}</ioc:inactiveObjects>`;
    const silentHandler = (listed: string[] | Error) => {
      const sent: string[] = [];
      const connection = {
        connect: async () => undefined,
        getBaseUrl: async () => '',
        getSessionId: () => null,
        setSessionType: () => undefined,
        makeAdtRequest: async (options: { method: string; url: string }) => {
          sent.push(`${options.method} ${options.url}`);
          if (listed instanceof Error) throw listed;
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: list(listed),
          };
        },
      };
      return {
        sent,
        handler: {
          connection,
          lock: jest.fn(async () => answer(true, 'H')),
          update: jest.fn(async () => answer(true)),
          unlock: jest.fn(async () => answer(true)),
          activate: jest.fn(async () => ({
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
          })),
        },
      };
    };

    it('the object not listed: activated, after one read of the list', async () => {
      const { handler: h, sent } = silentHandler(['ZOTHER']);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).resolves.toBeUndefined();
      expect(sent).toEqual(['GET /sap/bc/adt/activation/inactiveobjects']);
    });

    it('the object still listed: the setup fails, naming it', async () => {
      const { handler: h } = silentHandler(['ZX']);
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).rejects.toThrow(/inactive list still names CLAS\/OC ZX/);
    });

    it('a list that cannot be read: the setup fails', async () => {
      const { handler: h } = silentHandler(
        Object.assign(new Error('Request failed with status code 500'), {
          response: { status: 500, statusText: 'x', headers: {}, data: '' },
        }),
      );
      await expect(
        writeAndActivate(h, { className: 'ZX' }, { source: 'x' }),
      ).rejects.toThrow(/inactive list/);
    });
  });
});
