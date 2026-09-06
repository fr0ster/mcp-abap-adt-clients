/**
 * A deletion check is not a check run, and the two must not share a strategy.
 *
 * They read different documents from different endpoints: `check()` runs
 * `POST /checkruns` and gets `chkl:messages`; `checkDeletion()` runs
 * `POST /deletion/check` and gets `del:checkResponse`, carrying
 * `del:isDeletable`, the reference counts and the transport holding the object.
 *
 * For one commit they shared the `check` slot, and this file is the assertion
 * that would have caught it: a consumer who injects a parser for their check
 * runs would have had it handed the deletion document — a wrong answer where
 * the parser is tolerant, a throw where it is not, and in both cases a verdict
 * about deletability produced by something that has never seen one.
 *
 * Caught in review, 2026-09-06.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { classDocuments } from '../../../core/class/types';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const CHECK_RUN = '<chkl:messages/>';
const DELETION_CHECK =
  '<del:checkResponse><del:object del:isDeletable="true"/></del:checkResponse>';

function recording() {
  const calls: string[] = [];
  const connection = {
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async (req: { url: string }) => {
      calls.push(req.url);
      return {
        data: req.url.includes('/deletion/check') ? DELETION_CHECK : CHECK_RUN,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as IAdtWireResponse;
    }),
  } as unknown as IAbapConnection;
  return { calls, connection };
}

describe('the deletion check reads its own document', () => {
  it('the two members go to different endpoints', async () => {
    const { calls, connection } = recording();
    const cls = new AdtClient(connection, logger).getClass();

    await cls.check({ className: 'ZCL_X' });
    await cls.checkDeletion({ className: 'ZCL_X' });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/sap/bc/adt/checkruns');
    expect(calls[1]).toBe('/sap/bc/adt/deletion/check');
  });

  it('a reading injected for `check` is not applied to the deletion check', async () => {
    const { connection } = recording();
    // Two markers, so the answer says which strategy produced it rather than
    // only whether it parsed.
    const cls = new AdtClient(connection, logger).getClass({
      ...classDocuments,
      check: () => 'read by the check-run strategy',
      deletionCheck: () => 'read by the deletion-check strategy',
    });

    const checked = await cls.check({ className: 'ZCL_X' });
    const deletable = await cls.checkDeletion({ className: 'ZCL_X' });

    expect(checked.ok && checked.getResult().value).toBe(
      'read by the check-run strategy',
    );
    expect(deletable.ok && deletable.getResult().value).toBe(
      'read by the deletion-check strategy',
    );
  });

  it('the default reads the deletion document as it arrived', async () => {
    const { connection } = recording();
    const answer = await new AdtClient(connection, logger)
      .getClass()
      .checkDeletion({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(String(answer.getResult().value)).toContain('del:isDeletable');
  });
});
