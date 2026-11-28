/**
 * What the support-read members' unit tests share (fr0ster/mcp-abap-adt#404):
 * a connection double that records each request and answers one recorded
 * exchange, the recorded refusals of the corpus, and the name cases every
 * definition member is asked with.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');

/** A recorded exchange's status and body, by its step's file stem. */
export function recorded(step: string): { status: number; data: string } {
  const sidecar = JSON.parse(
    readFileSync(join(ANSWERS, `${step}.json`), 'utf-8'),
  ) as { response: { status: number; bodyFile: string } };
  return {
    status: sidecar.response.status,
    data: readFileSync(join(ANSWERS, sidecar.response.bodyFile), 'utf-8'),
  };
}

/** The refusals each member is asked to hand back through `analyse`. */
export const REFUSALS = {
  notFound: recorded(
    'refusal-application-job-catalog-absent-s4-2025--01-object',
  ),
  notAcceptable: {
    status: 406,
    data: '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNotAcceptable"/><message lang="EN">The message content is not acceptable.</message><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">044</entry></properties></exc:exception>',
  },
  versionPage: recorded(
    'refusal-keyword-documentation-version-1-s4-2025--01-topic',
  ),
  overlongName: recorded(
    'refusal-application-log-name-21-abap-cloud--01-object',
  ),
} as const;

/** The name cases of a definition read, each with the segment `seg()` makes of it. */
export const NAME_CASES: ReadonlyArray<readonly [string, string]> = [
  ['Z_UPPER', 'z_upper'],
  ['z_lower', 'z_lower'],
  ['Z_Mixed', 'z_mixed'],
  ['/NS/NAME', '%2Fns%2Fname'],
  [' Z IN NER ', '%20z%20in%20ner%20'],
  ['ZZ_NO_SUCH_OBJECT_XYZ', 'zz_no_such_object_xyz'],
  ['Z'.repeat(41), 'z'.repeat(41)],
];

/** A connection double: records every request, answers `answer` or rejects as the connection does. */
export function connectionAnswering(
  answer: { status: number; data: string } = { status: 200, data: '' },
): { connection: IAbapConnection; requests: IAbapRequestOptions[] } {
  const requests: IAbapRequestOptions[] = [];
  const connection = {
    makeAdtRequest: jest.fn(async (options: IAbapRequestOptions) => {
      requests.push(options);
      const response = { ...answer, statusText: '', headers: {} };
      if (answer.status >= 200 && answer.status < 300) return response;
      throw Object.assign(
        new Error(`Request failed with status code ${answer.status}`),
        { response },
      );
    }),
  } as unknown as IAbapConnection;
  return { connection, requests };
}

/** A logger that writes nothing. */
export const quietLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
