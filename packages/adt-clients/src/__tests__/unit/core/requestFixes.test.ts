/**
 * Requests that sent something other than what the caller or SAP means — each
 * pinned by what goes on the wire.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAuthorizationField } from '../../../core/authorizationField/AdtAuthorizationField';
import { authorizationFieldDocuments } from '../../../core/authorizationField/types';
import { AdtBehaviorDefinition } from '../../../core/behaviorDefinition/AdtBehaviorDefinition';
import { behaviorDefinitionDocuments } from '../../../core/behaviorDefinition/types';
import { AdtBehaviorImplementation } from '../../../core/behaviorImplementation/AdtBehaviorImplementation';
import { classDocuments } from '../../../core/class/types';
import { AdtDataElement } from '../../../core/dataElement/AdtDataElement';
import { dataElementDocuments } from '../../../core/dataElement/types';
import { AdtDomain } from '../../../core/domain/AdtDomain';
import { domainDocuments } from '../../../core/domain/types';
import { AdtFunctionModule } from '../../../core/functionModule/AdtFunctionModule';
import { functionModuleDocuments } from '../../../core/functionModule/types';
import { AdtProgram } from '../../../core/program/AdtProgram';
import { programDocuments } from '../../../core/program/types';
import {
  getUnitTestRunResult,
  getUnitTestRunStatus,
} from '../../../core/shared/abapUnit';
import { AdtTable } from '../../../core/table/AdtTable';
import { tableDocuments } from '../../../core/table/types';
import { createTransport } from '../../../core/transport/create';
import { getTraceStatements } from '../../../runtime/traces/profiler';
import { TEST_HEADERS } from '../../helpers/adtHeaders';
import {
  CriticalSectionConnection,
  RecordingConnection,
} from '../../helpers/recordingConnection';
import { attributeValues } from './createBodyCases';

/** The one request a call sent. */
function only(connection: RecordingConnection): IAbapRequestOptions {
  expect(connection.sent).toHaveLength(1);
  const request = connection.sent[0];
  if (request === undefined) throw new Error('nothing sent');
  return request;
}

const bodyOf = (request: IAbapRequestOptions): string =>
  typeof request.data === 'string' ? request.data : '';

/** One attribute of the first element that carries it, as written. */
function attribute(body: string, name: string): string | undefined {
  const at = body.indexOf(` ${name}="`);
  if (at === -1) return undefined;
  const start = at + name.length + 3;
  return body.slice(start, body.indexOf('"', start));
}

describe('CreateTransport: the request type per kind', () => {
  // DD07T of domain TRFUNCTION, read on premise: K = Workbench Request,
  // W = Customizing Request, T = Transport of Copies. A type T request with
  // target LOCAL was refused (SCTS_ADT_MSG 009); a type W one answered 201.
  it.each([
    ['customizing', 'W'],
    ['workbench', 'K'],
    [undefined, 'K'],
  ])('%s is tm:type="%s"', async (kind, code) => {
    const connection = new RecordingConnection();
    await createTransport(connection, TEST_HEADERS, {
      transport_type: kind,
      description: 'd',
      owner: 'DEVELOPER',
    });
    expect(attribute(bodyOf(only(connection)), 'tm:type')).toBe(code);
  });

  it('escapes the description it writes', async () => {
    const connection = new RecordingConnection();
    await createTransport(connection, TEST_HEADERS, {
      description: `R&D <"x"> 'y'`,
      owner: 'DEVELOPER',
    });
    expect(attributeValues(bodyOf(only(connection)))).toContain(
      `R&D <"x"> 'y'`,
    );
  });
});

describe('Profiler statements: the drill-down threshold as given', () => {
  it('sends 0.1 as 0.1', async () => {
    const connection = new RecordingConnection();
    await getTraceStatements(connection, 'ABCDEF1234567890', {
      autoDrillDownThreshold: 0.1,
    });
    const url = new URL(only(connection).url, 'http://host');
    expect(url.searchParams.get('autoDrillDownThreshold')).toBe('0.1');
  });
});

describe('ABAP Unit: the run id is one path segment', () => {
  it.each([
    ['a/b', 'a%2Fb'],
    ['a?b', 'a%3Fb'],
    ['a#b', 'a%23b'],
    ['50%', '50%25'],
    ['../x', '..%2Fx'],
  ])('%s', async (runId, encoded) => {
    const status = new RecordingConnection();
    await getUnitTestRunStatus(status, runId, false);
    expect(only(status).url).toBe(`/sap/bc/adt/abapunit/runs/${encoded}`);

    const result = new RecordingConnection();
    await getUnitTestRunResult(result, runId);
    expect(only(result).url).toBe(`/sap/bc/adt/abapunit/results/${encoded}`);
  });
});

describe('ABAP Unit: a run id that is a path step is refused', () => {
  it.each(['.', '..'])('%s: no status request', async (runId) => {
    const connection = new RecordingConnection();
    await expect(
      getUnitTestRunStatus(connection, runId, false),
    ).rejects.toThrow(
      `An ABAP Unit run id of "${runId}" is a path step, not a run: nothing was sent.`,
    );
    expect(connection.sent).toHaveLength(0);
  });

  it.each(['.', '..'])('%s: no result request', async (runId) => {
    const connection = new RecordingConnection();
    await expect(getUnitTestRunResult(connection, runId)).rejects.toThrow(
      `An ABAP Unit run id of "${runId}" is a path step, not a run: nothing was sent.`,
    );
    expect(connection.sent).toHaveLength(0);
  });
});

describe('Validation sends no parameter it was not given', () => {
  const noUndefined = (request: IAbapRequestOptions): void => {
    const query = new URL(request.url, 'http://host').searchParams;
    for (const [, value] of query) expect(value).not.toBe('undefined');
  };

  it('domain', async () => {
    const connection = new RecordingConnection();
    await new AdtDomain(connection, { results: domainDocuments }).validate({
      domainName: 'ZDOM',
    });
    const request = only(connection);
    noUndefined(request);
    expect(
      new URL(request.url, 'http://host').searchParams.has('description'),
    ).toBe(false);
  });

  it('data element', async () => {
    const connection = new RecordingConnection();
    await new AdtDataElement(connection, {
      results: dataElementDocuments,
    }).validate({ dataElementName: 'ZDTEL' });
    const request = only(connection);
    noUndefined(request);
    expect(
      new URL(request.url, 'http://host').searchParams.has('description'),
    ).toBe(false);
  });

  it('authorization field', async () => {
    const connection = new RecordingConnection();
    await new AdtAuthorizationField(connection, {
      results: authorizationFieldDocuments,
    }).validate({ authorizationFieldName: 'ZAUTH' });
    const request = only(connection);
    noUndefined(request);
    expect(
      new URL(request.url, 'http://host').searchParams.has('description'),
    ).toBe(false);
  });

  it('behaviour definition', async () => {
    const connection = new RecordingConnection();
    await new AdtBehaviorDefinition(connection, {
      results: behaviorDefinitionDocuments,
    }).validate({ name: 'ZBDEF' });
    noUndefined(only(connection));
  });

  it('function module: an explicitly empty description goes out as given', async () => {
    const connection = new RecordingConnection();
    await new AdtFunctionModule(connection, {
      results: functionModuleDocuments,
    }).validate({
      functionGroupName: 'ZFG',
      functionModuleName: 'Z_FM',
      description: '',
    });
    const query = new URL(only(connection).url, 'http://host').searchParams;
    expect(query.has('description')).toBe(true);
    expect(query.get('description')).toBe('');
  });

  it('function module: the description SAP requires goes out', async () => {
    // Measured: the function-module validation answers 400 without a
    // description, so the member's config requires one.
    const connection = new RecordingConnection();
    await new AdtFunctionModule(connection, {
      results: functionModuleDocuments,
    }).validate({
      functionGroupName: 'ZFG',
      functionModuleName: 'Z_FM',
      description: 'd',
    });
    const request = only(connection);
    expect(
      new URL(request.url, 'http://host').searchParams.get('description'),
    ).toBe('d');
  });
});

describe('Table check sends the given source', () => {
  it('as the structure check does: in the check run, base64', async () => {
    const connection = new RecordingConnection();
    const source =
      "@EndUserText.label : 't'\ndefine table ztab { key f : abap.char(1); }";
    await new AdtTable(connection, { results: tableDocuments }).check(
      { tableName: 'ZTAB', source },
      'inactive',
      { headers: TEST_HEADERS },
    );
    const body = bodyOf(only(connection));
    expect(body).toContain(
      `<chkrun:content>${Buffer.from(source, 'utf-8').toString('base64')}</chkrun:content>`,
    );
  });
});

describe('Program create writes no program type', () => {
  it('sends no program:programType', async () => {
    // SAP ignores it on create; a create without it answered 200 and read
    // back `executableProgram` (measured on premise).
    const connection = new RecordingConnection();
    await new AdtProgram(connection, { results: programDocuments }).create(
      { programName: 'ZPROG', packageName: 'ZPKG', description: 'd' },
      { headers: TEST_HEADERS },
    );
    expect(bodyOf(only(connection))).not.toContain('programType');
  });
});

describe('Behaviour pool: the implementations include', () => {
  it('reads includes/implementations, one GET, with the version asked', async () => {
    const connection = new RecordingConnection();
    await new AdtBehaviorImplementation(connection, {
      results: classDocuments,
    }).readImplementations({ className: 'ZBP_X' }, 'inactive');
    const request = only(connection);
    expect(request.method).toBe('GET');
    expect(request.url).toBe(
      '/sap/bc/adt/oo/classes/zbp_x/includes/implementations?version=inactive',
    );
    expect(request.headers?.Accept).toBe('text/plain');
  });

  it('answers the include as it came: a captured CCIMP with its handler class', async () => {
    // A standard pool's implementations include, read on premise.
    const ccimp = readFileSync(
      join(
        __dirname,
        '../../../../corpus/adt/answers/read-behavior-pool-implementations--01-read-source.body.txt',
      ),
      'utf-8',
    );
    const connection = new CriticalSectionConnection(() => ccimp);
    const answer = await new AdtBehaviorImplementation(connection, {
      results: classDocuments,
    }).readImplementations({ className: 'BP_A_COSTCENTER' });
    expect(answer.ok).toBe(true);
    const text = answer.ok ? answer.getResult().value : '';
    expect(text).toBe(ccimp);
    expect(text).toContain('CLASS lhc_costcenter DEFINITION');
  });
});
