/**
 * When does a class become readable — and is it activation, or is it having a
 * body at all?
 *
 * A POST creates an empty shell: no source has been written to it yet. Reading
 * one back answers `400 ExceptionResourceWrongData`, and the first pass at this
 * concluded "a never-activated object cannot be read". That conflates two
 * things, because the shell had never been written to either.
 *
 * So this walks the whole flow and reads after every step: created, then
 * written under a lock, then activated. Whichever read first answers 200 is the
 * one that matters, and "inactive" and "empty" stop being the same claim.
 *
 * And a third question, because a refusal that reads as "your request is
 * malformed" is a bad thing to hand a caller who simply asked too early: does
 * `getVersions()` answer honestly at each stage? An empty feed for an object
 * with nothing in it would be a way to ask "is there anything to read" that
 * does not depend on recognising one T100 key.
 *
 * Creates ZAC_PROBE_INACT in the default package and deletes it again.
 *
 *   npx ts-node scripts/probe-inactive-metadata.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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

const NAME = 'ZAC_PROBE_INACT';
const PACKAGE = 'ZADT_BLD_PKG03';

// biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
const say = (line: string) => console.log(line);

// biome-ignore lint/suspicious/noExplicitAny: a probe reads whatever came back
// biome-ignore lint/suspicious/noExplicitAny: a probe reads whatever came back
async function versions(label: string, cls: any) {
  const answer = await cls.getVersions({ className: NAME });
  if (answer.ok) {
    const value = answer.getResult().value;
    const n = Array.isArray(value) ? value.length : undefined;
    say(
      `${label.padEnd(34)} ok, ${n === undefined ? String(value).slice(0, 60) : `${n} version(s)`}`,
    );
  } else {
    say(
      `${label.padEnd(34)} [${answer.getError().origin}] ${answer.getError().message.slice(0, 90)}`,
    );
  }
}

// biome-ignore lint/suspicious/noExplicitAny: a probe reads whatever came back
function report(label: string, answer: any) {
  if (answer.ok) {
    const value = String(answer.getResult().value ?? '');
    const lang = /adtcore:masterLanguage="([^"]*)"/.exec(value)?.[1];
    say(
      `${label.padEnd(34)} ok, ${value.length} bytes${lang ? `, masterLanguage=${lang}` : ''}`,
    );
  } else {
    const f = answer.getError();
    say(`${label.padEnd(34)} [${f.origin}] ${f.message.slice(0, 95)}`);
  }
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);
  const cls = client.getClass();
  try {
    await cls.delete({ className: NAME }).catch(() => undefined);

    report(
      'create',
      await cls.create({
        className: NAME,
        packageName: PACKAGE,
        description: 'inactive metadata probe',
      }),
    );

    say('--- after POST, an empty shell -----------------------------------');
    report('metadata, no version', await cls.readMetadata({ className: NAME }));
    report(
      'metadata, inactive',
      await cls.readMetadata({ className: NAME }, { version: 'inactive' }),
    );
    report(
      'metadata, active',
      await cls.readMetadata({ className: NAME }, { version: 'active' }),
    );
    report('source, inactive', await cls.read({ className: NAME }, 'inactive'));
    await versions('versions', cls);

    say('--- after the source is written, still inactive -------------------');
    report(
      'update (lock, PUT, unlock)',
      await cls.update(
        { className: NAME },
        {
          sourceCode: [
            `CLASS ${NAME.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.`,
            '  PUBLIC SECTION.',
            '    METHODS probe.',
            'ENDCLASS.',
            '',
            `CLASS ${NAME.toLowerCase()} IMPLEMENTATION.`,
            '  METHOD probe.',
            '  ENDMETHOD.',
            'ENDCLASS.',
          ].join('\n'),
        },
      ),
    );
    report('metadata, no version', await cls.readMetadata({ className: NAME }));
    report(
      'metadata, inactive',
      await cls.readMetadata({ className: NAME }, { version: 'inactive' }),
    );
    report(
      'metadata, active',
      await cls.readMetadata({ className: NAME }, { version: 'active' }),
    );
    report('source, inactive', await cls.read({ className: NAME }, 'inactive'));
    report('source, active', await cls.read({ className: NAME }, 'active'));
    await versions('versions', cls);

    say('--- after activation ----------------------------------------------');
    report('activate', await cls.activate({ className: NAME }));
    report('metadata, no version', await cls.readMetadata({ className: NAME }));
    report('source, active', await cls.read({ className: NAME }, 'active'));
    await versions('versions', cls);
  } finally {
    await cls.delete({ className: NAME }).catch(() => undefined);
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
