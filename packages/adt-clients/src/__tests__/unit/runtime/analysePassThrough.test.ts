/**
 * Every runtime member issues one request and hands the answer to the result
 * strategy the object was built with and to the caller's `analyse` — nothing
 * else. Two things are asserted per member: with no strategy given, the
 * document comes back as it arrived; with an `analyse` that refuses, the answer
 * is that refusal.
 */
import type { IAdtAnalyseOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ApplicationLog,
  applicationLogDocuments,
} from '../../../runtime/applicationLog/ApplicationLog';
import { AtcLog, atcLogDocuments } from '../../../runtime/atc/AtcLog';
import {
  DdicActivation,
  ddicActivationDocuments,
} from '../../../runtime/ddic/DdicActivation';
import {
  RuntimeDumps,
  runtimeDumpsDocuments,
} from '../../../runtime/dumps/RuntimeDumps';
import {
  GatewayErrorLog,
  gatewayErrorLogDocuments,
} from '../../../runtime/gatewayErrorLog/GatewayErrorLog';
import {
  SystemMessages,
  systemMessagesDocuments,
} from '../../../runtime/systemMessages/SystemMessages';
import {
  CrossTrace,
  crossTraceDocuments,
} from '../../../runtime/traces/CrossTraceDomain';
import {
  St05Trace,
  st05TraceDocuments,
} from '../../../runtime/traces/St05Trace';
import { expectResult } from '../../helpers/contract';

const BODY = '<doc/>';

function connection() {
  return {
    makeAdtRequest: jest
      .fn()
      .mockResolvedValue({ status: 200, data: BODY, headers: {} }),
  } as unknown as IAbapConnection;
}

const logger = {} as never;
const refuse: IAdtAnalyseOptions = {
  analyse: () => ({ origin: 'refusal', message: 'refused by the caller' }),
};

type Member = (
  options?: IAdtAnalyseOptions,
) => Promise<{ ok: boolean; getResult?: unknown }>;

const members: [string, (c: IAbapConnection) => Member][] = [
  [
    'RuntimeDumps.list',
    (c) => (o) => new RuntimeDumps(c, logger, runtimeDumpsDocuments).list(o),
  ],
  [
    'RuntimeDumps.listByUser',
    (c) => (o) =>
      new RuntimeDumps(c, logger, runtimeDumpsDocuments).listByUser('U', o),
  ],
  [
    'RuntimeDumps.getById',
    (c) => (o) =>
      new RuntimeDumps(c, logger, runtimeDumpsDocuments).getById('D', o),
  ],
  [
    'AtcLog.getCheckFailureLogs',
    (c) => (o) => new AtcLog(c, logger, atcLogDocuments).getCheckFailureLogs(o),
  ],
  [
    'AtcLog.getExecutionLog',
    (c) => (o) =>
      new AtcLog(c, logger, atcLogDocuments).getExecutionLog('X', o),
  ],
  [
    'ApplicationLog.getObject',
    (c) => (o) =>
      new ApplicationLog(c, logger, applicationLogDocuments).getObject('Z', o),
  ],
  [
    'ApplicationLog.getSource',
    (c) => (o) =>
      new ApplicationLog(c, logger, applicationLogDocuments).getSource('Z', o),
  ],
  [
    'ApplicationLog.validateName',
    (c) => (o) =>
      new ApplicationLog(c, logger, applicationLogDocuments).validateName(
        'Z',
        o,
      ),
  ],
  [
    'DdicActivation.getGraph',
    (c) => (o) =>
      new DdicActivation(c, logger, ddicActivationDocuments).getGraph(o),
  ],
  [
    'SystemMessages.list',
    (c) => (o) =>
      new SystemMessages(c, logger, systemMessagesDocuments).list(o),
  ],
  [
    'SystemMessages.getById',
    (c) => (o) =>
      new SystemMessages(c, logger, systemMessagesDocuments).getById('M', o),
  ],
  [
    'GatewayErrorLog.list',
    (c) => (o) =>
      new GatewayErrorLog(c, logger, gatewayErrorLogDocuments).list(o),
  ],
  [
    'GatewayErrorLog.getById',
    (c) => (o) =>
      new GatewayErrorLog(c, logger, gatewayErrorLogDocuments).getById(
        'T',
        'I',
        o,
      ),
  ],
  [
    'St05Trace.getState',
    (c) => (o) => new St05Trace(c, logger, st05TraceDocuments).getState(o),
  ],
  [
    'St05Trace.getDirectory',
    (c) => (o) => new St05Trace(c, logger, st05TraceDocuments).getDirectory(o),
  ],
  [
    'CrossTrace.list',
    (c) => (o) => new CrossTrace(c, logger, crossTraceDocuments).list(o),
  ],
  [
    'CrossTrace.getById',
    (c) => (o) =>
      new CrossTrace(c, logger, crossTraceDocuments).getById('T', undefined, o),
  ],
  [
    'CrossTrace.getRecords',
    (c) => (o) =>
      new CrossTrace(c, logger, crossTraceDocuments).getRecords('T', o),
  ],
  [
    'CrossTrace.getRecordContent',
    (c) => (o) =>
      new CrossTrace(c, logger, crossTraceDocuments).getRecordContent(
        'T',
        1,
        o,
      ),
  ],
  [
    'CrossTrace.getActivations',
    (c) => (o) =>
      new CrossTrace(c, logger, crossTraceDocuments).getActivations(o),
  ],
];

describe.each(members)('%s', (_name, build) => {
  it('answers the document as it arrived, from one request', async () => {
    const c = connection();
    const answer = await build(c)();
    expect(expectResult(answer as never, 'document')).toBe(BODY);
    expect(c.makeAdtRequest).toHaveBeenCalledTimes(1);
  });

  it("answers the caller's refusal when analyse gives one", async () => {
    const answer = await build(connection())(refuse);
    expect(answer.ok).toBe(false);
  });
});

it('a result set given at construction reads the answer', async () => {
  const dumps = new RuntimeDumps(connection(), logger, {
    list: (answer) => String(answer.data).length,
    dump: (answer) => answer.status,
  });
  expect(expectResult(await dumps.list(), 'list')).toBe(BODY.length);
  expect(expectResult(await dumps.getById('D'), 'dump')).toBe(200);
});
