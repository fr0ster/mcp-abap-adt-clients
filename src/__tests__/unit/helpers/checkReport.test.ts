/**
 * A refusal of `check` fails the test, in both shapes it arrives in: a
 * returned failure, and an exception document inside an HTTP 200. Neither is
 * read as "not available here" — that is the configuration's to say.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import {
  exceptionDocumentIn,
  expectCheckReport,
} from '../../helpers/checkReport';

const ok = (value: unknown): IAdtResponse<unknown> =>
  ({ ok: true, getResult: () => ({ value }) }) as IAdtResponse<unknown>;
const refused = (message: string, status: number): IAdtResponse<unknown> =>
  ({
    ok: false,
    getError: () => ({ origin: 'refusal', message, response: { status } }),
  }) as unknown as IAdtResponse<unknown>;

const NO_ACCESS = `<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization for S_ABPLNGVS</message><localizedMessage lang="EN">No authorization for S_ABPLNGVS</localizedMessage></exc:exception>`;

const REPORT = `<?xml version="1.0" encoding="utf-8"?><chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun"><chkrun:checkReport chkrun:status="processed" chkrun:statusText="Object ZCL_X has been checked"/></chkrun:checkRunReports>`;

describe('expectCheckReport', () => {
  it('answers the report of a check that ran', () => {
    expect(expectCheckReport(ok(REPORT), 'check')).toBe(REPORT);
  });

  it('fails on an authorization refusal answered as a failure, with what SAP said', () => {
    expect(() =>
      expectCheckReport(
        refused('No authorization for S_ABPLNGVS', 403),
        'check the stored class',
      ),
    ).toThrow(
      'check the stored class failed [refusal]: No authorization for S_ABPLNGVS',
    );
  });

  it('fails on a refusal document inside a 200, with what SAP said', () => {
    expect(() =>
      expectCheckReport(ok(NO_ACCESS), 'check the stored class'),
    ).toThrow(
      'check the stored class was refused inside a 200: ExceptionResourceNoAccess: No authorization for S_ABPLNGVS',
    );
  });

  it('reads no exception into a report or into text that is not XML', () => {
    expect(exceptionDocumentIn(REPORT)).toBeUndefined();
    expect(exceptionDocumentIn('an exception, in words')).toBeUndefined();
  });
});

describe('checkRun.test.ts', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../integration/shared/checkRun.test.ts'),
    'utf8',
  );

  it('reads every check answer through expectCheckReport and skips none', () => {
    expect(source.match(/expectCheckReport\(answer,/g)?.length).toBe(3);
    expect(source).not.toMatch(/logTestSkip|isLanguageVersionRefusal/);
    expect(source).not.toMatch(/ExceptionResourceNoAccess/);
  });
});
