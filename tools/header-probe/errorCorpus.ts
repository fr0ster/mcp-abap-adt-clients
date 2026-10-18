/**
 * Error corpus: every answer a system gives the ADT endpoints, errors above all.
 *
 * Prepare (as for the header probe):
 *   - `.env` in the repository root with the SAP connection (SAP_URL,
 *     SAP_USERNAME, SAP_PASSWORD, SAP_CLIENT), as the integration tests use.
 *   - `src/__tests__/helpers/test-config.yaml`: the run reads
 *     `environment.system` from it.
 *
 * Run:
 *   npm run header:discovery:next -- --from discovery --headers corpus
 *   npm run header:discovery:next -- --from clients --headers none
 *   npm run header:discovery:next -- --from clients --headers bogus
 *   npm run header:discovery:next -- --from discovery --headers bogus --sequential
 *   npm run header:discovery:next -- --summary <corpus.json> [<corpus.json> …]
 *   npm run header:discovery:next -- --render <corpus.json> [<corpus.json> …]
 *
 * `--from` (required): `discovery` probes every `app:collection` of
 * `/sap/bc/adt/discovery` (GET, plus POST where it lists `app:accept`);
 * `clients` probes every endpoint the adt-clients members build, recorded by
 * calling each member against a connection that sends nothing.
 * `--headers` (required): `corpus` sends the prepared pair (the collection's
 * own `app:accept` types, or pairs.ts); `none` sends no Accept and no
 * Content-Type; `bogus` sends `application/x-header-probe` as both.
 * `--only <text>[,<text>]` keeps the endpoints whose `handler.member`
 * (clients) or href (discovery) contains one of the texts.
 * `--sequential` sends every request on its own, no envelope (to compare
 * the time per request with a batched run).
 * `--render` recomputes a saved corpus's `needs` and writes its .md again,
 * sending nothing.
 * `--summary` reads corpus files and writes, per endpoint, the Accept and
 * Content-Type values the system named in any of them.
 *
 * The first request is `GET /sap/bc/adt/discovery`: 401 or 403 prints
 * `Oops: no authorization (<status>)` and exits 2, sending nothing more.
 *
 * Output: `.header-probe/corpus-<source>-<headers>-<timestamp>.json` (every
 * answer, bodies whole) and `.md` (a table per endpoint group, the summary).
 * The directory is gitignored: the corpus holds system answers.
 *
 * More in tools/header-probe/README.md.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  closeOwnTestConnection,
  createTestConnection,
  getTargetSystem,
  resolveSystemContext,
} from '../../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../../src/__tests__/helpers/testLogger';
import { message, onTheWire } from './capture';
import {
  authorizationVerdict,
  classifyNeeds,
  HEADERS_MODES,
  type HeadersMode,
  type ICorpus,
  renderCorpusMarkdown,
  renderNamedSummary,
  SOURCES,
  type Source,
} from './corpus';
import { runCorpus, statusOfError } from './corpusRun';
import { Interrupt } from './ledger';

const OUT_DIR = path.resolve(__dirname, '../../.header-probe');

const progress = (line: string): void => {
  process.stdout.write(`${line}\n`);
};
const loud = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

interface IArgs {
  from?: Source;
  headers?: HeadersMode;
  summary?: string[];
  render?: string[];
  sequential?: boolean;
  only?: string[];
}

function parseArgs(argv: readonly string[]): IArgs {
  const args: IArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from') {
      const value = argv[++i] as Source;
      if (!SOURCES.includes(value))
        throw new Error(`--from takes ${SOURCES.join(' or ')}`);
      args.from = value;
    } else if (arg === '--headers') {
      const value = argv[++i] as HeadersMode;
      if (!HEADERS_MODES.includes(value))
        throw new Error(`--headers takes ${HEADERS_MODES.join(', ')}`);
      args.headers = value;
    } else if (arg === '--sequential') {
      args.sequential = true;
    } else if (arg === '--only') {
      args.only = (argv[++i] ?? '').split(',').filter(Boolean);
    } else if (arg === '--render') {
      args.render = argv.slice(i + 1);
      break;
    } else if (arg === '--summary') {
      args.summary = argv.slice(i + 1);
      break;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.summary && !args.render && (!args.from || !args.headers))
    throw new Error(
      'both --from discovery|clients and --headers corpus|none|bogus are required',
    );
  return args;
}

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.summary) {
    const corpora = args.summary.map(
      (file) => JSON.parse(fs.readFileSync(file, 'utf8')) as ICorpus,
    );
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, `summary-${stamp()}.md`);
    fs.writeFileSync(out, renderNamedSummary(corpora));
    progress(out);
    return 0;
  }
  if (args.render) {
    // From the saved corpus, nothing sent: `needs` recomputed, the .md
    // written again beside the .json.
    // A none corpus of the same source among the files adds its evidence.
    const corpora = args.render.map(
      (file) => JSON.parse(fs.readFileSync(file, 'utf8')) as ICorpus,
    );
    for (const [index, file] of args.render.entries()) {
      const corpus = corpora[index];
      if (corpus.headers === 'bogus')
        corpus.needs = classifyNeeds(
          corpus.rows,
          corpora
            .filter((c) => c.source === corpus.source && c.headers === 'none')
            .flatMap((c) => c.rows),
        );
      fs.writeFileSync(file, `${JSON.stringify(corpus, null, 2)}\n`);
      const md = file.replace(/\.json$/, '.md');
      fs.writeFileSync(md, renderCorpusMarkdown(corpus));
      progress(md);
    }
    return 0;
  }
  const system = getTargetSystem();

  let connection: Awaited<ReturnType<typeof createTestConnection>>;
  try {
    connection = await createTestConnection(createConnectionLogger(), {
      ownSession: true,
    });
  } catch (error) {
    // The logon itself was refused: the same stop as the discovery read's.
    const status = statusOfError(error);
    const verdict = authorizationVerdict(status);
    if (!verdict.go && (status === 401 || status === 403)) {
      progress(verdict.line);
      return verdict.exitCode;
    }
    throw error;
  }
  onTheWire(connection);

  const interrupt = new Interrupt();
  // Ctrl-C stops new requests; the one in flight answers, the run unwinds,
  // and the `finally` cleans the ledger as it then stands. A second Ctrl-C
  // while that cleanup runs is ignored.
  process.on('SIGINT', () => {
    if (interrupt.requested) return;
    interrupt.stop();
    progress(
      'interrupted: waiting for the request in flight, then cleaning up',
    );
  });
  try {
    const { exitCode } = await runCorpus({
      connection,
      source: args.from as Source,
      mode: args.headers as HeadersMode,
      interrupt,
      outDir: OUT_DIR,
      clientOptions: () => resolveSystemContext(connection, system === 'cloud'),
      out: { progress, loud },
      sequential: args.sequential === true,
      ...(args.only ? { only: args.only } : {}),
    });
    return exitCode;
  } finally {
    await closeOwnTestConnection(connection);
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    loud(`error corpus: ${message(error)}`);
    process.exit(1);
  },
);
