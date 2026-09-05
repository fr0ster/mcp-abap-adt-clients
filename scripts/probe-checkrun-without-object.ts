/**
 * Which object types can have their code checked before the object exists?
 *
 * `POST /sap/bc/adt/checkruns?reporters=abapCheckRun` carries the source inside
 * the request, so in principle nothing has to be in the system for it to be
 * compiled. That is a claim about the server, not about this library, and the
 * only way to settle it is to send one for a name the system has never heard of.
 *
 * Two payloads per type, and the pair is the point:
 *
 * - a **clean** source — if the answer is a clean report, the check either
 *   compiled it or ignored it, and one answer alone cannot tell which;
 * - a **broken** source, one deliberate syntax error — if that comes back with
 *   the syntax message, the server really compiled what was sent, for an object
 *   that is not there.
 *
 * A type where the broken source answers "clean" is a type where the source was
 * *not* read; a type that refuses both is a type that needs the object first.
 *
 *   npx ts-node scripts/probe-checkrun-without-object.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import {
  parseCheckRunResponse,
  runCheckRunWithSource,
} from '../src/utils/checkRun';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

/** Nothing here is created. Every name is one no system has. */
interface Candidate {
  type: string;
  name: string;
  clean: string;
  broken: string;
  contentType?: string;
}

const XML_DDIC = 'application/xml';

const CANDIDATES: Candidate[] = [
  {
    type: 'class',
    name: 'ZZ_NOSUCH_CLS',
    clean:
      'CLASS zz_nosuch_cls DEFINITION PUBLIC FINAL CREATE PUBLIC.\n  PUBLIC SECTION.\nENDCLASS.\n\nCLASS zz_nosuch_cls IMPLEMENTATION.\nENDCLASS.',
    broken:
      'CLASS zz_nosuch_cls DEFINITION PUBLIC FINAL CREATE PUBLIC.\n  PUBLIC SECTION.\n    METHODS run.\nENDCLASS.\n\nCLASS zz_nosuch_cls IMPLEMENTATION.\n  METHOD run.\n    THIS IS NOT ABAP AT ALL.\n  ENDMETHOD.\nENDCLASS.',
  },
  {
    type: 'interface',
    name: 'ZZ_NOSUCH_INTF',
    clean: 'INTERFACE zz_nosuch_intf PUBLIC.\nENDINTERFACE.',
    broken:
      'INTERFACE zz_nosuch_intf PUBLIC.\n  THIS IS NOT ABAP.\nENDINTERFACE.',
  },
  {
    type: 'program',
    name: 'ZZ_NOSUCH_PRG',
    clean: "REPORT zz_nosuch_prg.\nWRITE 'ok'.",
    broken: 'REPORT zz_nosuch_prg.\nTHIS IS NOT ABAP AT ALL.',
  },
  {
    type: 'function_group',
    name: 'ZZ_NOSUCH_FG',
    clean: 'FUNCTION-POOL zz_nosuch_fg.',
    broken: 'FUNCTION-POOL zz_nosuch_fg.\nTHIS IS NOT ABAP AT ALL.',
  },
  {
    type: 'view',
    name: 'ZZ_NOSUCH_DDL',
    clean:
      '@AccessControl.authorizationCheck: #NOT_REQUIRED\ndefine view entity ZZ_NOSUCH_DDL as select from t000 { key mandt as Client }',
    broken:
      'define view entity ZZ_NOSUCH_DDL as select from t000 { this is not a field list }',
  },
  {
    type: 'metadata_extension',
    name: 'ZZ_NOSUCH_DDLX',
    clean:
      '@Metadata.layer: #CORE\nannotate view ZZ_NOSUCH_V with {\n  @UI.lineItem: [{ position: 10 }]\n  Client;\n}',
    broken: 'annotate view with { this is not valid }',
  },
  {
    type: 'service_definition',
    name: 'ZZ_NOSUCH_SRVD',
    clean: 'define service ZZ_NOSUCH_SRVD {\n  expose t000;\n}',
    broken: 'define service ZZ_NOSUCH_SRVD { this is not an expose list }',
  },
  {
    type: 'access_control',
    name: 'ZZ_NOSUCH_DCLS',
    clean:
      "@EndUserText.label: 'probe'\n@MappingRole: true\ndefine role ZZ_NOSUCH_DCLS {\n  grant select on ZZ_NOSUCH_V;\n}",
    broken: 'define role ZZ_NOSUCH_DCLS { this is not a grant }',
  },
  {
    type: 'transformation',
    name: 'ZZ_NOSUCH_XSLT',
    clean:
      '<?sap.transform simple?>\n<tt:transform xmlns:tt="http://www.sap.com/transformation-templates">\n  <tt:root name="ROOT"/>\n  <tt:template>\n    <root/>\n  </tt:template>\n</tt:transform>',
    broken: '<?sap.transform simple?>\n<tt:transform><unclosed>',
  },
  {
    type: 'scalar_function',
    name: 'ZZ_NOSUCH_DSFD',
    clean:
      'define scalar function ZZ_NOSUCH_DSFD\n  with parameters p : abap.int4\n  returns abap.int4\n  implemented by method zz_nosuch_cls=>run;',
    broken: 'define scalar function ZZ_NOSUCH_DSFD this is not a signature',
  },
  // DDIC types whose editor content is XML rather than ABAP text. Sent with an
  // XML content type on purpose: the interesting answer is whether the server
  // reads the artifact at all, and if it refuses, in which terms.
  {
    type: 'domain',
    name: 'ZZ_NOSUCH_DOM',
    clean:
      '<?xml version="1.0" encoding="UTF-8"?><doma:wbobject xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZZ_NOSUCH_DOM" doma:typeInformation="CHAR" doma:typeLength="10"/>',
    broken:
      '<?xml version="1.0" encoding="UTF-8"?><doma:wbobject xmlns:doma="http://www.sap.com/dictionary/domain" adtcore:name="ZZ_NOSUCH_DOM" doma:typeInformation="NOT_A_TYPE"',
    contentType: XML_DDIC,
  },
  {
    type: 'table',
    name: 'ZZ_NOSUCH_TABL',
    clean:
      "@EndUserText.label : 'probe'\ndefine table zz_nosuch_tabl {\n  key client : abap.clnt not null;\n  key id     : abap.char(10) not null;\n}",
    broken: 'define table zz_nosuch_tabl { this is not a field list }',
  },
  {
    type: 'structure',
    name: 'ZZ_NOSUCH_STRU',
    clean:
      "@EndUserText.label : 'probe'\ndefine structure zz_nosuch_stru {\n  id : abap.char(10);\n}",
    broken: 'define structure zz_nosuch_stru { this is not a field list }',
  },
  {
    type: 'data_element',
    name: 'ZZ_NOSUCH_DTEL',
    clean:
      '<?xml version="1.0" encoding="UTF-8"?><dtel:wbobject xmlns:dtel="http://www.sap.com/dictionary/dataelement" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZZ_NOSUCH_DTEL" dtel:typeName="ZZ_NOSUCH_DOM"/>',
    broken:
      '<?xml version="1.0" encoding="UTF-8"?><dtel:wbobject xmlns:dtel="http://www.sap.com/dictionary/dataelement" adtcore:name="ZZ_NOSUCH_DTEL"',
    contentType: XML_DDIC,
  },
];

/** What one POST answered, reduced to the two things that decide the verdict. */
interface Attempt {
  status: number;
  reportStatus: string;
  statusText: string;
  messages: string[];
  transportError?: string;
}

async function attempt(
  connection: Parameters<typeof runCheckRunWithSource>[0],
  candidate: Candidate,
  source: string,
  version: 'new' | 'active' | 'inactive' = 'new',
  nameOverride?: string,
): Promise<Attempt> {
  try {
    const response = await runCheckRunWithSource(
      connection,
      candidate.type,
      nameOverride ?? candidate.name,
      source,
      version,
      'abapCheckRun',
      candidate.contentType,
    );
    const report = parseCheckRunResponse(response);
    return {
      status: response.status,
      reportStatus: report.status,
      statusText: report.message,
      messages: [...report.errors, ...report.warnings]
        .map((m) => m.text)
        .filter(Boolean)
        .slice(0, 3),
    };
  } catch (error) {
    return {
      status: 0,
      reportStatus: 'threw',
      statusText: '',
      messages: [],
      transportError: error instanceof Error ? error.message : String(error),
    };
  }
}

function describe(a: Attempt): string {
  if (a.transportError) return `✖ ${a.transportError.slice(0, 140)}`;
  const head = `HTTP ${a.status}, report=${a.reportStatus}${a.statusText ? ` — "${a.statusText}"` : ''}`;
  if (a.messages.length === 0) return `${head}, no messages`;
  return `${head}\n      · ${a.messages.join('\n      · ')}`;
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const lines: string[] = [];
  const say = (line: string) => {
    lines.push(line);
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(line);
  };
  try {
    for (const candidate of CANDIDATES) {
      say(`\n### ${candidate.type} (${candidate.name})`);
      const clean = await attempt(connection, candidate, candidate.clean);
      say(`  clean : ${describe(clean)}`);
      const broken = await attempt(connection, candidate, candidate.broken);
      say(`  broken: ${describe(broken)}`);

      // `chkrun:status` is the verdict, not the message count: `processed`
      // means the server compiled what was sent, and it says so even when the
      // source is clean and answers nothing. `notProcessed` is the refusal —
      // no messages there means the check never ran, not that the code is fine.
      const compiled = [clean, broken].some(
        (a) => a.reportStatus === 'processed',
      );
      const sawTheSource = broken.messages.length > clean.messages.length;
      say(
        `  ⇒ ${
          compiled
            ? `checked without the object existing${sawTheSource ? ', and the broken source is what it complained about' : ''}`
            : 'refused — the object has to exist first'
        }`,
      );
    }

    // Controls. A refusal above could be about the missing object or about
    // `version="new"`, and one run cannot tell them apart — so ask the same
    // question twice more, changing one thing each time.
    const refused = CANDIDATES.filter((c) =>
      ['class', 'interface', 'view', 'access_control'].includes(c.type),
    );
    for (const candidate of refused) {
      say(`\n### control: ${candidate.type}, other versions`);
      for (const version of ['active', 'inactive'] as const) {
        const a = await attempt(
          connection,
          candidate,
          candidate.broken,
          version,
        );
        say(`  version=${version}: ${describe(a)}`);
      }
    }

    const existing = process.env.PROBE_EXISTING_CLASS;
    if (existing) {
      say(`\n### control: class source sent for ${existing}, which exists`);
      const candidate = CANDIDATES[0];
      for (const version of ['new', 'active', 'inactive'] as const) {
        const a = await attempt(
          connection,
          candidate,
          candidate.broken.replace(/zz_nosuch_cls/g, existing.toLowerCase()),
          version,
          existing,
        );
        say(`  version=${version}: ${describe(a)}`);
      }
    }
  } finally {
    await releaseTestConnection(connection);
    fs.writeFileSync(
      path.resolve(__dirname, '../checkrun-without-object.log'),
      `${lines.join('\n')}\n`,
    );
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
