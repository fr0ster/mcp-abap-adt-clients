import type { IAdtError } from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_NO_FAILURE,
  AdtObjectErrorCodes,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  analyseCdsTestDoubles,
  analyseMessageClassMessage,
  analysePublication,
  analyseUnitTestStart,
  analyseUnsupportedStatus,
} from '../refusals/analyse';
import { unitTestRunId } from '../results/unitTest';
import { stepsOf } from './corpus';

/**
 * The verdicts adt-clients applied on its own until it stopped reading answers
 * for its callers — each now a strategy a caller passes. Every one is asserted
 * both ways: what it refuses, and what it lets through.
 */
const answer = (data: string, extra: Partial<IAdtWireResponse> = {}) =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    ...extra,
  }) as IAdtWireResponse;

const severity = (sev: string, short = '') =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>${sev}</SEVERITY><SHORT_TEXT>${short}</SHORT_TEXT></DATA></asx:values></asx:abap>`;

describe('analysePublication', () => {
  it('lets OK through, and silence too', () => {
    expect(
      analysePublication(ADT_NO_FAILURE, answer(severity('OK', 'published'))),
    ).toBe(ADT_NO_FAILURE);
    expect(analysePublication(ADT_NO_FAILURE, answer(''))).toBe(ADT_NO_FAILURE);
  });
  it('refuses any other severity, quoting the short text', () => {
    const failure = analysePublication(
      ADT_NO_FAILURE,
      answer(severity('ERROR', 'no service')),
    );
    expect(failure).not.toBe(ADT_NO_FAILURE);
    expect((failure as IAdtError).message).toContain('no service');
  });
});

describe('analyseCdsTestDoubles', () => {
  it('lets OK through', () => {
    expect(analyseCdsTestDoubles(ADT_NO_FAILURE, answer(severity('OK')))).toBe(
      ADT_NO_FAILURE,
    );
  });
  it('refuses anything else, including no severity at all', () => {
    expect(
      analyseCdsTestDoubles(
        ADT_NO_FAILURE,
        answer(severity('ERROR', 'not doubleable')),
      ),
    ).not.toBe(ADT_NO_FAILURE);
    expect(analyseCdsTestDoubles(ADT_NO_FAILURE, answer(''))).not.toBe(
      ADT_NO_FAILURE,
    );
  });
});

describe('analyseMessageClassMessage', () => {
  const cls = `<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZMSG"><mc:messages mc:msgno="001" mc:msgtext="one"/><mc:messages mc:msgno="002" mc:msgtext="two"/></mc:messageClass>`;
  it('lets a held message through', () => {
    expect(analyseMessageClassMessage('002')(ADT_NO_FAILURE, answer(cls))).toBe(
      ADT_NO_FAILURE,
    );
  });
  it('refuses one the class does not hold, as OBJECT_NOT_FOUND', () => {
    const failure = analyseMessageClassMessage('003')(
      ADT_NO_FAILURE,
      answer(cls),
    );
    expect(failure).not.toBe(ADT_NO_FAILURE);
    expect((failure as IAdtError).code).toBe(
      AdtObjectErrorCodes.OBJECT_NOT_FOUND,
    );
    expect((failure as IAdtError).message).toContain('003');
  });
});

describe('analyseUnitTestStart', () => {
  it('lets the recorded start through: 201, empty body, the id in Location', () => {
    const started = stepsOf('unittest-run-passing')[0];
    expect(started.status).toBe(201);
    expect(analyseUnitTestStart(ADT_NO_FAILURE, started)).toBe(ADT_NO_FAILURE);
  });
  it('refuses an answer carrying no run id, as CREATE_FAILED', () => {
    const failure = analyseUnitTestStart(
      ADT_NO_FAILURE,
      answer('', { status: 201 }),
    );
    expect((failure as IAdtError).code).toBe(AdtObjectErrorCodes.CREATE_FAILED);
  });
});

describe('analyseUnsupportedStatus', () => {
  const notOffered = analyseUnsupportedStatus(
    [404, 405, 501],
    'scalar-function name validation',
  );
  const failed = (status: number): IAdtError => ({
    origin: 'refusal',
    message: 'x',
    response: answer('', { status }),
  });
  it('renames a listed status UNSUPPORTED_OPERATION', () => {
    const renamed = notOffered(failed(405)) as IAdtError;
    expect(renamed.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(renamed.message).toContain('HTTP 405');
  });
  it('passes any other failure, and no failure, through as they came', () => {
    const other = failed(400);
    expect(notOffered(other)).toBe(other);
    expect(notOffered(ADT_NO_FAILURE)).toBe(ADT_NO_FAILURE);
  });
});

describe('unitTestRunId', () => {
  it('reads the id out of the recorded start, from Location', () => {
    const started = stepsOf('unittest-run-passing')[0];
    const id = unitTestRunId(started);
    expect(id).not.toBe('');
    expect(String(started.headers?.location)).toContain(`/runs/${id}`);
  });
  it('answers empty rather than a guess when there is no id', () => {
    expect(unitTestRunId(answer('', { status: 201 }))).toBe('');
  });
});
