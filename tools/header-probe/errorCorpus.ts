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
 *   npm run header:discovery          # the full run: the system's header corpus
 *   npm run header:discovery -- --from discovery --headers corpus
 *   npm run header:discovery -- --from clients --headers none
 *   npm run header:discovery -- --from clients --headers bogus
 *   npm run header:discovery -- --from discovery --headers bogus --sequential
 *   npm run header:discovery -- --summary <corpus.json> [<corpus.json> …]
 *   npm run header:discovery -- --render <corpus.json> [<corpus.json> …]
 *
 * Without flags: the authorization check; phase 1, both sources in every
 * mode on the probe name; phase 2, for the endpoints still unknown only,
 * existing objects (found read-only by the repository search) for the reads
 * and the header probe's temporary-object cycle for the writes (it needs
 * `default_package` and `default_transport` in test-config.yaml); then
 * `<out>/header-corpus-<timestamp>.{json,md}`, with each phase's time.
 *
 * `--from` (with `--headers`, one run): `discovery` probes every `app:collection` of
 * `/sap/bc/adt/discovery` (GET, plus POST where it lists `app:accept`);
 * `clients` probes every endpoint the adt-clients members build, recorded by
 * calling each member against a connection that sends nothing.
 * `--headers`: `corpus` sends the prepared pair (the collection's
 * own `app:accept` types, or pairs.ts); `none` sends no Accept and no
 * Content-Type; `bogus` sends `application/x-header-probe` as both.
 * `--isolate <corpus.json>[,<corpus.json>]` sends alone, from the start,
 * every call an earlier run's group split found poisoning envelopes (a header
 * corpus file stands for the corpora it lists); the rest is batched as usual.
 * `--out <dir>` writes there instead of the default folder,
 * `<os temp dir>/mcp-abap-adt-clients/header-probe` (created when missing);
 * the run prints the absolute folder at the end.
 * `--only <text>[,<text>]` keeps the endpoints whose `handler.member`
 * (clients) or href (discovery) contains one of the texts.
 * `--sequential` sends every request on its own, no envelope (to compare
 * the time per request with a batched run).
 * `--render` recomputes a saved corpus's `needs` and writes its .md again,
 * sending nothing.
 * `--summary` reads corpus files and writes, per endpoint, the Accept and
 * Content-Type values the system named in any of them.
 *
 * The first request is the connection's own logon (`connect()`), then
 * `GET /sap/bc/adt/discovery`: a 401 or 403 at either prints
 * `Oops: no authorization (<status>)` and exits 2, sending nothing more.
 *
 * Output (in `<out>`, below): `corpus-<source>-<headers>-<timestamp>.json` (every
 * answer, bodies whole) and `.md` (a table per endpoint group, the summary).
 * The corpus holds system answers: it stays out of the repository.
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
  classifyNeeds,
  HEADERS_MODES,
  type HeadersMode,
  type ICorpus,
  isolationKeys,
  renderCorpusMarkdown,
  renderNamedSummary,
  SOURCES,
  type Source,
} from './corpus';
import { outputDir, runCorpus, runFull } from './corpusRun';
import { Interrupt } from './ledger';
import { measureUpdates, runWriteCycle } from './writeCycle';

// The helpers load `.env` when imported; nothing else here reads it.
const {
  getEnvironmentConfig,
} = require('../../src/__tests__/helpers/test-helper');

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
  isolate?: string[];
  out?: string;
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
    } else if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg === '--isolate') {
      args.isolate = (argv[++i] ?? '').split(',').filter(Boolean);
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
  if (Boolean(args.from) !== Boolean(args.headers))
    throw new Error(
      '--from discovery|clients and --headers corpus|none|bogus go together (neither: the full run)',
    );
  return args;
}

/**
 * The calls earlier runs' splits found poisoning envelopes: from corpus
 * files, or from a header corpus file (through the corpora it lists).
 */
function isolateFrom(files: readonly string[]): Set<string> {
  const corpora: ICorpus[] = [];
  for (const file of files) {
    const read = JSON.parse(fs.readFileSync(file, 'utf8')) as ICorpus & {
      corpora?: string[];
    };
    if (Array.isArray(read.corpora) && !Array.isArray(read.rows)) {
      for (const listed of read.corpora)
        if (listed.endsWith('.json') && fs.existsSync(listed))
          corpora.push(JSON.parse(fs.readFileSync(listed, 'utf8')) as ICorpus);
    } else corpora.push(read);
  }
  return isolationKeys(corpora);
}

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const OUT_DIR = outputDir(args.out);
  try {
    return await run(args, OUT_DIR);
  } finally {
    progress(`output: ${OUT_DIR}`);
  }
}

async function run(args: IArgs, OUT_DIR: string): Promise<number> {
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
  const isolate = args.isolate ? isolateFrom(args.isolate) : undefined;
  if (isolate) progress(`--isolate: ${isolate.size} call(s) go alone`);
  const open = async () =>
    onTheWire(
      await createTestConnection(createConnectionLogger(), {
        ownSession: true,
      }),
    );
  if (!args.from) {
    // The full run: the header corpus of the system.
    const environment = getEnvironmentConfig();
    const { exitCode } = await runFull({
      open,
      ...(isolate ? { isolate } : {}),
      close: (connection) => closeOwnTestConnection(connection),
      interrupt,
      outDir: OUT_DIR,
      clientOptions: (connection) =>
        resolveSystemContext(connection, system === 'cloud'),
      out: { progress, loud },
      writeCycle: (cycle) =>
        runWriteCycle({
          ...cycle,
          packageName: String(environment.default_package ?? ''),
          transportRequest: String(environment.default_transport ?? ''),
        }),
      updateMeasure: (measure) =>
        measureUpdates({
          ...measure,
          packageName: String(environment.default_package ?? ''),
          transportRequest: String(environment.default_transport ?? ''),
        }),
    });
    return exitCode;
  }
  const { exitCode } = await runCorpus({
    // The connection's logon is the first request: a 401 or 403 there is
    // the Oops, and nothing else is sent.
    open: async () =>
      onTheWire(
        await createTestConnection(createConnectionLogger(), {
          ownSession: true,
        }),
      ),
    close: (connection) => closeOwnTestConnection(connection),
    source: args.from as Source,
    mode: args.headers as HeadersMode,
    interrupt,
    outDir: OUT_DIR,
    clientOptions: (connection) =>
      resolveSystemContext(connection, system === 'cloud'),
    out: { progress, loud },
    sequential: args.sequential === true,
    ...(args.only ? { only: args.only } : {}),
    ...(isolate ? { isolate } : {}),
  });
  return exitCode;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    loud(`error corpus: ${message(error)}`);
    process.exit(1);
  },
);
