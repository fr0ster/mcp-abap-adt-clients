import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import { ApplicationLog } from '../../../runtime/applicationLog/ApplicationLog';
import { AtcLog } from '../../../runtime/atc/AtcLog';
import { DdicActivation } from '../../../runtime/ddic/DdicActivation';
import { AbapDebugger } from '../../../runtime/debugger/AbapDebugger';
import { RuntimeDumps } from '../../../runtime/dumps/RuntimeDumps';
import { MemorySnapshots } from '../../../runtime/memory/MemorySnapshots';
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

  it('profiler() returns a Profiler instance', () => {
    const { client } = createRuntimeClient();
    expect(client.profiler()).toBeInstanceOf(Profiler);
  });

  it('crossTrace() returns a CrossTrace instance', () => {
    const { client } = createRuntimeClient();
    expect(client.crossTrace()).toBeInstanceOf(CrossTrace);
  });

  it('st05Trace() returns an St05Trace instance', () => {
    const { client } = createRuntimeClient();
    expect(client.st05Trace()).toBeInstanceOf(St05Trace);
  });

  it('debugger() returns an AbapDebugger instance', () => {
    const { client } = createRuntimeClient();
    expect(client.debugger()).toBeInstanceOf(AbapDebugger);
  });

  it('applicationLog() returns an ApplicationLog instance', () => {
    const { client } = createRuntimeClient();
    expect(client.applicationLog()).toBeInstanceOf(ApplicationLog);
  });

  it('atcLog() returns an AtcLog instance', () => {
    const { client } = createRuntimeClient();
    expect(client.atcLog()).toBeInstanceOf(AtcLog);
  });

  it('ddicActivation() returns a DdicActivation instance', () => {
    const { client } = createRuntimeClient();
    expect(client.ddicActivation()).toBeInstanceOf(DdicActivation);
  });

  it('dumps() returns a RuntimeDumps instance', () => {
    const { client } = createRuntimeClient();
    expect(client.dumps()).toBeInstanceOf(RuntimeDumps);
  });

  it('memorySnapshots() returns a MemorySnapshots instance', () => {
    const { client } = createRuntimeClient();
    expect(client.memorySnapshots()).toBeInstanceOf(MemorySnapshots);
  });

  describe('caching', () => {
    it('profiler() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.profiler()).toBe(client.profiler());
    });

    it('crossTrace() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.crossTrace()).toBe(client.crossTrace());
    });

    it('st05Trace() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.st05Trace()).toBe(client.st05Trace());
    });

    it('debugger() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.debugger()).toBe(client.debugger());
    });

    it('applicationLog() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.applicationLog()).toBe(client.applicationLog());
    });

    it('atcLog() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.atcLog()).toBe(client.atcLog());
    });

    it('ddicActivation() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.ddicActivation()).toBe(client.ddicActivation());
    });

    it('dumps() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.dumps()).toBe(client.dumps());
    });

    it('memorySnapshots() returns the same instance on repeated calls', () => {
      const { client } = createRuntimeClient();
      expect(client.memorySnapshots()).toBe(client.memorySnapshots());
    });
  });

  describe('domain object methods', () => {
    it('profiler has expected methods', () => {
      const { client } = createRuntimeClient();
      const p = client.profiler();
      expect(typeof p.listTraceFiles).toBe('function');
      expect(typeof p.getParameters).toBe('function');
      expect(typeof p.getHitList).toBe('function');
    });

    it('debugger has expected methods', () => {
      const { client } = createRuntimeClient();
      const d = client.debugger();
      expect(typeof d.launch).toBe('function');
      expect(typeof d.stop).toBe('function');
      expect(typeof d.getCallStack).toBe('function');
    });

    it('dumps has expected methods', () => {
      const { client } = createRuntimeClient();
      const d = client.dumps();
      expect(typeof d.list).toBe('function');
      expect(typeof d.getById).toBe('function');
      expect(typeof d.buildIdPrefix).toBe('function');
    });
  });
});
