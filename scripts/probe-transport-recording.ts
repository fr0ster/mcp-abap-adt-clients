/**
 * Does a write to a transportable package actually land in the request?
 *
 * Every integration suite runs against `TEST_MCP`, whose objects are local —
 * `default_transport` is empty and nothing is recorded anywhere. So the whole
 * transport path is exercised only by `AdtRequest`, which creates and reads
 * requests but never puts an object into one. This probe closes that gap: a
 * real class, in a package that transports, with a request number handed to
 * `create` and to `update`, and the request read back afterwards to see
 * whether the object is in it.
 *
 * "It answered 200" is not the question. The question is what the request
 * contains, so that is what gets printed — before, after the create, and after
 * the update.
 *
 *   npx ts-node scripts/probe-transport-recording.ts ZAC_TR_PKG E19K906816
 *   npx ts-node scripts/probe-transport-recording.ts ZAC_TR_PKG E19K906816 ZAC_TR_CLS02
 *   npx ts-node scripts/probe-transport-recording.ts ZAC_TR_PKG E19K906816 ZAC_TR_CLS02 --keep
 *
 * `--keep` leaves the class behind for inspection in Eclipse. Without it the
 * class is removed at the end, and the removal is itself recorded in the same
 * request — which is the correct behaviour for a transported object and worth
 * seeing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Overridable, because the interesting evidence is a name the request has
// never held: a transport entry survives the object's deletion, so re-running
// with the same name shows an unchanged list and proves nothing.
const DEFAULT_CLASS_NAME = 'ZAC_TR_CLS01';

function source(name: string, note: string): string {
  return `CLASS ${name} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS note RETURNING VALUE(rv) TYPE string.
ENDCLASS.

CLASS ${name} IMPLEMENTATION.
  METHOD note.
    rv = '${note}'.
  ENDMETHOD.
ENDCLASS.`;
}

/**
 * The objects a request holds.
 *
 * `readMetadata` is a GET on the request itself, and it carries the contents —
 * measured on E19K906816, which answered with four `tm:abap_object` children.
 * That element name is the trap: `tm:abapObject` matches nothing, so a parser
 * spelling it that way reports every request as empty, including ones holding
 * a hundred objects. Found that way while deciding which requests were safe to
 * delete.
 */
async function requestContents(
  connection: IAbapConnection,
  logger: ReturnType<typeof createConnectionLogger>,
  requestNumber: string,
): Promise<string[]> {
  const client = new AdtClient(connection, logger);
  const answer = await client
    .getRequest()
    .readMetadata({ transportNumber: requestNumber, description: '' });
  if (!answer.ok) {
    throw new Error(`reading ${requestNumber}: ${answer.getError().message}`);
  }
  // `.value`, not the result itself: `getResult()` hands back an `IAdtResult`
  // wrapper, and stringifying that yields "[object Object]" — which matches
  // nothing and reads as "the request is empty" for every request there is.
  const xml = String(answer.getResult().value ?? '');
  return [...xml.matchAll(/tm:name="([^"]+)"[^>]*tm:wbtype="([^"]+)"/g)]
    .map(([, name, type]) => `${type} ${name}`)
    .sort();
}

function report(label: string, contents: string[]): void {
  process.stdout.write(
    `\n${label}: ${contents.length} object(s)\n` +
      (contents.length ? `  ${contents.join('\n  ')}\n` : '  (empty)\n'),
  );
}

async function main(): Promise<void> {
  const [pkg, request, ...rest] = process.argv.slice(2);
  const className = rest.find((a) => !a.startsWith('--')) ?? DEFAULT_CLASS_NAME;
  if (!pkg || !request) {
    process.stdout.write(
      'usage: probe-transport-recording.ts <package> <requestNumber> [--keep]\n',
    );
    process.exitCode = 1;
    return;
  }
  const keep = rest.includes('--keep');

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const cls = new AdtClient(connection, logger).getClass();
  const config = {
    className,
    packageName: pkg,
    transportRequest: request,
    description: 'Transport recording probe',
  };

  try {
    report('before', await requestContents(connection, logger, request));

    process.stdout.write(`\ncreate ${className} in ${pkg} on ${request}\n`);
    const created = await cls.create({
      ...config,
      sourceCode: source(className, 'created'),
    });
    process.stdout.write(
      created.ok
        ? '  accepted\n'
        : `  REFUSED: ${created.getError().message}\n`,
    );
    if (!created.ok) return;

    report('after create', await requestContents(connection, logger, request));

    // lock → update → unlock → activate, in the caller's own order: this
    // library composes none of it.
    const lock = await cls.lock(config);
    if (!lock.ok) throw new Error(`lock: ${lock.getError().message}`);
    const handle = String(lock.getResult()?.value ?? lock.getResult());
    process.stdout.write(`\nlock handle: ${handle.slice(0, 12)}…\n`);

    const updated = await cls.update(config, {
      sourceCode: source(className, 'updated'),
      lockHandle: handle,
    });
    process.stdout.write(
      updated.ok
        ? '  update accepted\n'
        : `  update REFUSED: ${updated.getError().message}\n`,
    );

    await cls.unlock(config, handle);
    const activated = await cls.activate(config);
    process.stdout.write(
      activated.ok
        ? '  activate accepted\n'
        : `  activate REFUSED: ${activated.getError().message}\n`,
    );

    report('after update', await requestContents(connection, logger, request));

    if (keep) {
      process.stdout.write(`\n${className} left in place (--keep)\n`);
      return;
    }

    process.stdout.write(`\ndelete ${className}\n`);
    const check = await cls.checkDeletion(config);
    process.stdout.write(
      `  deletion check: ${check.ok ? 'ok' : check.getError().message}\n`,
    );
    const deleted = await cls.delete(config);
    process.stdout.write(
      deleted.ok
        ? '  delete accepted\n'
        : `  delete REFUSED: ${deleted.getError().message}\n`,
    );
    report('after delete', await requestContents(connection, logger, request));
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  process.stdout.write(`\nfailed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
