import type { IAdtEnhancementHost } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

const hosts = [
  ['getClass', 'className', '/sap/bc/adt/oo/classes'],
  ['getProgram', 'programName', '/sap/bc/adt/programs/programs'],
  ['getFunctionGroup', 'functionGroupName', '/sap/bc/adt/functions/groups'],
  ['getInclude', 'includeName', '/sap/bc/adt/programs/includes'],
] as const;

function fixture() {
  const makeAdtRequest = jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: '<enh:document/>',
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
          const { client, makeAdtRequest, setSessionType } = fixture();
          const answer = await (
            client[factory]() as IAdtEnhancementHost<
              Record<string, string>,
              string,
              string
            >
          )[member]({ [nameKey]: name });
          expect(answer.ok).toBe(true);
          if (answer.ok) {
            expect(answer.getResult().value).toBe('<enh:document/>');
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
