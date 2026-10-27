/**
 * `activateSharedGroup` reads every answer of the group run — the start, each
 * status poll and the results — and fails on a refused or throwing one, with
 * what SAP said. A refused poll is not an empty status to retry past.
 */

const utils = {
  activateObjectsGroup: jest.fn(),
  getActivationRun: jest.fn(),
  getActivationResults: jest.fn(),
};

jest.mock('../../../core/shared/AdtUtils', () => ({
  AdtUtils: jest.fn(() => utils),
}));
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import {
  activateSharedGroup,
  analyseActivationExecuted,
  type ISharedGroupMember,
} from '../../helpers/sharedActivation';

const ok = (value: unknown) => ({ ok: true, getResult: () => ({ value }) });
const refused = (message: string) => ({
  ok: false,
  getError: () => ({ origin: 'refusal', message }),
});

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const members: ISharedGroupMember[] = [{ type: 'DDLS/DF', name: 'ZAC_TF' }];
const started = ok({ headers: { location: '/activation/runs/RUN1' } });
const finished = ok('<run status="finished"/>');
const executed = ok('<results activationExecuted="true"/>');

beforeEach(() => {
  utils.activateObjectsGroup.mockReset().mockResolvedValue(started);
  utils.getActivationRun.mockReset().mockResolvedValue(finished);
  utils.getActivationResults.mockReset().mockResolvedValue(executed);
});

describe('activateSharedGroup', () => {
  it('passes a run that started, finished and executed', async () => {
    await expect(
      activateSharedGroup({} as never, members, logger),
    ).resolves.toBeUndefined();
  });

  it('fails at a refused status poll, even when a later poll would succeed', async () => {
    utils.getActivationRun
      .mockReset()
      .mockResolvedValueOnce(refused('run unknown'))
      .mockResolvedValue(finished);
    await expect(
      activateSharedGroup({} as never, members, logger),
    ).rejects.toThrow(/poll group activation run RUN1 .*run unknown/);
    expect(utils.getActivationRun).toHaveBeenCalledTimes(1);
  });

  it('fails at a status poll that throws', async () => {
    utils.getActivationRun.mockReset().mockRejectedValue(new Error('EPIPE'));
    await expect(
      activateSharedGroup({} as never, members, logger),
    ).rejects.toThrow('EPIPE');
  });

  it('fails at refused results, with what SAP said', async () => {
    utils.getActivationResults
      .mockReset()
      .mockResolvedValue(refused('results gone'));
    await expect(
      activateSharedGroup({} as never, members, logger),
    ).rejects.toThrow(
      /group activation of .* \(run RUN1\) failed .*results gone/,
    );
  });
});

describe('activateSharedGroup passes the strategy to the results call', () => {
  it('fails on activationExecuted="false" with no messages, judged by the call', async () => {
    const { ADT_NO_FAILURE } = require('@mcp-abap-adt/interfaces-adt');
    const data =
      '<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties activationExecuted="false"/></chkl:messages>';
    utils.getActivationResults
      .mockReset()
      .mockImplementation(
        async (
          _id: string,
          options?: { analyse?: (v: unknown, w: unknown) => unknown },
        ) => {
          const verdict = options?.analyse
            ? options.analyse(ADT_NO_FAILURE, { status: 200, data })
            : ADT_NO_FAILURE;
          return verdict === ADT_NO_FAILURE
            ? ok(data)
            : { ok: false, getError: () => verdict };
        },
      );
    await expect(
      activateSharedGroup({} as never, members, logger),
    ).rejects.toThrow(/not executed/);
  });
});

describe('analyseActivationExecuted, composed through judged()', () => {
  const { ADT_NO_FAILURE } = require('@mcp-abap-adt/interfaces-adt');
  const { judged } = require('../../helpers/judged');
  const strategy = judged(analyseActivationExecuted);
  const verdictOn = (data: string) =>
    strategy(ADT_NO_FAILURE, {
      status: 200,
      statusText: 'OK',
      headers: {},
      data,
    });
  const results = (properties: string, msg = '') =>
    `<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties ${properties}/>${msg}</chkl:messages>`;

  it('accepts an executed activation with only warnings', () => {
    expect(
      verdictOn(
        results(
          'activationExecuted="true"',
          '<msg type="W"><shortText><txt>w</txt></shortText></msg>',
        ),
      ),
    ).toBe(ADT_NO_FAILURE);
  });

  it('refuses activationExecuted="false" with no messages, which the library lets pass', () => {
    const { analyseActivation } = require('@mcp-abap-adt/adt-strategies');
    const data = results('activationExecuted="false"');
    expect(analyseActivation(ADT_NO_FAILURE, { status: 200, data })).toBe(
      ADT_NO_FAILURE,
    );
    expect(verdictOn(data)).toMatchObject({
      origin: 'refusal',
      message: expect.stringMatching(/not executed/),
    });
  });

  it('refuses an error message with an empty text element', () => {
    expect(
      verdictOn(
        results('activationExecuted="true"', '<msg type="E"><txt/></msg>'),
      ),
    ).toMatchObject({ message: '(no text)' });
  });

  it('refuses a namespaced error message, naming its text', () => {
    expect(
      verdictOn(
        results(
          'activationExecuted="true"',
          '<chkl:msg type="E"><chkl:shortText><chkl:txt>Field X unknown</chkl:txt></chkl:shortText></chkl:msg>',
        ),
      ),
    ).toMatchObject({ message: 'Field X unknown' });
  });

  it('refuses an exception document inside a 200', () => {
    expect(
      verdictOn(
        '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization</message></exc:exception>',
      ),
    ).toMatchObject({ origin: 'refusal', message: 'No authorization' });
  });

  it('leaves a failure the transport already found as it is', () => {
    const failure = { origin: 'refusal', message: 'HTTP 500' };
    expect(analyseActivationExecuted(failure as never, undefined)).toBe(
      failure,
    );
  });
});
