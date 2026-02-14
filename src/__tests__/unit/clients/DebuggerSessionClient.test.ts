import type { AdtClientsWS } from '../../../clients/AdtClientsWS';
import { DebuggerSessionClient } from '../../../clients/DebuggerSessionClient';

describe('DebuggerSessionClient', () => {
  it('maps listen operation to ws request', async () => {
    const wsClient = {
      request: jest.fn().mockResolvedValue({ sessionId: 's1' }),
    } as unknown as AdtClientsWS;
    const client = new DebuggerSessionClient(wsClient);

    const result = await client.listen({ timeoutSeconds: 60, user: 'DEMO' });

    expect(wsClient.request).toHaveBeenCalledWith('debugger.listen', {
      timeoutSeconds: 60,
      user: 'DEMO',
    });
    expect(result).toEqual({ sessionId: 's1' });
  });

  it('maps attach operation to ws request', async () => {
    const wsClient = {
      request: jest.fn().mockResolvedValue({ attached: true }),
    } as unknown as AdtClientsWS;
    const client = new DebuggerSessionClient(wsClient);

    const result = await client.attach({ sessionId: 'sid-1' });

    expect(wsClient.request).toHaveBeenCalledWith('debugger.attach', {
      sessionId: 'sid-1',
    });
    expect(result).toEqual({ attached: true });
  });

  it('maps detach operation to ws request', async () => {
    const wsClient = {
      request: jest.fn().mockResolvedValue({ detached: true }),
    } as unknown as AdtClientsWS;
    const client = new DebuggerSessionClient(wsClient);

    const result = await client.detach();

    expect(wsClient.request).toHaveBeenCalledWith('debugger.detach');
    expect(result).toEqual({ detached: true });
  });

  it('maps step operation to ws request', async () => {
    const wsClient = {
      request: jest.fn().mockResolvedValue({ paused: true }),
    } as unknown as AdtClientsWS;
    const client = new DebuggerSessionClient(wsClient);

    const result = await client.step({ action: 'step_over' });

    expect(wsClient.request).toHaveBeenCalledWith('debugger.step', {
      action: 'step_over',
    });
    expect(result).toEqual({ paused: true });
  });

  it('maps getStack and getVariables operations to ws request', async () => {
    const wsClient = {
      request: jest
        .fn()
        .mockResolvedValueOnce([{ frame: 1 }])
        .mockResolvedValueOnce({ vars: [] }),
    } as unknown as AdtClientsWS;
    const client = new DebuggerSessionClient(wsClient);

    const stack = await client.getStack();
    const vars = await client.getVariables({ frameId: 'f1', filter: 'lv_*' });

    expect(wsClient.request).toHaveBeenNthCalledWith(1, 'debugger.getStack');
    expect(wsClient.request).toHaveBeenNthCalledWith(
      2,
      'debugger.getVariables',
      { frameId: 'f1', filter: 'lv_*' },
    );
    expect(stack).toEqual([{ frame: 1 }]);
    expect(vars).toEqual({ vars: [] });
  });
});
