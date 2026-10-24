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
});
