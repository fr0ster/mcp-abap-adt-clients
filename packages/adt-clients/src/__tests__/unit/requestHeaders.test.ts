/**
 * A request's own headers are the caller's (interfaces-adt 19.0.0).
 *
 * Every implementation of every member that takes `options.headers` sends that
 * pair as the request's `Accept` and `Content-Type`, and nothing else: no
 * constant of its own, no merge, no default, no override. The values below are
 * deliberately ones no implementation could hold as a constant, so a member
 * that still chose its own would send something else and fail here.
 *
 * The table is closed: every class method in `src` named like one of the 32
 * members is found with the TypeScript parser, and each must be reached by a
 * row here (or be listed in `NOT_A_HEADERS_MEMBER` with the contract it
 * implements instead). A new implementation of one of these members that is
 * not in the table fails the completeness check.
 */

import { join } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../batch';
import { AdtAbapGitClient } from '../../clients/AdtAbapGitClient';
import { AdtClient } from '../../clients/AdtClient';
import { AdtExecutor } from '../../clients/AdtExecutor';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { TraceScheduling } from '../../executors/traceScheduling';
import { AbapDebugger } from '../../runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../runtime/debugger/AmdpDebugger';
import { createLibraryLogger } from '../helpers/testLogger';
import {
  expectCarriesItsPair,
  IDENTITY,
  m,
  objectRows,
  ownerOfRow,
  pairFor,
  type Row,
  requestRows,
  scanImplementations,
  utilRows,
} from './requestHeadersGuard';

/**
 * Class methods with one of those names that implement another contract's
 * member, which takes no `headers`.
 */
const NOT_A_HEADERS_MEMBER: Record<string, string> = {
  'Profiler.delete': 'ITraceDeletion.delete — no headers in 19.0.0',
  'AmdpDebugger.syncBreakpoints':
    'IAmdpDebugger.syncBreakpoints — only getDataPreview takes headers there',
};

let scanned: ReturnType<typeof scanImplementations> | undefined;

/** The scan of this package's `src`, made once. */
function SCAN(): ReturnType<typeof scanImplementations> {
  scanned ??= scanImplementations(join(__dirname, '..', '..'));
  return scanned;
}

function otherRows(): Row[] {
  const git = (connection: IAbapConnection) =>
    new AdtAbapGitClient(connection, createLibraryLogger());
  const abap = (connection: IAbapConnection) => new AbapDebugger(connection);
  const amdp = (connection: IAbapConnection) => new AmdpDebugger(connection);
  const trace = { description: 'guard' };
  return [
    {
      name: 'abapGit',
      member: 'link',
      build: git,
      call: (h, headers) =>
        m(h, 'link')(
          { package: 'ZGUARD_PKG', url: 'https://example/guard.git' },
          { headers },
        ),
    },
    {
      name: 'abapGit',
      member: 'pull',
      build: git,
      call: (h, headers) =>
        m(h, 'pull')(
          {
            package: 'ZGUARD_PKG',
            pullLink: '/sap/bc/adt/abapgit/repos/GUARD/pull',
          },
          { headers },
        ),
    },
    {
      name: 'abapGit',
      member: 'checkExternalRepo',
      build: git,
      call: (h, headers) =>
        m(h, 'checkExternalRepo')(
          { url: 'https://example/guard.git' },
          { headers },
        ),
    },
    {
      name: 'trace scheduling',
      member: 'scheduleTrace',
      build: (connection) => new TraceScheduling(connection),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'class executor',
      member: 'scheduleTrace',
      build: (connection) =>
        new AdtExecutor(connection, createLibraryLogger()).getClassExecutor(),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'program executor',
      member: 'scheduleTrace',
      build: (connection) =>
        new AdtExecutor(connection, createLibraryLogger()).getProgramExecutor(),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'abap debugger',
      member: 'setBreakpoints',
      build: abap,
      call: (h, headers) => m(h, 'setBreakpoints')(IDENTITY, [], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'getChildVariables',
      build: abap,
      call: (h, headers) => m(h, 'getChildVariables')(['@ROOT'], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'getVariables',
      build: abap,
      call: (h, headers) => m(h, 'getVariables')(['LV_GUARD'], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'syncBreakpoints',
      build: abap,
      call: (h, headers) =>
        m(h, 'syncBreakpoints')(
          IDENTITY,
          { scope: 'full', breakpoints: [] },
          { headers },
        ),
    },
    {
      name: 'abap debugger',
      member: 'setDebuggerSettings',
      build: abap,
      call: (h, headers) => m(h, 'setDebuggerSettings')({}, { headers }),
    },
    {
      name: 'amdp debugger',
      member: 'getDataPreview',
      build: amdp,
      call: (h, headers) =>
        m(
          h,
          'getDataPreview',
        )({
          headers,
          sessionId: 'GUARD-SESSION',
          debuggerId: 'GUARD-DEBUGGER',
          debuggeeId: 'GUARD-DEBUGGEE',
          variableName: 'LT_GUARD',
        }),
    },
  ];
}

const modern = (connection: IAbapConnection) =>
  new AdtClient(connection, createLibraryLogger());

const ROWS: Row[] = [
  ...objectRows(modern),
  ...requestRows(modern),
  ...utilRows((connection) => new AdtUtils(connection, createLibraryLogger())),
  ...otherRows(),
];

describe('a request carries exactly the headers its caller gave', () => {
  for (const row of ROWS) {
    it(`${row.name}.${row.member}`, async () => {
      await expectCarriesItsPair(row, new Set());
    });
  }
});

describe('the table covers every implementation', () => {
  it('every class implementing a header member is reached by a row', () => {
    const reached = new Set(ROWS.map(ownerOfRow));
    const missing = SCAN().found.filter(
      (impl) => !reached.has(impl) && !(impl in NOT_A_HEADERS_MEMBER),
    );
    expect(missing).toEqual([]);
  });

  it('every computed member name in a scanned class resolves', () => {
    const { unresolvedNames } = SCAN();
    expect({
      'computed member names the scan cannot resolve to a string or a symbol (make them a string literal type, or cover them)':
        unresolvedNames,
    }).toEqual({
      'computed member names the scan cannot resolve to a string or a symbol (make them a string literal type, or cover them)':
        [],
    });
  });

  it('every exclusion still names a declared method', () => {
    const declared = new Set(SCAN().found);
    for (const name of Object.keys(NOT_A_HEADERS_MEMBER)) {
      expect(declared).toContain(name);
    }
  });
});

describe('the batch path', () => {
  it('a member recorded on an AdtBatchConnection carries the pair in its part', async () => {
    const send = jest.fn(async (_request: unknown) => ({
      status: 202,
      statusText: 'Accepted',
      headers: {
        'content-type': 'multipart/mixed; boundary="answer"; charset=utf-8',
      },
      data: '--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200  OK\r\nContent-Type: application/xml\r\n\r\n<body/>\r\n--answer--\r\n',
    }));
    const connection = {
      makeAdtRequest: send,
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } as unknown as IAbapConnection;
    const batch = new AdtBatchConnection(connection, {
      endpoint: 'communication',
    });
    const pair = pairFor('batch.getVariables');

    const pending = m(new AbapDebugger(batch), 'getVariables')(['LV_GUARD'], {
      headers: pair,
    });
    await batch.execute();
    await pending;

    expect(send).toHaveBeenCalledTimes(1);
    const body = (send.mock.calls[0]?.[0] as { data: string } | undefined)
      ?.data;
    expect(body).toContain(`Accept: ${pair.accept}`);
    expect(body).toContain(`Content-Type: ${pair.contentType}`);
  });
});
