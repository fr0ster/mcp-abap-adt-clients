import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import { ApplicationLog } from '../../../runtime/applicationLog/ApplicationLog';
import { AtcLog } from '../../../runtime/atc/AtcLog';
import { DdicActivation } from '../../../runtime/ddic/DdicActivation';
import { AbapDebugger } from '../../../runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../../runtime/debugger/AmdpDebugger';
import { Debugger } from '../../../runtime/debugger/Debugger';
import { RuntimeDumps } from '../../../runtime/dumps/RuntimeDumps';
import { FeedRepository } from '../../../runtime/feeds/FeedRepository';
import { GatewayErrorLog } from '../../../runtime/gatewayErrorLog/GatewayErrorLog';
import { MemorySnapshots } from '../../../runtime/memory/MemorySnapshots';
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

  it('getDebugger() returns a Debugger instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getDebugger()).toBeInstanceOf(Debugger);
  });

  it('getApplicationLog() returns an ApplicationLog instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getApplicationLog()).toBeInstanceOf(ApplicationLog);
  });

  it('getAtcLog() returns an AtcLog instance', () => {
    const { client } = createRuntimeClient();
    expect(client.getAtcLog()).toBeInstanceOf(AtcLog);
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

    it('getDebugger() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.getDebugger()).toBe(client.getDebugger());
    });

    it('getApplicationLog() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.getApplicationLog()).toBe(client.getApplicationLog());
    });

    it('getAtcLog() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.getAtcLog()).toBe(client.getAtcLog());
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
  });

  describe('composite debugger', () => {
    it('getDebugger().getAbap() returns an AbapDebugger instance', () => {
      const { client } = createRuntimeClient();
      const dbg = client.getDebugger();
      expect(dbg.getAbap()).toBeInstanceOf(AbapDebugger);
    });

    it('getDebugger().getAmdp() returns an AmdpDebugger instance', () => {
      const { client } = createRuntimeClient();
      const dbg = client.getDebugger();
      expect(dbg.getAmdp()).toBeInstanceOf(AmdpDebugger);
    });

    it('getDebugger().getMemorySnapshots() returns a MemorySnapshots instance', () => {
      const { client } = createRuntimeClient();
      const dbg = client.getDebugger();
      expect(dbg.getMemorySnapshots()).toBeInstanceOf(MemorySnapshots);
    });

    it('getDebugger() sub-factories cache their instances', () => {
      const { client } = createRuntimeClient();
      const dbg = client.getDebugger();
      expect(dbg.getAbap()).toBe(dbg.getAbap());
      expect(dbg.getAmdp()).toBe(dbg.getAmdp());
      expect(dbg.getMemorySnapshots()).toBe(dbg.getMemorySnapshots());
    });

    it('getDebugger() has kind "debugger"', () => {
      const { client } = createRuntimeClient();
      expect(client.getDebugger().kind).toBe('debugger');
    });

    it('getDebugger().getAbap() has kind "abapDebugger"', () => {
      const { client } = createRuntimeClient();
      expect(client.getDebugger().getAbap().kind).toBe('abapDebugger');
    });

    it('getDebugger().getAmdp() has kind "amdpDebugger"', () => {
      const { client } = createRuntimeClient();
      expect(client.getDebugger().getAmdp().kind).toBe('amdpDebugger');
    });

    it('getDebugger().getMemorySnapshots() has kind "memorySnapshots"', () => {
      const { client } = createRuntimeClient();
      expect(client.getDebugger().getMemorySnapshots().kind).toBe(
        'memorySnapshots',
      );
    });
  });

  describe('domain object methods', () => {
    it('profiler has expected methods', () => {
      const { client } = createRuntimeClient();
      const p = client.getProfiler();
      expect(typeof p.list).toBe('function');
      expect(typeof p.getParameters).toBe('function');
      expect(typeof p.getHitList).toBe('function');
    });

    it('abap debugger has expected methods', () => {
      const { client } = createRuntimeClient();
      const d = client.getDebugger().getAbap();
      expect(typeof d.launch).toBe('function');
      expect(typeof d.stop).toBe('function');
      expect(typeof d.getCallStack).toBe('function');
    });

    it('dumps has expected methods', () => {
      const { client } = createRuntimeClient();
      const d = client.getDumps();
      expect(typeof d.list).toBe('function');
      expect(typeof d.getById).toBe('function');
    });
  });
});
