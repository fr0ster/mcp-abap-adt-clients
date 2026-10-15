import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAdtEnhancementHost,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

const hosts = [
  ['getClass', 'className', '/sap/bc/adt/oo/classes'],
  ['getProgram', 'programName', '/sap/bc/adt/programs/programs'],
  ['getFunctionGroup', 'functionGroupName', '/sap/bc/adt/functions/groups'],
  ['getInclude', 'includeName', '/sap/bc/adt/programs/includes'],
] as const;

// Verbatim E19 responses recorded on 2026-10-15; keep whitespace and base64 intact.
const recorded = (name: string) =>
  readFileSync(
    join(__dirname, '../../fixtures/enhancementHosts', name),
    'utf8',
  );
const elements = recorded('elements-empty-class-200.xml');
const options = recorded('options-zok_req_rep_test-200.xml');
const elementsContentType =
  'application/vnd.sap.adt.enhancements.v3+xml; charset=utf-8';
const optionsContentType =
  'application/vnd.sap.adt.enhancementoptions.v2+xml; charset=utf-8';

function fixture(data = elements, contentType = elementsContentType) {
  const makeAdtRequest = jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': contentType },
    data,
  }));
  const setSessionType = jest.fn();
  const connection = {
    makeAdtRequest,
    setSessionType,
  } as unknown as IAbapConnection;
  return { client: new AdtClient(connection), makeAdtRequest, setSessionType };
}

for (const [factory, nameKey, base] of hosts) {
  describe(factory, () => {
    for (const [name, encoded] of [
      ['ZHOST', 'zhost'],
      ['/ABC/ZCL_X', '%2Fabc%2Fzcl_x'],
    ]) {
      for (const [member, suffix, accept] of [
        [
          'readEnhancementElements',
          '/source/main/enhancements/elements',
          'application/vnd.sap.adt.enhancements.v3+xml',
        ],
        [
          'readEnhancementOptions',
          '/enhancements/options',
          'application/vnd.sap.adt.enhancementoptions.v2+xml',
        ],
      ] as const) {
        it(`${member}: ${name} is one stateless GET with the document strategy`, async () => {
          const body =
            member === 'readEnhancementElements' ? elements : options;
          const contentType =
            member === 'readEnhancementElements'
              ? elementsContentType
              : optionsContentType;
          const { client, makeAdtRequest, setSessionType } = fixture(
            body,
            contentType,
          );
          const answer = await (
            client[factory]() as IAdtEnhancementHost<
              Record<string, string>,
              string,
              string
            >
          )[member]({ [nameKey]: name });
          expect(answer.ok).toBe(true);
          if (answer.ok) {
            expect(answer.getResult().value).toBe(body);
          }
          expect(makeAdtRequest).toHaveBeenCalledTimes(1);
          expect(makeAdtRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              url: `${base}/${encoded}${suffix}`,
              method: 'GET',
              headers: { Accept: accept },
            }),
          );
          expect(setSessionType).not.toHaveBeenCalled();
        });
      }
    }
    it('elements context is a program name only for standalone includes', async () => {
      const { client, makeAdtRequest } = fixture();
      await (
        client[factory]() as IAdtEnhancementHost<
          Record<string, string>,
          string,
          string
        >
      ).readEnhancementElements(
        { [nameKey]: 'ZHOST' },
        { context: '/ABC/ZMAIN' },
      );
      const query =
        factory === 'getInclude'
          ? '?context=%2Fsap%2Fbc%2Fadt%2Fprograms%2Fprograms%2F%252Fabc%252Fzmain'
          : '';
      expect(makeAdtRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${base}/zhost/source/main/enhancements/elements${query}`,
        }),
      );
    });
  });
}

describe('recorded enhancement-host answers', () => {
  it('preserves SAPMV45A implementations and their base64 sources byte for byte', async () => {
    const body = recorded('elements-sapmv45a-200.xml');
    const { client } = fixture(body);
    const answer = await client.getProgram().readEnhancementElements({
      programName: 'SAPMV45A',
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected the recorded document');
    expect(answer.getResult().value).toBe(body);
  });

  for (const withAnalyse of [true, false]) {
    it(`answers the recorded 400 as a failure ${withAnalyse ? 'with' : 'without'} analyse`, async () => {
      const body = recorded('elements-missing-class-400.xml');
      const response = {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/xml' },
        data: body,
      };
      const { client, makeAdtRequest, setSessionType } = fixture();
      makeAdtRequest.mockRejectedValueOnce(
        Object.assign(new Error('Request failed with status code 400'), {
          response,
        }),
      );
      const analyse = jest.fn<ReturnType<IAnalyse>, Parameters<IAnalyse>>(
        (failure) => failure,
      );
      const answer = await client
        .getClass()
        .readEnhancementElements(
          { className: 'ZCL_DOES_NOT_EXIST_X' },
          withAnalyse ? { analyse } : undefined,
        );
      expect(answer.ok).toBe(false);
      if (answer.ok) throw new Error('expected the recorded refusal');
      expect(answer.getError().response).toBe(response);
      expect(answer.getError().response?.data).toBe(body);
      expect(body).toContain('<type id="EnhancementError"/>');
      expect(body).toContain('<entry key="T100KEY-ID">SEEF_BASE</entry>');
      expect(body).toContain('<entry key="T100KEY-NO">104</entry>');
      if (withAnalyse) {
        expect(analyse).toHaveBeenCalledTimes(1);
        expect(analyse).toHaveBeenCalledWith(expect.anything(), response);
        expect(analyse.mock.calls[0][1]).toBe(response);
      } else {
        expect(analyse).not.toHaveBeenCalled();
      }
      expect(makeAdtRequest).toHaveBeenCalledTimes(1);
      expect(makeAdtRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/sap/bc/adt/oo/classes/zcl_does_not_exist_x/source/main/enhancements/elements',
          method: 'GET',
          headers: { Accept: 'application/vnd.sap.adt.enhancements.v3+xml' },
        }),
      );
      expect(setSessionType).not.toHaveBeenCalled();
    });
  }
});
