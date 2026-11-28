import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  KeywordDocumentation,
  keywordDocumentationDocuments,
} from '../../../runtime/keywordDocumentation/KeywordDocumentation';
import {
  connectionAnswering,
  quietLogger,
  REFUSALS,
} from './supportReadsHarness';

const COLLECTION = '/sap/bc/adt/docu/abap/langu';
const ACCEPT = 'application/vnd.sap.adt.docu.v1+html';

function docs(answer?: { status: number; data: string }) {
  const { connection, requests } = connectionAnswering(answer);
  const handler = new KeywordDocumentation(connection, {
    logger: quietLogger,
    results: keywordDocumentationDocuments,
  });
  return { handler, requests };
}

type Form = 'query' | 'topic' | 'position';
const FORMS: ReadonlyArray<readonly [Form, string]> = [
  ['query', 'query'],
  ['topic', 'object'],
  ['position', 'uri'],
];

function call(
  handler: KeywordDocumentation,
  form: Form,
  value: string,
  extra: Record<string, string> = {},
  options?: Record<string, unknown>,
) {
  if (form === 'query')
    return handler.query({ query: value, ...extra }, options);
  if (form === 'topic')
    return handler.topic({ object: value, ...extra }, options);
  return handler.position({ uri: value, ...extra }, options);
}

describe('KeywordDocumentation', () => {
  it('says which resource it is', () => {
    expect(docs().handler.kind).toBe('abapKeywordDocumentation');
  });

  describe.each(FORMS)('%s', (form, parameter) => {
    it(`sends only ${parameter}, on the collection, ${ACCEPT}, timeout 0, one request`, async () => {
      const { handler, requests } = docs();
      await call(handler, form, 'V');
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe('GET');
      expect(requests[0]?.url).toBe(COLLECTION);
      expect(requests[0]?.params).toEqual({ [parameter]: 'V' });
      expect(requests[0]?.headers).toEqual({ Accept: ACCEPT });
      expect(requests[0]?.timeout).toBe(0);
    });

    it('sends language, version and format as given, each only when given', async () => {
      const { handler, requests } = docs();
      await call(handler, form, 'V', {
        language: 'EN',
        version: 'X',
        format: 'eclipse',
      });
      expect(requests[0]?.params).toEqual({
        [parameter]: 'V',
        language: 'EN',
        version: 'X',
        format: 'eclipse',
      });
    });

    it("sends '' as an empty parameter, as a link carries it", async () => {
      const { handler, requests } = docs();
      await call(handler, form, 'V', { language: '', version: '' });
      expect(requests[0]?.params).toEqual({
        [parameter]: 'V',
        language: '',
        version: '',
      });
    });

    it("sends the caller's Accept as given", async () => {
      const { handler, requests } = docs();
      await call(handler, form, 'V', {}, { accept: 'application/xml' });
      expect(requests[0]?.headers).toEqual({ Accept: 'application/xml' });
    });

    it.each([
      ['406', REFUSALS.notAcceptable],
      ['the HTML 500 of version=1', REFUSALS.versionPage],
    ])(
      'a %s comes back through analyse with its status and body',
      async (_label, refusal) => {
        const { handler, requests } = docs(refusal);
        const answer = await call(
          handler,
          form,
          'V',
          {},
          { analyse: analyseException },
        );
        expect(requests).toHaveLength(1);
        expect(answer.ok).toBe(false);
        if (answer.ok) return;
        expect(answer.getError().response?.status).toBe(refusal.status);
        expect(answer.getError().response?.data).toBe(refusal.data);
      },
    );
  });
});
