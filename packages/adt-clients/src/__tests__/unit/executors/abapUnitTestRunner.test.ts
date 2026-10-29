/**
 * The generic ABAP Unit runner's requests: an object target and a package
 * target go to `POST /abapunit/runs` (`osl:flatObjectSet` with one
 * `osl:object`, `osl:packageSet` with one `osl:package`), a URI run to
 * `POST /abapunit/testruns` with the caller's headers; status and result by
 * the run id, as every runner asks them.
 */

import type {
  AbapUnitRunObjectType,
  IAbapUnitRunner,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import { AbapUnitTestRunner } from '../../../executors/abapUnitTestRunner';
import { ClassTestRunner } from '../../../executors/class/ClassTestRunner';
import {
  abapUnitTestRunnerDocuments,
  classTestRunnerDocuments,
} from '../../../index.executors';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** A `/runs` document with the default options and the given object set. */
function runDocument(title: string, objectSet: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:osl="http://www.sap.com/api/osl" title="${title}" context="MCP ABAP ADT Client">
  <aunit:options>
    <aunit:scope ownTests="true" foreignTests="false" addForeignTestsAsPreview="true"/>
    <aunit:riskLevel harmless="true" dangerous="true" critical="true"/>
    <aunit:duration short="true" medium="true" long="true"/>
  </aunit:options>
${objectSet}
</aunit:run>`;
}

/** The `/testruns` configuration for the URIs with no option given but headers. */
function testRunsDocument(uris: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false" appendAssignedTestsPreview="true"/>
    <testRiskLevels harmless="true" dangerous="true" critical="true"/>
    <testDurations short="true" medium="true" long="true"/>
    <withNavigationUri enabled="true"/>
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
${uris.map((uri) => `        <adtcore:objectReference adtcore:uri="${uri}"/>`).join('\n')}
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;
}

const RUNS = {
  url: '/sap/bc/adt/abapunit/runs',
  method: 'POST',
  timeout: 0,
  headers: {
    'Content-Type': 'application/vnd.sap.adt.api.abapunit.run.v2+xml',
  },
};

describe('AbapUnitTestRunner', () => {
  it('an object target: one osl:object in an osl:flatObjectSet, the type as given', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunner(
      connection,
      undefined,
      abapUnitTestRunnerDocuments,
    );

    await runner.run({ kind: 'object', name: 'zcl_tested', type: 'CLAS/OC' });

    expect(connection.sent).toEqual([
      {
        ...RUNS,
        data: runDocument(
          'ZCL_TESTED',
          `  <osl:objectSet xsi:type="osl:flatObjectSet">
    <osl:object name="ZCL_TESTED" type="CLAS/OC"/>
  </osl:objectSet>`,
        ),
      },
    ]);
  });

  it('an object target sends the body the class runner sends for CLAS, byte for byte', async () => {
    const generic = new RecordingConnection();
    const perObject = new RecordingConnection();

    await new AbapUnitTestRunner(
      generic,
      undefined,
      abapUnitTestRunnerDocuments,
    ).run({
      kind: 'object',
      name: 'ZCL_TESTED',
      type: 'CLAS',
    });
    await new ClassTestRunner(
      perObject,
      undefined,
      classTestRunnerDocuments,
    ).run('ZCL_TESTED');

    expect(generic.sent).toEqual(perObject.sent);
  });

  it("a CDS view's assigned tests: DDLS/DF with the scope's foreignTests", async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunner(
      connection,
      undefined,
      abapUnitTestRunnerDocuments,
    );

    await runner.run(
      { kind: 'object', name: 'ZI_VIEW', type: 'DDLS/DF' },
      { scope: { ownTests: false, foreignTests: true } },
    );

    expect(String(connection.sent[0]?.data)).toContain(
      '<aunit:scope ownTests="false" foreignTests="true" addForeignTestsAsPreview="true"/>',
    );
    expect(String(connection.sent[0]?.data)).toContain(
      '<osl:object name="ZI_VIEW" type="DDLS/DF"/>',
    );
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])(
    'a package target with includeSubpackages %s: one osl:package in an osl:packageSet',
    async (includeSubpackages, attribute) => {
      const connection = new RecordingConnection();
      const runner = new AbapUnitTestRunner(
        connection,
        undefined,
        abapUnitTestRunnerDocuments,
      );

      await runner.run({
        kind: 'package',
        name: '$zac_pkg',
        includeSubpackages,
      });

      expect(connection.sent).toEqual([
        {
          ...RUNS,
          data: runDocument(
            '$ZAC_PKG',
            `  <osl:objectSet xsi:type="osl:packageSet">
    <osl:package name="$ZAC_PKG" includeSubpackages="${attribute}"/>
  </osl:objectSet>`,
          ),
        },
      ]);
    },
  );

  it('a URI run: one POST to /testruns with the headers as given and <options>', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunner(
      connection,
      undefined,
      abapUnitTestRunnerDocuments,
    );
    const uris = [
      '/sap/bc/adt/oo/classes/zcl_tested',
      '/sap/bc/adt/programs/programs/zr_report',
    ] as const;

    await runner.runSync(uris, {
      headers: {
        accept: 'application/xml',
        contentType: 'application/vnd.sap.adt.abapunit.testruns.config.v4+xml',
      },
    });

    expect(connection.sent).toEqual([
      {
        url: '/sap/bc/adt/abapunit/testruns',
        method: 'POST',
        timeout: 0,
        data: testRunsDocument(uris),
        headers: {
          Accept: 'application/xml',
          'Content-Type':
            'application/vnd.sap.adt.abapunit.testruns.config.v4+xml',
        },
      },
    ]);
  });

  it('asks about a run by its id', async () => {
    const connection = new RecordingConnection();
    const runner = new AbapUnitTestRunner(
      connection,
      undefined,
      abapUnitTestRunnerDocuments,
    );

    await runner.getStatus('0CC47A-RUN', false);
    await runner.getResult('0CC47A-RUN');

    expect(connection.sent.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /sap/bc/adt/abapunit/runs/0CC47A-RUN',
      'GET /sap/bc/adt/abapunit/results/0CC47A-RUN',
    ]);
  });

  it('is what AdtExecutor hands out, as the contract declares it', () => {
    const runner: IAbapUnitRunner<string, string, string> = new AdtExecutor(
      new RecordingConnection(),
    ).getAbapUnitTestRunner();

    expect(runner).toBeInstanceOf(AbapUnitTestRunner);
  });

  it('takes only the registry run types, and a package only as a package target', () => {
    const runner = new AbapUnitTestRunner(
      new RecordingConnection(),
      undefined,
      abapUnitTestRunnerDocuments,
    );
    const type: AbapUnitRunObjectType = 'FUGR/FF';
    void runner.run({ kind: 'object', name: 'Z_FM', type });
    // @ts-expect-error — not a run type of the registry
    void runner.run({ kind: 'object', name: 'ZCL', type: 'CLAS/OM' });
    // @ts-expect-error — a package carries no type
    void runner.run({ kind: 'package', name: '$ZAC', type: 'DEVC/K' });
    // @ts-expect-error — a URI run names at least one URI
    void runner.runSync([], {
      headers: { accept: 'application/xml', contentType: 'application/xml' },
    });
    expect(true).toBe(true);
  });
});
