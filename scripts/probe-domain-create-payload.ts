/**
 * Can a domain be born with its type, or must it always be filled in afterwards?
 *
 * **Why it mattered.** `AdtDomain.create` used to accept `datatype`, `length`,
 * `decimals`, `conversion_exit`, `lowercase`, `sign_exists`, `value_table` and
 * `fixed_values`, forward all eight to `createDomain`, and `createDomain` read
 * none of them: its POST carries the description, the language and the package
 * reference. So a caller who named a type got a domain with `<doma:datatype/>`
 * empty — an object that cannot be activated until somebody types the data
 * type in by hand. The contract said the parameters were honoured and the wire
 * said they were not, which is the worst of the three states.
 *
 * Those eight fields are gone from the parameter type now, so the compiler
 * refuses them rather than the server ignoring them. This probe stays as the
 * measurement that says what the removal was for, and [A] below still shows
 * what a create alone produces.
 *
 * Fixing it goes one of two ways, and only the server can say which:
 *
 * - if the POST accepts a full `doma:content`, the parameters should be made
 *   to work and the domain is complete in one request;
 * - if it does not, they should be removed, because a parameter that cannot be
 *   honoured is a lie the compiler helps tell.
 *
 * **The method.** Two domains, side by side:
 *
 * - **A** is created the way the library creates one today, then activated. If
 *   a type-less domain cannot be activated, its refusal is printed here in the
 *   server's own words — the same wall a person hits before editing the type in.
 * - **B** is created with the type in the POST body. Reading it back says
 *   whether the server kept it, and activating says whether that was enough.
 *
 * Both are deleted at the end, whatever happened. Every exchange is printed
 * whole: status, headers, body.
 *
 *   npx ts-node scripts/probe-domain-create-payload.ts [PACKAGE] [TRANSPORT]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { activateDomain } from '../src/core/domain/activation';
import { create as createDomain } from '../src/core/domain/create';
import { deleteDomain } from '../src/core/domain/delete';
import { getDomain } from '../src/core/domain/read';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const say = (line = ''): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

function report(what: string, wire: IAdtWireResponse, ms?: number): void {
  say(`--- ${what}${ms === undefined ? '' : ` (${ms}ms)`}`);
  say(`    status: ${wire.status} ${wire.statusText ?? ''}`.trimEnd());
  const body = typeof wire.data === 'string' ? wire.data : String(wire.data);
  say(`    body (${body.length} chars):`);
  say(body === '' ? '    <empty>' : body);
  say();
}

function reportFailure(what: string, error: unknown): void {
  const carried = error as { response?: IAdtWireResponse; message?: string };
  say(`--- ${what} — THREW: ${carried?.message ?? String(error)}`);
  if (carried?.response)
    report(`${what} — the answer it carried`, carried.response);
  say();
}

/** What the document says its type is, which is the whole question. */
function typeOf(xml: string): string {
  const datatype =
    /<doma:datatype>([^<]*)<\/doma:datatype>/.exec(xml)?.[1] ??
    (/<doma:datatype\s*\/>/.test(xml) ? '(empty)' : '(absent)');
  const length =
    /<doma:length>([^<]*)<\/doma:length>/.exec(xml)?.[1] ?? '(absent)';
  return `datatype=${datatype}, length=${length}`;
}

/** A create body carrying the type, which the library's own create does not send. */
function bodyWithType(
  name: string,
  packageName: string,
  datatype: string,
  length: number,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="Probe: type in the create body" adtcore:language="EN" adtcore:name="${name}" adtcore:type="DOMA/DD" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="${packageName}"/>
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>${datatype}</doma:datatype>
      <doma:length>${String(length).padStart(6, '0')}</doma:length>
      <doma:decimals>000000</doma:decimals>
    </doma:typeInformation>
  </doma:content>
</doma:domain>`;
}

async function removeIt(
  connection: IAbapConnection,
  name: string,
  transportRequest: string,
): Promise<void> {
  try {
    const exists = await getDomain(connection, name);
    if (String(exists.data ?? '').trim() === '') {
      say(`[cleanup] ${name}: nothing there`);
      return;
    }
  } catch {
    say(`[cleanup] ${name}: nothing there`);
    return;
  }
  try {
    const wire = await deleteDomain(connection, {
      domain_name: name,
      transport_request: transportRequest || undefined,
    });
    say(`[cleanup] ${name}: delete answered ${wire.status}`);
  } catch (error) {
    say(`[cleanup] ${name}: delete threw — ${(error as Error).message}`);
  }
}

async function main(): Promise<void> {
  const [packageArg, transportArg] = process.argv.slice(2);
  const packageName = packageArg || process.env.SAP_PACKAGE || 'ZADT_BLD_PKG03';
  const transportRequest = transportArg || process.env.SAP_TRANSPORT || '';
  const A = 'ZAC_DOMPAY_A';
  const B = 'ZAC_DOMPAY_B';

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);

  try {
    say(`probe-domain-create-payload — ${A} and ${B} in ${packageName}`);
    say();

    // Start from nothing, so what is measured is a create and not a leftover.
    await removeIt(connection, A, transportRequest);
    await removeIt(connection, B, transportRequest);
    say();

    say(`[A] created the way the library creates one — no type in the POST`);
    try {
      const started = Date.now();
      report(
        'POST /sap/bc/adt/ddic/domains',
        await createDomain(connection, {
          domain_name: A,
          package_name: packageName,
          description: 'Probe: no type in the create body',
          transport_request: transportRequest || undefined,
          // `datatype: 'CHAR', length: 10` used to be passed here, named and
          // not sent. They no longer compile: the fields left the parameter
          // type, which is what this probe measured the need for. What the
          // create posts is what is left, and [A] below is what that produces.
        }),
        Date.now() - started,
      );
    } catch (error) {
      reportFailure('POST /sap/bc/adt/ddic/domains', error);
    }

    const readA = await getDomain(connection, A);
    report(`GET /sap/bc/adt/ddic/domains/${A.toLowerCase()}`, readA);
    say(`[A] what the server kept: ${typeOf(String(readA.data ?? ''))}`);
    say();

    say('[A] activate it');
    try {
      const started = Date.now();
      report(
        'POST /sap/bc/adt/activation (A)',
        await activateDomain(connection, A),
        Date.now() - started,
      );
    } catch (error) {
      reportFailure('POST /sap/bc/adt/activation (A)', error);
    }

    say(`[B] created with the type IN the POST body`);
    try {
      const started = Date.now();
      const wire = await connection.makeAdtRequest({
        url: `/sap/bc/adt/ddic/domains${transportRequest ? `?corrNr=${transportRequest}` : ''}`,
        method: 'POST',
        timeout: 60000,
        data: bodyWithType(B, packageName, 'CHAR', 10),
        headers: {
          Accept: 'application/vnd.sap.adt.domains.v2+xml',
          'Content-Type': 'application/vnd.sap.adt.domains.v2+xml',
        },
      });
      report(
        'POST /sap/bc/adt/ddic/domains (with content)',
        wire,
        Date.now() - started,
      );
    } catch (error) {
      reportFailure('POST /sap/bc/adt/ddic/domains (with content)', error);
    }

    const readB = await getDomain(connection, B);
    report(`GET /sap/bc/adt/ddic/domains/${B.toLowerCase()}`, readB);
    say(`[B] what the server kept: ${typeOf(String(readB.data ?? ''))}`);
    say();

    say('[B] activate it');
    try {
      const started = Date.now();
      report(
        'POST /sap/bc/adt/activation (B)',
        await activateDomain(connection, B),
        Date.now() - started,
      );
    } catch (error) {
      reportFailure('POST /sap/bc/adt/activation (B)', error);
    }

    say('VERDICT');
    say(`  A (type named but not sent): ${typeOf(String(readA.data ?? ''))}`);
    say(`  B (type in the body):        ${typeOf(String(readB.data ?? ''))}`);
    say('  If B kept its type and activated, the create CAN carry one and the');
    say('  parameters should be made to work. If it did not, they are lying');
    say('  and belong out of the contract.');
    say();
  } finally {
    await removeIt(connection, A, transportRequest);
    await removeIt(connection, B, transportRequest);
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
