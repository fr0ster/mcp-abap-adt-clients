/**
 * The published `./abapgit` entry, as a consumer installs it: the package is
 * packed (`npm pack --ignore-scripts`, as the release publishes), unpacked
 * into a directory outside the workspace, and two consumers are type-checked
 * against it — one written for 46.x (its `results`, the explicit values-map
 * type argument, the `{ logger, results }` constructor, the legacy calls) and
 * one for the new forms (facts slots, `credentials`). Both module resolutions
 * a consumer may compile with are checked: `node16` reads `exports`, `node10`
 * reads `typesVersions`.
 *
 * The packed `dist` is the build's: `npm run build` first (the root `check`
 * builds before it tests).
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ts from 'typescript';

const PACKAGE = path.resolve(__dirname, '../../..');
const ROOT = path.resolve(PACKAGE, '../..');

/** Where a dependency of the packed package is installed in the workspace. */
function installed(name: string): string {
  if (name === 'adt-strategies') return path.join(ROOT, 'packages', name);
  const own = path.join(PACKAGE, 'node_modules', '@mcp-abap-adt', name);
  return fs.existsSync(own)
    ? own
    : path.join(ROOT, 'node_modules', '@mcp-abap-adt', name);
}

const OLD_CONSUMER = `
import { type ResultValuesOf } from '@mcp-abap-adt/adt-clients';
import { AdtAbapGitClient, abapGitDocuments, abapGitFactsDefaults } from '@mcp-abap-adt/adt-clients/abapgit';
import { abapGitRepos, type IAbapGitRepo } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
declare const connection: IAbapConnection;
declare const logger: ILogger;
const results = { ...abapGitDocuments, repos: abapGitRepos };
let git: AdtAbapGitClient<ResultValuesOf<typeof results>>;
// A direct new passes every facts reader and its values type (#304, D4).
git = new AdtAbapGitClient<ResultValuesOf<typeof results>>(connection, { logger, results: { ...abapGitFactsDefaults, ...results } });
const headers = { accept: 'a', contentType: 'c' };
export async function calls(): Promise<void> {
  const listed = await git.listRepos();
  const repos: IAbapGitRepo[] = listed.ok ? listed.getResult().value : [];
  // The old form of link and checkExternalRepo is refused (C4 of #304).
  // @ts-expect-error -- remoteUser/remotePassword are gone
  await git.link({ package: 'P', url: 'u', remoteUser: 'u', remotePassword: 'p' }, { headers });
  // @ts-expect-error -- remoteUser is gone
  await git.checkExternalRepo({ url: 'u', remoteUser: 'u' }, { headers });
  await git.pull({ package: 'P', pullLink: '/sap/bc/adt/abapgit/repos/K/pull' }, { headers });
  await git.unlink({ repositoryId: 'K' });
  await git.getErrorLog('/sap/bc/adt/abapgit/repos/K/log/L');
  void repos;
}
`;

const NEW_CONSUMER = `
import { AdtAbapGitClient, abapGitDocuments, type AbapGitDefaultFacts } from '@mcp-abap-adt/adt-clients/abapgit';
import type { IAbapGitReposFacts } from '@mcp-abap-adt/adt-strategies';
import type { IAbapGitFactsResponse, IAbapGitStructuredError } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
declare const connection: IAbapConnection;
const git = AdtAbapGitClient.create(connection, {
  results: { ...abapGitDocuments, reposFacts: (a: IAbapGitFactsResponse<IAbapGitReposFacts>) => a.facts.repos.length },
});
const headers = { accept: 'a', contentType: 'c' };
const credentials = { user: 'u', password: 'p' };
export async function calls(): Promise<void> {
  const listed = await git.listReposQuiet();
  const count: number = listed.ok ? listed.getResult().value : 0;
  const linked = await git.link({ package: 'P', url: 'u', branchName: 'main' }, { headers, credentials });
  const error: IAbapGitStructuredError | undefined = linked.ok ? undefined : linked.getError();
  const file = await git.getFile({ key: 'K', filename: 'f', version: 'remote' }, { credentials });
  const facts: AbapGitDefaultFacts<'file'> | undefined = file.ok ? file.getResult().value : undefined;
  await git.pullRepo({ key: 'K', branchName: 'main' }, { headers, credentials });
  await git.checkExternalRepo({ url: 'u' }, { headers, credentials: null });
  await git.switchBranch({ key: 'K', branch: 'dev', create: false });
  void [count, error, facts];
}
`;

describe('the packed ./abapgit entry', () => {
  let consumer: string;

  beforeAll(() => {
    if (!fs.existsSync(path.join(PACKAGE, 'dist', 'index.abapgit.d.ts')))
      throw new Error(
        'dist/index.abapgit.d.ts is missing: npm run build first',
      );
    consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'abapgit-entry-'));
    const [packed] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--ignore-scripts', '--json', '--pack-destination', consumer],
        { cwd: PACKAGE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    ) as Array<{ filename: string }>;
    if (packed === undefined) throw new Error('npm pack listed no tarball');
    const scope = path.join(consumer, 'node_modules', '@mcp-abap-adt');
    fs.mkdirSync(scope, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      path.join(consumer, packed.filename),
      '-C',
      scope,
    ]);
    fs.renameSync(path.join(scope, 'package'), path.join(scope, 'adt-clients'));
    for (const name of [
      'adt-strategies',
      'interfaces-adt',
      'interfaces-adt-connection',
      'interfaces-network',
      'interfaces-utils',
      'logger',
    ])
      fs.symlinkSync(installed(name), path.join(scope, name), 'dir');
    fs.writeFileSync(path.join(consumer, 'old.ts'), OLD_CONSUMER);
    fs.writeFileSync(path.join(consumer, 'new.ts'), NEW_CONSUMER);
  }, 120_000);

  afterAll(() => {
    if (consumer) fs.rmSync(consumer, { recursive: true, force: true });
  });

  it('holds the packed tarball’s own declarations, not the workspace’s', () => {
    const entry = path.join(
      consumer,
      'node_modules/@mcp-abap-adt/adt-clients/dist/index.abapgit.d.ts',
    );
    expect(fs.lstatSync(entry).isFile()).toBe(true);
    expect(fs.realpathSync(entry).startsWith(fs.realpathSync(consumer))).toBe(
      true,
    );
  });

  it.each([
    ['node16', ts.ModuleKind.Node16, ts.ModuleResolutionKind.Node16],
    ['node10', ts.ModuleKind.CommonJS, ts.ModuleResolutionKind.Node10],
  ] as const)(
    'type-checks a 46.x consumer, its old form refused, and a new-form one (%s)',
    (_name, module, moduleResolution) => {
      const program = ts.createProgram(
        [path.join(consumer, 'old.ts'), path.join(consumer, 'new.ts')],
        {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
          target: ts.ScriptTarget.ES2022,
          module,
          moduleResolution,
        },
      );
      const problems = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(problems).toEqual([]);
      const resolved = program
        .getSourceFiles()
        .map((file) => file.fileName)
        .find((name) => name.endsWith('index.abapgit.d.ts'));
      expect(resolved && fs.realpathSync(resolved)).toContain(
        fs.realpathSync(consumer),
      );
    },
  );
});
