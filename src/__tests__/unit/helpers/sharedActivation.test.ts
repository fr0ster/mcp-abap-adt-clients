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
  expectActivationExecuted,
} from '../../helpers/sharedActivation';

const ok = (value: unknown) => ({ ok: true, getResult: () => ({ value }) });
const refused = (message: string) => ({
  ok: false,
  getError: () => ({ origin: 'refusal', message }),
});

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const members = [{ type: 'DDLS/DF', name: 'ZAC_TF' }];
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
      /read the results of group activation run RUN1.*results gone/,
    );
  });
});

describe('expectActivationExecuted', () => {
  const executedWith = (msg: string) =>
    `<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties activationExecuted="true"/>${msg}</chkl:messages>`;

  it('passes an executed activation with only warnings', () => {
    expect(() =>
      expectActivationExecuted(
        executedWith('<msg type="W"><shortText><txt>w</txt></shortText></msg>'),
        'x',
      ),
    ).not.toThrow();
  });

  it('fails an error message with an empty text element', () => {
    expect(() =>
      expectActivationExecuted(executedWith('<msg type="E"><txt/></msg>'), 'x'),
    ).toThrow(/x: \(no text\)/);
  });

  it('fails an error message with no text at all, its type after other attributes', () => {
    expect(() =>
      expectActivationExecuted(
        executedWith('<msg objDescr="ZAC" line="1" type="E"/>'),
        'x',
      ),
    ).toThrow(/\(no text\)/);
  });

  it('fails an error message whose text element is namespaced, and names the text', () => {
    expect(() =>
      expectActivationExecuted(
        executedWith(
          '<chkl:msg type="E"><chkl:shortText><chkl:txt>Field X unknown</chkl:txt></chkl:shortText></chkl:msg>',
        ),
        'x',
      ),
    ).toThrow(/Field X unknown/);
  });

  it('fails a document that does not say the activation was executed', () => {
    expect(() =>
      expectActivationExecuted(
        '<chkl:messages xmlns:chkl="u"><chkl:properties activationExecuted="false"/></chkl:messages>',
        'x',
      ),
    ).toThrow(/^x: /);
  });
});
