import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { checkAccessControl } from '../../../core/accessControl/check';
import { checkClass } from '../../../core/class/check';
import { checkDdl } from '../../../core/ddl/check';
import { checkFunctionModule } from '../../../core/functionModule/check';

const report = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">
  ${inner}
</chkrun:checkRunReports>`;

/** A syntax error found. The check itself worked. */
const withError = report(`
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:status="processed"
    chkrun:statusText="checked">
    <chkrun:checkMessageList>
      <chkrun:checkMessage chkrun:type="E" chkrun:shortText="Field FOO unknown"/>
    </chkrun:checkMessageList>
  </chkrun:checkReport>`);

/** The server declining to run the check at all. Still an answer. */
const notProcessed = report(`
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:status="notProcessed"
    chkrun:statusText="Data definition does not exist"/>`);

const respondingWith = (body: string) => {
  const calls: string[] = [];
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async (request: { url: string }) => {
      calls.push(request.url);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: body,
      } as IAdtWireResponse;
    },
  };
  return { connection: connection as IAbapConnection, calls };
};

describe('a check run that finds an error', () => {
  it('comes back from checkClass as the response', async () => {
    const { connection } = respondingWith(withError);
    const answer = await checkClass(connection, 'ZOK_CL', 'inactive');
    expect(answer.status).toBe(200);
    expect(answer.data).toContain('Field FOO unknown');
  });

  it('comes back from checkAccessControl as the response', async () => {
    const { connection } = respondingWith(withError);
    const answer = await checkAccessControl(connection, 'ZOK_DCL', 'inactive');
    expect(answer.data).toContain('Field FOO unknown');
  });
});

describe('a check run the server did not process', () => {
  it('comes back from checkFunctionModule as the response', async () => {
    const { connection } = respondingWith(notProcessed);
    const answer = await checkFunctionModule(
      connection,
      'ZOK_FG',
      'ZOK_FM',
      'inactive',
    );
    expect(answer.data).toContain('does not exist');
  });

  it('is not retried by checkDdl', async () => {
    const { connection, calls } = respondingWith(notProcessed);
    const answer = await checkDdl(connection, 'ZOK_DDL', 'inactive');
    expect(answer.data).toContain('does not exist');
    expect(calls).toHaveLength(1);
  });
});
