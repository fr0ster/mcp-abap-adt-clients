/**
 * The twelve classes that require a logger take it in their options, like
 * every other constructor takes its context (`AdtLoggedOptions`): one
 * constructor shape, `(connection, options)`. The logger is required by the
 * type alone, so a call without it does not compile (`npm run test:check`
 * runs these checks), and nothing checks it at run time.
 */

import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import {
  ApplicationLog,
  applicationLogDocuments,
} from '../../../runtime/applicationLog/ApplicationLog';
import { AdtAtc, atcDocuments } from '../../../runtime/atc/AdtAtc';
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
  FeedRepository,
  feedDocuments,
} from '../../../runtime/feeds/FeedRepository';
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
  Profiler,
  profilerDocuments,
} from '../../../runtime/traces/ProfilerDomain';
import {
  St05Trace,
  st05TraceDocuments,
} from '../../../runtime/traces/St05Trace';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

function withLogger(): void {
  const c = new RecordingConnection();
  const logger = noopLogger;
  new AdtUtils(c, { logger, results: utilDocuments });
  new ApplicationLog(c, { logger, results: applicationLogDocuments });
  new AdtAtc(c, { logger, results: atcDocuments });
  new AtcLog(c, { logger, results: atcLogDocuments });
  new DdicActivation(c, { logger, results: ddicActivationDocuments });
  new RuntimeDumps(c, { logger, results: runtimeDumpsDocuments });
  new FeedRepository(c, { logger, results: feedDocuments });
  new GatewayErrorLog(c, { logger, results: gatewayErrorLogDocuments });
  new SystemMessages(c, { logger, results: systemMessagesDocuments });
  new CrossTrace(c, { logger, results: crossTraceDocuments });
  new Profiler(c, { logger, results: profilerDocuments });
  new St05Trace(c, { logger, results: st05TraceDocuments });
}

function withoutLogger(): void {
  const c = new RecordingConnection();
  // @ts-expect-error -- the logger is required
  new AdtUtils(c, { results: utilDocuments });
  // @ts-expect-error -- the logger is required
  new ApplicationLog(c, { results: applicationLogDocuments });
  // @ts-expect-error -- the logger is required
  new AdtAtc(c, { results: atcDocuments });
  // @ts-expect-error -- the logger is required
  new AtcLog(c, { results: atcLogDocuments });
  // @ts-expect-error -- the logger is required
  new DdicActivation(c, { results: ddicActivationDocuments });
  // @ts-expect-error -- the logger is required
  new RuntimeDumps(c, { results: runtimeDumpsDocuments });
  // @ts-expect-error -- the logger is required
  new FeedRepository(c, { results: feedDocuments });
  // @ts-expect-error -- the logger is required
  new GatewayErrorLog(c, { results: gatewayErrorLogDocuments });
  // @ts-expect-error -- the logger is required
  new SystemMessages(c, { results: systemMessagesDocuments });
  // @ts-expect-error -- the logger is required
  new CrossTrace(c, { results: crossTraceDocuments });
  // @ts-expect-error -- the logger is required
  new Profiler(c, { results: profilerDocuments });
  // @ts-expect-error -- the logger is required
  new St05Trace(c, { results: st05TraceDocuments });
  // @ts-expect-error -- not `undefined` either
  new RuntimeDumps(c, { logger: undefined, results: runtimeDumpsDocuments });
  // @ts-expect-error -- the positional logger of the previous shape is gone
  new RuntimeDumps(c, noopLogger, { results: runtimeDumpsDocuments });
}

describe('a class that requires a logger', () => {
  it('takes it in its options (checked by npm run test:check)', () => {
    expect(typeof withLogger).toBe('function');
    expect(typeof withoutLogger).toBe('function');
  });

  it('keeps the logger it was given', () => {
    const profiler = new Profiler(new RecordingConnection(), {
      logger: noopLogger,
      results: profilerDocuments,
    });
    expect(profiler._logger).toBe(noopLogger);
  });
});
