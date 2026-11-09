/**
 * The one read after a silent checklist (spec D1, decision Q7): when an
 * activation answers `chkl:messages` with `activationExecuted="false"` and no
 * message, the member reads `GET /sap/bc/adt/activation/inactiveobjects` once
 * and hands `analyse` the list and the uris its request named; after every
 * other answer it sends nothing more.
 *
 * The answers are the recorded ones (`corpus/adt/answers/`), replayed by a
 * stub connection that answers by request.
 */
import { join } from 'node:path';
import { analyseActivation } from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type AdtNoFailure,
  type IAdtAnalyseContext,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { headersOf } from '../../helpers/adtHeaders';
import { readExchange } from '../../helpers/recordedConformance';
import { createLibraryLogger } from '../../helpers/testLogger';
import { ACTIVATING_APIS, activatingHandler } from '../core/activatingApis';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** One recorded step, as the wire answer it was. */
function recorded(caseName: string, step: string): IAdtWireResponse {
  const { status, body } = readExchange(ANSWERS, `${caseName}--${step}.json`);
  return { status, statusText: 'OK', headers: {}, data: body };
}

const SILENT = recorded('activation-group-alone-s4-2025', '04-activation');
const LISTED = recorded('activation-group-alone-s4-2025', '05-inactiveobjects');
const GROUP = '/sap/bc/adt/functions/groups/zact751p9325';
const INACTIVE = '/sap/bc/adt/activation/inactiveobjects';

/** A refusal of the read, the way a transport throws a non-2xx. */
function refused(status: number): Error & { response: IAdtWireResponse } {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      statusText: 'Internal Server Error',
      headers: {},
      data: '',
    },
  });
}

interface IReplay {
  activation: IAdtWireResponse;
  inactive?: IAdtWireResponse | Error;
}

/** A client over a connection that answers by request, recording each one. */
function replaying(replay: IReplay) {
  const sent: IAbapRequestOptions[] = [];
  const connection: IAbapConnection = {
    connect: async () => {},
    getBaseUrl: async () => undefined,
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async <T, D>(
      options: IAbapRequestOptions,
    ): Promise<IAdtWireResponse<T, D>> => {
      sent.push(options);
      const answer =
        options.url === INACTIVE ? replay.inactive : replay.activation;
      if (answer === undefined) throw new Error(`unexpected ${options.url}`);
      if (answer instanceof Error) throw answer;
      // The stub answers with recorded wire answers; the generic is the
      // caller's view of the body, which a recording does not narrow.
      return answer as IAdtWireResponse<T, D>;
    },
  };
  return { client: new AdtClient(connection, createLibraryLogger()), sent };
}

/** An `analyse` that records what it was handed and clears nothing. */
function spying() {
  const seen: {
    verdict: IAdtError | AdtNoFailure;
    answer: IAdtWireResponse | undefined;
    context: IAdtAnalyseContext | undefined;
  }[] = [];
  const analyse = (
    verdict: IAdtError | AdtNoFailure,
    answer?: IAdtWireResponse,
    context?: IAdtAnalyseContext,
  ): IAdtError | AdtNoFailure => {
    seen.push({ verdict, answer, context });
    return verdict;
  };
  return { analyse, seen };
}

async function activateGroup<E extends IAdtError>(
  replay: IReplay,
  analyse: IAnalyse<E>,
) {
  const { client, sent } = replaying(replay);
  const group = client.getFunctionGroup();
  const answer = await group.activate(
    { functionGroupName: 'ZACT751P9325' },
    { headers: headersOf(group, 'activate'), analyse },
  );
  return { answer, sent };
}

describe('the read after a silent checklist', () => {
  it('reads the inactive list once, and hands it with the named uris', async () => {
    const { analyse, seen } = spying();
    const { sent } = await activateGroup(
      { activation: SILENT, inactive: LISTED },
      analyse,
    );

    expect(sent.map((r) => [r.method, r.url])).toEqual([
      ['POST', '/sap/bc/adt/activation?method=activate&preauditRequested=true'],
      ['GET', INACTIVE],
    ]);
    expect(sent[1]?.headers).toEqual({
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.verdict).toBe(ADT_NO_FAILURE);
    // The client puts the request back on every answer (`withRequestTrace`),
    // so the answers handed on are the recorded ones with their request.
    expect(seen[0]?.answer).toMatchObject(SILENT);
    expect(seen[0]?.context?.activation?.named).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
    expect(seen[0]?.context?.activation?.inactiveObjects).toMatchObject({
      ...LISTED,
      request: { method: 'GET', url: INACTIVE },
    });
  });

  it('analyseActivation then answers not activated, the group still listed', async () => {
    const { answer } = await activateGroup(
      { activation: SILENT, inactive: LISTED },
      analyseActivation,
    );
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().stillInactive.map((o) => o.uri)).toEqual([
      GROUP,
      `${GROUP}/source/main`,
    ]);
  });

  it.each([
    [
      'activationExecuted="true"',
      recorded('activation-success-verdict', '01-activation'),
    ],
    [
      'ioc:inactiveObjects',
      recorded('activation-preaudit-still-inactive-751', '01-activation'),
    ],
    [
      'an empty body',
      recorded('activation-sync-activated-751', '01-activation'),
    ],
    [
      'a refusal with an E',
      recorded('refusal-activation-fails', '01-activation'),
    ],
  ])('after %s nothing more is sent', async (_what, activation) => {
    const { analyse, seen } = spying();
    const { sent } = await activateGroup({ activation }, analyse);
    expect(sent.map((r) => r.method)).toEqual(['POST']);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('a read that fails is the call failure, carrying its response', async () => {
    const { analyse, seen } = spying();
    const { answer } = await activateGroup(
      { activation: SILENT, inactive: refused(500) },
      analyse,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    const failure = answer.getError();
    expect(failure.message).toContain(
      "activation's outcome could not be decided",
    );
    expect(failure.response?.status).toBe(500);
    expect(seen[0]?.verdict).not.toBe(ADT_NO_FAILURE);
    expect(seen[0]?.context).toBeUndefined();
  });

  it('a read that fails stays a failure without an analyse', async () => {
    const { client } = replaying({
      activation: SILENT,
      inactive: refused(500),
    });
    const group = client.getFunctionGroup();
    const answer = await group.activate(
      { functionGroupName: 'ZACT751P9325' },
      { headers: headersOf(group, 'activate') },
    );
    expect(answer.ok).toBe(false);
  });
});

/** The `adtcore:uri` of every reference a request body names, in order. */
function urisIn(body: unknown): string[] {
  if (typeof body !== 'string') return [];
  return body
    .split('adtcore:uri="')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('"')));
}

describe('every activation member reads after a silent checklist', () => {
  it.each(ACTIVATING_APIS)(
    '%s reads once and names what its request named',
    async (api) => {
      const { analyse, seen } = spying();
      const { handler, config, calls } = activatingHandler(
        api,
        String(SILENT.data),
      );
      await handler.activate(config, {
        headers: headersOf(handler, 'activate', config),
        analyse,
      });

      const posts = calls.filter((c) => c.method === 'POST');
      expect(calls.map((c) => c.method)).toEqual(['POST', 'GET']);
      expect(calls[1]?.url).toBe(INACTIVE);
      expect(seen[0]?.context?.activation?.named).toEqual(
        urisIn(posts[0]?.data),
      );
      expect(seen[0]?.context?.activation?.named.length).toBeGreaterThan(0);
    },
  );
});
