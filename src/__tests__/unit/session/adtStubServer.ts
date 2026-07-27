/**
 * Minimal ADT stub over node:http.
 *
 * Purpose: run the REAL @mcp-abap-adt/connection against something that records
 * every byte of every request it emits — including the housekeeping requests the
 * connector makes on its own (CSRF fetch, retries), which are invisible from
 * behind IAbapConnection. No SAP system and no credentials involved.
 *
 * The stub models just enough ADT: hand out a CSRF token plus a session cookie,
 * answer everything else with 200, and let a test force a status on any path.
 */

import { createServer, type Server } from 'node:http';

export interface StubRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  /** True when the request carried the ADT stateful marker. */
  stateful: boolean;
}

export interface AdtStub {
  baseUrl: string;
  requests: StubRequest[];
  /** Force a status for the next request whose URL contains `match`. */
  failNext(match: string, status: number): void;
  close(): Promise<void>;
  /** Requests whose URL contains `match`. */
  matching(match: string): StubRequest[];
  /** How many distinct sessions the stub has handed out so far. */
  sessionsOpened(): number;
}

export async function startAdtStub(): Promise<AdtStub> {
  const requests: StubRequest[] = [];
  const failures: Array<{ match: string; status: number }> = [];
  let sessionsOpened = 0;

  const server: Server = createServer((req, res) => {
    const url = req.url ?? '';
    requests.push({
      method: req.method ?? 'GET',
      url,
      headers: req.headers,
      stateful: req.headers['x-sap-adt-sessiontype'] === 'stateful',
    });

    const failureIndex = failures.findIndex((f) => url.includes(f.match));
    if (failureIndex !== -1) {
      const [failure] = failures.splice(failureIndex, 1);
      res.writeHead(failure.status, { 'content-type': 'text/html' });
      // SAP wording matters: the connector only treats a 403 as a token problem
      // when the body mentions CSRF (shouldRetryCsrf).
      res.end(
        failure.status === 403
          ? '<html><body>CSRF token validation failed</body></html>'
          : '<html><body>forced</body></html>',
      );
      return;
    }

    // Discovery doubles as the CSRF endpoint and opens a session. Each fetch
    // opens a DISTINCT one, the way SAP does — that is what makes a silent
    // re-establishment visible instead of looking like session continuity.
    if (
      url.includes('/sap/bc/adt/core/discovery') ||
      url.includes('/sap/bc/adt/discovery')
    ) {
      sessionsOpened += 1;
      res.writeHead(200, {
        'content-type': 'application/atomsvc+xml',
        'x-csrf-token': `STUB-CSRF-TOKEN-${sessionsOpened}`,
        'set-cookie': `SAP_SESSIONID_STUB_100=STUB-SESSION-${sessionsOpened}; Path=/`,
      });
      res.end('<service/>');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('stub server did not bind to a TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    failNext: (match, status) => failures.push({ match, status }),
    matching: (match) => requests.filter((r) => r.url.includes(match)),
    sessionsOpened: () => sessionsOpened,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
