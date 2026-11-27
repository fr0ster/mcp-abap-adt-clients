/**
 * C3 of #304: on the no-answer path the library's own verdict is the
 * fallback, and `analyse` is called exactly as before — once, with the
 * verdict and `undefined` for the answer, before that fallback. What it
 * answers comes back as itself; when it clears the verdict, the library's
 * verdict stands (nothing came back to read a success from). This is why
 * a generic answer is typed `E | IAdtError`.
 *
 * One path per helper: `answering` (a member), `getSystemInformation`, and
 * the abapGit facts exchange (a new-form member).
 */
import {
  ADT_NO_FAILURE,
  type AdtNoFailure,
  type IAbapGitStructuredError,
  type IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getSystemInformation } from '../../../utils/systemInfo';
import { gitClient } from '../clients/abapGit/abapGitHelpers';

/** A connection whose every request fails with no response. */
const noAnswer = (): IAbapConnection =>
  ({
    getBaseUrl: async () => 'https://system.example',
    setSessionType: () => {},
    makeAdtRequest: async () => {
      throw new Error('socket hang up');
    },
  }) as unknown as IAbapConnection;

interface IMine extends IAdtError {
  readonly mine: true;
}

/** A judge that records each call and answers `answer`. */
function spy<V, A>(answer: () => A) {
  const calls: unknown[][] = [];
  const judge = (verdict: V | AdtNoFailure, wire?: unknown) => {
    calls.push([verdict, wire]);
    return answer();
  };
  return { calls, judge };
}

describe('the no-answer path: analyse once, then the library fallback', () => {
  it('answering: called with the verdict and undefined; its own failure comes back', async () => {
    const mine: IMine = { origin: 'refusal', message: 'mine', mine: true };
    const { calls, judge } = spy<IAdtError, IMine>(() => mine);
    const answer = await new AdtClient(noAnswer())
      .getClass()
      .readMetadata({ className: 'ZCL_X' }, { analyse: judge });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBeUndefined();
    expect(calls[0]?.[0]).toMatchObject({ origin: 'connection' });
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toBe(mine);
  });

  it('answering: cleared, the library verdict stands', async () => {
    const { calls, judge } = spy<IAdtError, AdtNoFailure>(() => ADT_NO_FAILURE);
    const answer = await new AdtClient(noAnswer())
      .getClass()
      .readMetadata({ className: 'ZCL_X' }, { analyse: judge });
    expect(calls).toHaveLength(1);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toBe(calls[0]?.[0]);
  });

  it('getSystemInformation: cleared, the library verdict stands', async () => {
    const { calls, judge } = spy<IAdtError, AdtNoFailure>(() => ADT_NO_FAILURE);
    const answer = await getSystemInformation(noAnswer(), { analyse: judge });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBeUndefined();
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toBe(calls[0]?.[0]);
  });

  it('the abapGit facts exchange: cleared, the library verdict stands', async () => {
    const { calls, judge } = spy<IAbapGitStructuredError, AdtNoFailure>(
      () => ADT_NO_FAILURE,
    );
    const answer = await gitClient(noAnswer()).getStatus(
      { key: '000001' },
      { analyse: judge },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBeUndefined();
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError()).toBe(calls[0]?.[0]);
  });
});
