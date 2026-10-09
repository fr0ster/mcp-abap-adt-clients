/**
 * A namespaced name is sent as it is spelled. The run body is XML, so the name
 * is escaped for an XML attribute — never URL-encoded, which turned
 * `/ACME/REPORT` into `%2FACME%2FREPORT`, a name no object has.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ClassTestRunner } from '../../../executors/class/ClassTestRunner';
import { FunctionGroupTestRunner } from '../../../executors/functionGroup/FunctionGroupTestRunner';
import { FunctionModuleTestRunner } from '../../../executors/functionModule/FunctionModuleTestRunner';
import { ProgramTestRunner } from '../../../executors/program/ProgramTestRunner';

type Call = { url: string; data?: unknown };

function makeConn() {
  const calls: Call[] = [];
  const conn = {
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return { status: 201, headers: {}, data: '' } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe.each([
  ['report', ProgramTestRunner, '/acme/report', 'PROG'],
  ['function group', FunctionGroupTestRunner, '/acme/group', 'FUGR'],
  ['function module', FunctionModuleTestRunner, '/acme/module', 'FUNC'],
  ['class, by name', ClassTestRunner, '/acme/cl_class', 'CLAS'],
] as const)('a namespaced %s', (_label, Runner, name, type) => {
  it('keeps its slashes in the osl:object, and in the title', async () => {
    const { conn, calls } = makeConn();

    await new Runner(conn).run(name);

    const body = String(calls[0].data);
    const upper = name.toUpperCase();
    expect(body).toContain(`<osl:object name="${upper}" type="${type}"/>`);
    expect(body).toContain(`title="${upper}"`);
    expect(body).not.toContain('%2F');
  });
});

describe('a namespaced class, by test class', () => {
  it('keeps its slashes in containerClass', async () => {
    const { conn, calls } = makeConn();

    await new ClassTestRunner(conn).run([
      { containerClass: '/acme/cl_class', testClass: 'LTC_A' },
    ]);

    const body = String(calls[0].data);
    expect(body).toContain(
      '<aunit:test containerClass="/ACME/CL_CLASS" class="LTC_A"/>',
    );
    expect(body).not.toContain('%2F');
  });
});

describe('what XML would read as markup', () => {
  it('is escaped, in the title and the context', async () => {
    const { conn, calls } = makeConn();

    await new ProgramTestRunner(conn).run('ZREPORT', {
      title: 'a < b & "c"',
      context: "it's",
    });

    const body = String(calls[0].data);
    expect(body).toContain('title="a &lt; b &amp; &quot;c&quot;"');
    expect(body).toContain('context="it&apos;s"');
  });
});
