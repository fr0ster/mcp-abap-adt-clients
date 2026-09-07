import { AdtClass } from '../../../../core/class/AdtClass';
import { AdtDomain } from '../../../../core/domain/AdtDomain';
import { AdtServiceDefinition } from '../../../../core/serviceDefinition/AdtServiceDefinition';

/**
 * Records session toggles AND requests in ONE ordered trace, so the test can
 * assert the older-BASIS ordering (stateful must precede the UNLOCK request,
 * stateless must follow it) rather than only the final session state.
 */
function recordingConnection() {
  const trace: string[] = [];
  return {
    trace,
    setSessionType: (t: string) => trace.push(`session:${t}`),
    makeAdtRequest: async (req: any) => {
      const url: string = req?.url ?? '';
      const action = /_action=(\w+)/.exec(url)?.[1] ?? 'GET';
      trace.push(`request:${action}`);
      return {
        status: 200,
        headers: {},
        // minimal LOCK response shape the low-level parsers accept
        data: `<?xml version="1.0"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>`,
      };
    },
  } as any;
}

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

const cases = [
  {
    name: 'AdtClass',
    make: (c: any) => new AdtClass(c, noopLogger),
    cfg: { className: 'ZC' },
  },
  {
    name: 'AdtDomain',
    make: (c: any) => new AdtDomain(c, noopLogger),
    cfg: { domainName: 'ZD' },
  },
  {
    name: 'AdtServiceDefinition',
    make: (c: any) => new AdtServiceDefinition(c, noopLogger),
    cfg: { serviceDefinitionName: 'ZS' },
  },
];

describe('LockCapability conformance across handlers', () => {
  it.each(
    cases,
  )('$name: lock is stateful → LOCK → stateless, in order', async ({
    make,
    cfg,
  }) => {
    const conn = recordingConnection();
    const handler = make(conn);
    await handler.lock(cfg);
    const iSession = conn.trace.indexOf('session:stateful');
    const iRequest = conn.trace.findIndex((e: string) =>
      e.startsWith('request:'),
    );
    expect(iSession).toBeGreaterThanOrEqual(0);
    expect(iRequest).toBeGreaterThan(iSession); // stateful BEFORE the request

    // and stateless again after it. This used to assert the opposite — that
    // the session is "left stateful (the lock is held)" — which made every
    // write in the window run inside the session. Eclipse holds its stateful
    // session for LOCK and UNLOCK alone; measured on E19, its source PUT is
    // stateless and carries only `lockHandle` and `corrNr`. What a request
    // takes while it runs inside the session stays with that session, which
    // is how an activation left `E_ABAP_GENPH` behind for hours.
    expect(
      conn.trace.filter((e: string) => e.startsWith('session:')).pop(),
    ).toBe('session:stateless');
  });

  it.each(
    cases,
  )('$name: unlock is stateful → UNLOCK → stateless, in order', async ({
    make,
    cfg,
  }) => {
    const conn = recordingConnection();
    const handler = make(conn);
    await handler.unlock(cfg, 'H1');
    const iStateful = conn.trace.indexOf('session:stateful');
    const iUnlock = conn.trace.indexOf('request:UNLOCK');
    const iStateless = conn.trace.indexOf('session:stateless');
    expect(iStateful).toBeGreaterThanOrEqual(0);
    expect(iUnlock).toBeGreaterThan(iStateful); // stateful BEFORE unlock (older BASIS)
    expect(iStateless).toBeGreaterThan(iUnlock); // stateless AFTER unlock
  });
});
