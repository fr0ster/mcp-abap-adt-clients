import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  ApplicationLog,
  applicationLogDocuments,
} from '../../../runtime/applicationLog/ApplicationLog';
import {
  connectionAnswering,
  NAME_CASES,
  quietLogger,
  REFUSALS,
} from './supportReadsHarness';

const OBJECTS = '/sap/bc/adt/applicationlog/objects';
const PROPERTIES =
  'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties';
const SOURCE = 'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source';

function applicationLog(answer?: { status: number; data: string }) {
  const { connection, requests } = connectionAnswering(answer);
  const log = new ApplicationLog(connection, {
    logger: quietLogger,
    results: applicationLogDocuments,
  });
  return { log, requests };
}

describe('ApplicationLog.getObject', () => {
  it.each(NAME_CASES)(
    '%j is addressed as one segment, %s',
    async (name, segment) => {
      const { log, requests } = applicationLog();
      await log.getObject(name);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe(`${OBJECTS}/${segment}`);
      expect(requests[0]?.method).toBe('GET');
    },
  );

  // Until 36.0.1 both reads sent `application/xml`, refused `406` (SADT_RESOURCE
  // 037). Measured on an on-premise system (2026-10-19): the properties answer
  // `200` to blues.v1+xml, the source `200` to application/json and `406` to
  // blues.v1+xml.
  it('sends blues.v1+xml and the properties relation by default, timeout 0, no parameter', async () => {
    const { log, requests } = applicationLog();
    await log.getObject('Z_LOG');
    expect(requests[0]?.headers).toEqual({
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
      'X-sap-adt-relation': PROPERTIES,
    });
    expect(requests[0]?.timeout).toBe(0);
    expect(requests[0]?.params).toEqual({});
  });

  it("sends the caller's Accept as given", async () => {
    const { log, requests } = applicationLog();
    await log.getObject('Z_LOG', { accept: 'text/html' });
    expect(requests[0]?.headers).toEqual({
      Accept: 'text/html',
      'X-sap-adt-relation': PROPERTIES,
    });
  });

  it('sends each option as its parameter, and no other', async () => {
    const { log, requests } = applicationLog();
    await log.getObject('Z_LOG', {
      corrNr: 'REQ',
      lockHandle: 'LH',
      version: 'inactive',
      accessMode: 'MODIFY',
      action: 'LOCK',
    });
    expect(requests[0]?.params).toEqual({
      corrNr: 'REQ',
      lockHandle: 'LH',
      version: 'inactive',
      accessMode: 'MODIFY',
      _action: 'LOCK',
    });
  });

  it.each([
    ['404', REFUSALS.notFound],
    ['406', REFUSALS.notAcceptable],
    ['the HTML 500 of a 21-character name', REFUSALS.overlongName],
  ])(
    'a %s comes back through analyse with its status and body',
    async (_label, refusal) => {
      const { log, requests } = applicationLog(refusal);
      const answer = await log.getObject('Z_LOG', {
        analyse: analyseException,
      });
      expect(requests).toHaveLength(1);
      expect(answer.ok).toBe(false);
      if (answer.ok) return;
      const error = answer.getError();
      expect(error.response?.status).toBe(refusal.status);
      expect(error.response?.data).toBe(refusal.data);
    },
  );
});

describe('ApplicationLog.getSource', () => {
  it.each(NAME_CASES)(
    '%j is addressed as one segment, %s',
    async (name, segment) => {
      const { log, requests } = applicationLog();
      await log.getSource(name);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe(`${OBJECTS}/${segment}/source/main`);
    },
  );

  it('sends application/json and the source relation by default, timeout 0, no parameter', async () => {
    const { log, requests } = applicationLog();
    await log.getSource('Z_LOG');
    expect(requests[0]?.headers).toEqual({
      Accept: 'application/json',
      'X-sap-adt-relation': SOURCE,
    });
    expect(requests[0]?.timeout).toBe(0);
    expect(requests[0]?.params).toEqual({});
  });

  it("sends the caller's Accept and each option, and no other parameter", async () => {
    const { log, requests } = applicationLog();
    await log.getSource('Z_LOG', {
      accept: 'text/html',
      corrNr: 'REQ',
      lockHandle: 'LH',
      version: 'active',
    });
    expect(requests[0]?.headers).toEqual({
      Accept: 'text/html',
      'X-sap-adt-relation': SOURCE,
    });
    expect(requests[0]?.params).toEqual({
      corrNr: 'REQ',
      lockHandle: 'LH',
      version: 'active',
    });
  });

  it.each([
    ['404', REFUSALS.notFound],
    ['406', REFUSALS.notAcceptable],
    ['the HTML 500 of a 21-character name', REFUSALS.overlongName],
  ])(
    'a %s comes back through analyse with its status and body',
    async (_label, refusal) => {
      const { log, requests } = applicationLog(refusal);
      const answer = await log.getSource('Z_LOG', {
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

describe('ApplicationLog.validateName', () => {
  it('reads the validation address with the name as a parameter', async () => {
    const { log, requests } = applicationLog();
    await log.validateName('Z_LOG');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${OBJECTS}/validation`);
    expect(requests[0]?.params).toEqual({ objectName: 'Z_LOG' });
  });
});
