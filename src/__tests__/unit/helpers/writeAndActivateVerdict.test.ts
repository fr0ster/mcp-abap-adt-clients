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
  const { analyseActivation } = require('@mcp-abap-adt/adt-strategies');
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

  it('passes analyseActivation', async () => {
    const h = handler(true);
    await writeAndActivate(h, { className: 'ZX' }, { source: 'x' });
    expect(h.activate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ analyse: analyseActivation }),
    );
  });

  it('fails on a refused activation', async () => {
    await expect(
      writeAndActivate(handler(false), { className: 'ZX' }, { source: 'x' }),
    ).rejects.toThrow(/activate failed .*activationExecuted="false"/);
  });
});
