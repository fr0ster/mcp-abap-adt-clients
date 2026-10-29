/**
 * The four classes no client hands out — `AdtAbapGitClient`, `AbapDebugger`,
 * `AmdpDebugger`, `MemorySnapshots` — have a static `create` with the getters'
 * two overloads: no results answers the shipped documents' type, given results
 * answer theirs, and a custom `R` without its results does not compile
 * (compile-time checks; `npm run test:check` runs them). The getters' are in
 * `clientResultDefaults.test.ts`.
 */

import type { IDebuggerIdentity } from '@mcp-abap-adt/interfaces-adt';
import { AdtAbapGitClient } from '../../../clients/AdtAbapGitClient';
import { abapGitDocuments } from '../../../clients/abapGit/types';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../runtime/debugger/AbapDebugger';
import {
  AmdpDebugger,
  amdpDebuggerDocuments,
} from '../../../runtime/debugger/AmdpDebugger';
import {
  MemorySnapshots,
  memorySnapshotsDocuments,
} from '../../../runtime/memory/MemorySnapshots';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** A result set of its own: the shipped one, and a marker the default lacks. */
type Marked<D> = D & { readonly marker: true };
const marked = <D extends object>(documents: D): Marked<D> => ({
  ...documents,
  marker: true,
});

function factoryTypes(connection: RecordingConnection): void {
  // No results: the shipped documents' type, inferred.
  const git = AdtAbapGitClient.create(connection);
  const gitDefault: Equal<
    typeof git,
    AdtAbapGitClient<typeof abapGitDocuments>
  > = true;
  const abap = AbapDebugger.create(connection, { onConflict: 'takeOver' });
  const abapDefault: Equal<
    typeof abap,
    AbapDebugger<typeof abapDebuggerDocuments>
  > = true;
  const amdp = AmdpDebugger.create(connection, { logger: noopLogger });
  const amdpDefault: Equal<
    typeof amdp,
    AmdpDebugger<typeof amdpDebuggerDocuments>
  > = true;
  const memory = MemorySnapshots.create(connection);
  const memoryDefault: Equal<
    typeof memory,
    MemorySnapshots<typeof memorySnapshotsDocuments>
  > = true;
  void [gitDefault, abapDefault, amdpDefault, memoryDefault];

  // Given results: their type — from a literal and from a variable alike, so
  // results the first overload does not see cannot be answered as shipped.
  const ownGit = AdtAbapGitClient.create(connection, {
    results: marked(abapGitDocuments),
  });
  const gitOwn: Equal<
    typeof ownGit,
    AdtAbapGitClient<Marked<typeof abapGitDocuments>>
  > = true;
  const abapOptions = {
    results: marked(abapDebuggerDocuments),
    onConflict: 'refuse' as const,
  };
  const ownAbap = AbapDebugger.create(connection, abapOptions);
  const abapOwn: Equal<
    typeof ownAbap,
    AbapDebugger<Marked<typeof abapDebuggerDocuments>>
  > = true;
  const amdpOptions = { results: marked(amdpDebuggerDocuments) };
  const ownAmdp = AmdpDebugger.create(connection, amdpOptions);
  const amdpOwn: Equal<
    typeof ownAmdp,
    AmdpDebugger<Marked<typeof amdpDebuggerDocuments>>
  > = true;
  const ownMemory = MemorySnapshots.create(connection, {
    results: marked(memorySnapshotsDocuments),
    logger: noopLogger,
  });
  const memoryOwn: Equal<
    typeof ownMemory,
    MemorySnapshots<Marked<typeof memorySnapshotsDocuments>>
  > = true;
  void [gitOwn, abapOwn, amdpOwn, memoryOwn];

  // A custom R names its results: no factory answers R without them.
  // @ts-expect-error -- R without results
  AdtAbapGitClient.create<Marked<typeof abapGitDocuments>>(connection);
  // @ts-expect-error -- R without results
  AbapDebugger.create<Marked<typeof abapDebuggerDocuments>>(connection, {
    onConflict: 'takeOver',
  });
  // @ts-expect-error -- R without results
  AmdpDebugger.create<Marked<typeof amdpDebuggerDocuments>>(connection);
  // @ts-expect-error -- R without results
  MemorySnapshots.create<Marked<typeof memorySnapshotsDocuments>>(connection, {
    logger: noopLogger,
  });

  // The constructor takes its results, always.
  // @ts-expect-error -- results are required
  new AdtAbapGitClient(connection, { logger: noopLogger });
  // @ts-expect-error -- results are required
  new AbapDebugger(connection, { onConflict: 'takeOver' });
  // @ts-expect-error -- results are required
  new AmdpDebugger(connection, {});
  // @ts-expect-error -- results are required
  new MemorySnapshots(connection, {});
}

describe('the static create of a class no client hands out', () => {
  const identity: IDebuggerIdentity = {
    debuggingMode: 'user',
    requestUser: 'SAPUSER01',
    terminalId: 'EC80D3662BADB8CD21C70406E0E96D4C',
    ideId: '7194D729E68FDAF6E185C7E5124CC900',
  };

  it('is typed by what it is given (checked by npm run test:check)', () => {
    expect(typeof factoryTypes).toBe('function');
  });

  it('answers with the shipped documents when given none', async () => {
    const connection = new RecordingConnection();

    const repos = await AdtAbapGitClient.create(connection).listRepos();
    const snapshots = await MemorySnapshots.create(connection).list();

    expect(repos.ok).toBe(true);
    expect(snapshots.ok).toBe(true);
    expect(connection.sent).toHaveLength(2);
  });

  it('sends what the constructor sends, its settings included', async () => {
    const created = new RecordingConnection();
    const constructed = new RecordingConnection();

    await AbapDebugger.create(created, { onConflict: 'takeOver' }).listen(
      identity,
    );
    await new AbapDebugger(constructed, {
      results: abapDebuggerDocuments,
      onConflict: 'takeOver',
    }).listen(identity);
    await AbapDebugger.create(created).listen(identity);
    await new AbapDebugger(constructed, {
      results: abapDebuggerDocuments,
    }).listen(identity);

    expect(created.sent).toEqual(constructed.sent);
    expect(created.sent[0]?.url).not.toContain('checkConflict');
    expect(created.sent[1]?.url).toContain('checkConflict=true');
  });

  it('answers with the documents it is given', async () => {
    const connection = new RecordingConnection();
    const amdp = AmdpDebugger.create(connection, {
      results: amdpDebuggerDocuments,
    });

    const answer = await amdp.start('SAPUSER01');

    expect(answer.ok).toBe(true);
    expect(connection.sent).toHaveLength(1);
  });
});
