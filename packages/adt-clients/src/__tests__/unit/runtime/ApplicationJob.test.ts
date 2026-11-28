import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  ApplicationJobCatalog,
  ApplicationJobTemplate,
  applicationJobDocuments,
} from '../../../runtime/applicationJob/ApplicationJob';
import {
  connectionAnswering,
  NAME_CASES,
  quietLogger,
  REFUSALS,
} from './supportReadsHarness';

const KINDS = [
  [
    'ApplicationJobCatalog',
    '/sap/bc/adt/applicationjob/catalogs',
    ApplicationJobCatalog,
    'applicationJobCatalog',
  ],
  [
    'ApplicationJobTemplate',
    '/sap/bc/adt/applicationjob/templates',
    ApplicationJobTemplate,
    'applicationJobTemplate',
  ],
] as const;

describe.each(KINDS)('%s', (_name, collection, Reads, kind) => {
  function reads(answer?: { status: number; data: string }) {
    const { connection, requests } = connectionAnswering(answer);
    const handler = new Reads(connection, {
      logger: quietLogger,
      results: applicationJobDocuments,
    });
    return { handler, requests };
  }

  it('says which resource it is', () => {
    expect(reads().handler.kind).toBe(kind);
  });

  describe.each([
    ['getObject', '', 'application/vnd.sap.adt.blues.v2+xml'],
    ['getSource', '/source/main', 'application/json'],
  ] as const)('%s', (member, suffix, accept) => {
    const call = (
      handler: InstanceType<typeof Reads>,
      name: string,
      options?: Record<string, unknown>,
    ) =>
      member === 'getObject'
        ? handler.getObject(name, options)
        : handler.getSource(name, options);

    it.each(NAME_CASES)(
      '%j is addressed as one segment, %s',
      async (name, segment) => {
        const { handler, requests } = reads();
        await call(handler, name);
        expect(requests).toHaveLength(1);
        expect(requests[0]?.method).toBe('GET');
        expect(requests[0]?.url).toBe(`${collection}/${segment}${suffix}`);
      },
    );

    it(`sends ${accept} by default, timeout 0, no parameter`, async () => {
      const { handler, requests } = reads();
      await call(handler, 'Z_JOB');
      expect(requests[0]?.headers).toEqual({ Accept: accept });
      expect(requests[0]?.timeout).toBe(0);
      expect(requests[0]?.params).toEqual({});
    });

    it("sends the caller's Accept and version, and no other parameter", async () => {
      const { handler, requests } = reads();
      await call(handler, 'Z_JOB', { accept: 'text/html', version: 'active' });
      expect(requests[0]?.headers).toEqual({ Accept: 'text/html' });
      expect(requests[0]?.params).toEqual({ version: 'active' });
    });

    it.each([
      ['404', REFUSALS.notFound],
      ['406', REFUSALS.notAcceptable],
      ['an HTML 500', REFUSALS.overlongName],
    ])(
      'a %s comes back through analyse with its status and body',
      async (_label, refusal) => {
        const { handler, requests } = reads(refusal);
        const answer = await call(handler, 'Z_JOB', {
          analyse: analyseException,
        });
        expect(requests).toHaveLength(1);
        expect(answer.ok).toBe(false);
        if (answer.ok) return;
        expect(answer.getError().response?.status).toBe(refusal.status);
        expect(answer.getError().response?.data).toBe(refusal.data);
      },
    );
  });
});
