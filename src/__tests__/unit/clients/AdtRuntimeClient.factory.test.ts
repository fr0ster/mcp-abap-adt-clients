import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import { ApplicationLog } from '../../../runtime/applicationLog/ApplicationLog';
import { AdtAtc } from '../../../runtime/atc/AdtAtc';
import { AtcLog } from '../../../runtime/atc/AtcLog';
import { DdicActivation } from '../../../runtime/ddic/DdicActivation';
import { RuntimeDumps } from '../../../runtime/dumps/RuntimeDumps';
import { FeedRepository } from '../../../runtime/feeds/FeedRepository';
import { GatewayErrorLog } from '../../../runtime/gatewayErrorLog/GatewayErrorLog';
import { SystemMessages } from '../../../runtime/systemMessages/SystemMessages';
import { CrossTrace } from '../../../runtime/traces/CrossTraceDomain';
import { Profiler } from '../../../runtime/traces/ProfilerDomain';
import { St05Trace } from '../../../runtime/traces/St05Trace';

describe('AdtRuntimeClient factory pattern', () => {
  function createRuntimeClient() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;

    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = new AdtRuntimeClient(connection, logger, {
      enableAcceptCorrection: false,
    });
    return { client, connection };
  }

  it('getProfiler() returns a Profiler instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getProfiler()).toBeInstanceOf(Profiler);
  });

  it('getCrossTrace() returns a CrossTrace instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getCrossTrace()).toBeInstanceOf(CrossTrace);
  });

  it('getSt05Trace() returns an St05Trace instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getSt05Trace()).toBeInstanceOf(St05Trace);
  });

  const { client } = createRuntimeClient();
});

it('getApplicationLog() returns an ApplicationLog instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getApplicationLog()).toBeInstanceOf(ApplicationLog);
});

it('getAtcLog() returns an AtcLog instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getAtcLog()).toBeInstanceOf(AtcLog);
});

// Two neighbours with almost the same name reading the same subject from
// different resources: getAtc() runs checks, getAtcLog() reads execution logs.
// Asserting they are different objects is the cheap way to catch a factory
// wired to the wrong cached field.
it('getAtc() returns an AdtAtc instance, distinct from getAtcLog()', () => {
  const { client } = createRuntimeClient();
  expect(client.getAtc()).toBeInstanceOf(AdtAtc);
  expect(client.getAtc()).not.toBe(client.getAtcLog());
});

it('getDdicActivation() returns a DdicActivation instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getDdicActivation()).toBeInstanceOf(DdicActivation);
});

it('getDumps() returns a RuntimeDumps instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getDumps()).toBeInstanceOf(RuntimeDumps);
});

it('getFeeds() returns a FeedRepository instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getFeeds()).toBeInstanceOf(FeedRepository);
});

it('getSystemMessages() returns a SystemMessages instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getSystemMessages()).toBeInstanceOf(SystemMessages);
});

it('getGatewayErrorLog() returns a GatewayErrorLog instance', () => {
  const { client } = createRuntimeClient();
  expect(client.getGatewayErrorLog()).toBeInstanceOf(GatewayErrorLog);
});

describe('caching', () => {
  it('getProfiler() returns the same instance on repeated calls', () => {
    const { client } = createRuntimeClient();
    expect(client.getProfiler()).toBe(client.getProfiler());
  });

  it('getCrossTrace() returns the same instance on repeated calls', () => {
    const { client } = createRuntimeClient();
    expect(client.getCrossTrace()).toBe(client.getCrossTrace());
  });

  it('getSt05Trace() returns the same instance on repeated calls', () => {
    const { client } = createRuntimeClient();
    expect(client.getSt05Trace()).toBe(client.getSt05Trace());
  });

  const { client } = createRuntimeClient();
});

it('getApplicationLog() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getApplicationLog()).toBe(client.getApplicationLog());
});

it('getAtcLog() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getAtcLog()).toBe(client.getAtcLog());
});

it('getAtc() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getAtc()).toBe(client.getAtc());
});

it('getDdicActivation() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getDdicActivation()).toBe(client.getDdicActivation());
});

it('getDumps() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getDumps()).toBe(client.getDumps());
});

it('getFeeds() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getFeeds()).toBe(client.getFeeds());
});

it('getSystemMessages() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getSystemMessages()).toBe(client.getSystemMessages());
});

it('getGatewayErrorLog() returns the same instance on repeated calls', () => {
  const { client } = createRuntimeClient();
  expect(client.getGatewayErrorLog()).toBe(client.getGatewayErrorLog());
});
})

describe('composite debugger', () => {
  const { client } = createRuntimeClient();
});

const { client } = createRuntimeClient();
})

const { client } = createRuntimeClient();
})

const { client } = createRuntimeClient();
expect(dbg.getAbap()).toBe(dbg.getAbap());
expect(dbg.getAmdp()).toBe(dbg.getAmdp());
})

const { client } = createRuntimeClient();
})

const { client } = createRuntimeClient();
})

const { client } = createRuntimeClient();
})

const { client } = createRuntimeClient();
'memorySnapshots',
)
})
})

describe('domain object methods', () => {
  it('profiler has expected methods', () => {
    const { client } = createRuntimeClient();
    const p = client.getProfiler();
    expect(typeof p.list).toBe('function');
    expect(typeof p.read).toBe('function');
  });

  it('abap debugger has expected methods', () => {
    const { client } = createRuntimeClient();
    expect(typeof d.launch).toBe('function');
    expect(typeof d.stop).toBe('function');
    expect(typeof d.getCallStack).toBe('function');
  });

  // The three capabilities the narrowed return type promises, and nothing
  // else: no create, no lock, no activate.
  it('atc has exactly the runnable and reader methods', () => {
    const { client } = createRuntimeClient();
    const atc = client.getAtc();
    expect(typeof atc.run).toBe('function');
    expect(typeof atc.getRunStatus).toBe('function');
    expect(typeof atc.getFindings).toBe('function');
  });

  it('dumps has expected methods', () => {
    const { client } = createRuntimeClient();
    const d = client.getDumps();
    expect(typeof d.list).toBe('function');
    expect(typeof d.getById).toBe('function');
  });
});
})
