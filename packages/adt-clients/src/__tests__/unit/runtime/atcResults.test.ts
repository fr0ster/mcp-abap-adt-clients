/**
 * ATC results by Display ID: `listResults` and `getResult` send the one GET
 * their endpoint takes and answer SAP's document through their slot. The
 * bodies have the shape measured on premise and on the cloud (2026-11-02) —
 * `atcresult:resultList` of `atcresult:result` — with the values replaced.
 */
import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import { atcDocuments } from '../../../runtime/atc/AdtAtc';
import { CriticalSectionConnection } from '../../helpers/recordingConnection';

const LIST =
  '<?xml version="1.0" encoding="utf-8"?><atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result"><atcresult:result><atcresult:displayId>D1</atcresult:displayId><atcresult:title>ZGATE</atcresult:title></atcresult:result></atcresult:resultList>';
const EMPTY =
  '<?xml version="1.0" encoding="utf-8"?><atcresult:resultList xmlns:atcresult="http://www.sap.com/adt/atc/result"/>';

const sentBy = async (
  call: (runtime: AdtRuntimeClient) => Promise<unknown>,
) => {
  const connection = new CriticalSectionConnection(() => LIST);
  await call(new AdtRuntimeClient(connection));
  return connection.sent;
};

describe('ATC listResults', () => {
  it('sends createdBy alone when nothing else is given', async () => {
    const sent = await sentBy((r) =>
      r.getAtc().listResults({ createdBy: '*' }),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.url).toBe('/sap/bc/adt/atc/results?createdBy=*');
    expect(sent[0]?.headers).toEqual({ Accept: 'application/xml' });
  });

  it('sends centralResult=true for centralOnly, and the ages given', async () => {
    const sent = await sentBy((r) =>
      r.getAtc().listResults({
        createdBy: 'SAPUSER01',
        centralOnly: true,
        ageMin: 0,
        ageMax: 30,
      }),
    );
    expect(sent[0]?.url).toBe(
      '/sap/bc/adt/atc/results?createdBy=SAPUSER01&centralResult=true&ageMin=0&ageMax=30',
    );
  });

  it('sends no centralResult for centralOnly: false', async () => {
    const sent = await sentBy((r) =>
      r.getAtc().listResults({ createdBy: '*', centralOnly: false }),
    );
    expect(sent[0]?.url).toBe('/sap/bc/adt/atc/results?createdBy=*');
  });

  for (const createdBy of ['', '   ']) {
    it(`refuses createdBy ${JSON.stringify(createdBy)} before any request`, async () => {
      const connection = new CriticalSectionConnection(() => LIST);
      await expect(
        new AdtRuntimeClient(connection).getAtc().listResults({ createdBy }),
      ).rejects.toMatchObject({ code: 'ADT_VALIDATION_FAILED' });
      expect(connection.sent).toHaveLength(0);
    });
  }

  for (const [label, body] of [
    ['a list', LIST],
    ['an empty list', EMPTY],
  ]) {
    it(`answers SAP's document as it came: ${label}`, async () => {
      const answer = await new AdtRuntimeClient(
        new CriticalSectionConnection(() => body),
      )
        .getAtc()
        .listResults({ createdBy: '*' });
      expect(answer.ok).toBe(true);
      if (answer.ok) expect(answer.getResult().value).toBe(body);
    });
  }
});

describe('ATC getResult', () => {
  for (const [displayId, encoded] of [
    ['E6AC99B2161F1FE1B5A1E9B68E5CD628', 'E6AC99B2161F1FE1B5A1E9B68E5CD628'],
    ['A/B C', 'A%2FB%20C'],
  ]) {
    it(`asks result ${displayId} by its encoded Display ID`, async () => {
      const sent = await sentBy((r) => r.getAtc().getResult(displayId));
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe('GET');
      expect(sent[0]?.url).toBe(`/sap/bc/adt/atc/results/${encoded}`);
      expect(sent[0]?.headers).toEqual({ Accept: 'application/xml' });
    });
  }

  it("answers SAP's document as it came", async () => {
    const answer = await new AdtRuntimeClient(
      new CriticalSectionConnection(() => LIST),
    )
      .getAtc()
      .getResult('D1');
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.getResult().value).toBe(LIST);
  });
});

describe('ATC results through a result set of the caller', () => {
  const resultList: IResultStrategy<'list'> = () => 'list';
  const result: IResultStrategy<'one'> = () => 'one';
  const atc = () =>
    new AdtRuntimeClient(new CriticalSectionConnection(() => LIST)).getAtc({
      ...atcDocuments,
      resultList,
      result,
    });

  it('reads the list with the resultList slot', async () => {
    const answer = await atc().listResults({ createdBy: '*' });
    if (!answer.ok) throw new Error('expected an answer');
    const value: 'list' = answer.getResult().value;
    expect(value).toBe('list');
  });

  it('reads one result with the result slot', async () => {
    const answer = await atc().getResult('D1');
    if (!answer.ok) throw new Error('expected an answer');
    const value: 'one' = answer.getResult().value;
    expect(value).toBe('one');
  });
});
