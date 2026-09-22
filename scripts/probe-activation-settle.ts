/**
 * Does a function group's activation finish inside the POST, or settle after it?
 *
 * **The question.** `activateSharedFunctionGroup` in the test helper reads the
 * answer to `POST /sap/bc/adt/activation` and treats it as the verdict. That is
 * only sound if the work is over by the time the answer arrives. Nothing in the
 * repository had measured it: the recorded corpus
 * (`../mcp-abap-adt/tests/fixtures/adt/`) holds three activations, all of a
 * **class**, all 200, none of a function group — while
 * `src/__tests__/helpers/test-helper.js` carries the opposite claim in a
 * docblock, "activation is asynchronous and may take time", keyed on a message
 * (`SWB_TOOL/025`, "Error while importing object & from the database") whose
 * one recorded occurrence is a package that does not exist.
 *
 * A function group is the interesting case precisely because activating one
 * regenerates `SAPL<group>` — a second object, which the server could plausibly
 * hand to a background task.
 *
 * **The method.** Put the group into the inactive state the suites leave it in,
 * activate it, and then read `GET /sap/bc/adt/activation/inactiveobjects` in a
 * loop, from the instant the POST returns:
 *
 * - gone on the FIRST read → the work was over before the answer was sent
 * - gone on a LATER read → it settles afterwards, and the elapsed time is the lag
 * - still there at the limit → not asynchrony but a refusal; the checklist says why
 *
 * The list is the only thing that answers "is it active NOW". The POST's own
 * answer cannot: with no `analyse` strategy a refusal arrives as a 200, so
 * `ok === true` covers both "activated" and "refused to activate".
 *
 *   npx ts-node scripts/probe-activation-settle.ts [GROUP] [INCLUDE] [PACKAGE] [TRANSPORT]
 *
 * Defaults come from `test-config.yaml` / `.env`, and the group is created in
 * the configured package if it is not there. Poll period and budget:
 * `PROBE_PERIOD_MS` (default 500) and `PROBE_BUDGET_MS` (default 30000).
 *
 * ---
 *
 * **Measured**, cloud trial, 2026-09-22, `ZAC_PROBE_FUGR` in `ZADT_BLD_PKG03`,
 * four runs, 44 reads of the list across windows of 30s, 8s, 5s and 4s.
 *
 * **Nothing settles late.** On the first run the POST answered
 * `activationExecuted="true"` in 1016ms (`server-time=495662`), and
 * `FUGR/I SAPLZAC_PROBE_FUGR` was already off the list on the read taken at
 * +0ms. Nothing then changed for the remaining 30 seconds. In every later run
 * the list was identical at +0ms and at the end of the window. Whatever the POST
 * does, it has done it by the time it answers.
 *
 * **ADT does have an asynchronous activation protocol, and it is not this one.**
 * Discovery exposes `/sap/bc/adt/activation/runs` and `/activation/results`
 * beside `/activation`; posting the same references to `runs` answers **201**
 * with the run id in `Location`, and `runs/{id}` read straight afterwards
 * already says `runs:status="finished" runs:progressPercentage="100"`. So the
 * shape exists, and for this workload it completes within the first read too.
 *
 * **And which activation clears which entry.** Creating an include puts THREE
 * things on the list: `FUGR/F <group>`, the include, and the regenerated
 * `SAPL<group>`. Activating the GROUP clears only the last of them — the other
 * two stay, and stay through seconds of polling, with both endpoints reporting
 * nothing left to do. Activating the INCLUDE clears the include **and the
 * group's own entry with it**, 3 cycles out of 3.
 *
 * So `FUGR/F` is not stuck and this is not a cloud quirk: the group's entry
 * waits for the parts underneath it, and the group's activation does not reach
 * them. An earlier reading of these runs called it "scope, not timing" and
 * left it there — which was measuring the probe's own leftovers, since an
 * include it had created and not activated was holding the group's entry open
 * the whole time. With nothing inactive underneath, the group's activation
 * clears the group.
 *
 * Which is what the repair in PR #157 does, and why it is right: a suite hands
 * back a group whose include it has already deleted, and activating the group
 * is then the whole of the work.
 *
 * The first version of this loop is worth keeping in mind. It rewrote an
 * existing include instead of creating one, which regenerates nothing, watched
 * for a name it had guessed in advance, saw no work in six cycles — and printed
 * SYNCHRONOUS anyway, over zero observations. Hence both rules now in the code:
 * the work is whatever the list difference says it is, and a run with no work
 * concludes nothing.
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
import { activateFunctionGroup } from '../src/core/functionGroup/activation';
import {
  activateObjectsGroup,
  getActivationResults,
  getActivationRun,
} from '../src/core/shared/groupActivation';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Package and transport come from `test-config.yaml`, through the same
// resolver the suites use — never from a literal in a script. A probe that
// invents a package writes objects somewhere nobody configured, and the
// configuration is where this repository states what may be written to.
const testHelper = require('../src/__tests__/helpers/test-helper');
const fromConfig = (): { packageName: string; transportRequest: string } => ({
  packageName: testHelper.resolvePackageName(undefined) ?? '',
  transportRequest: testHelper.resolveTransportRequest(undefined) ?? '',
});

const PERIOD_MS = Number(process.env.PROBE_PERIOD_MS ?? 500);
const BUDGET_MS = Number(process.env.PROBE_BUDGET_MS ?? 30000);
const CYCLES = Number(process.env.PROBE_CYCLES ?? 0);

const say = (line: string): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

/** The inactive list as it arrives. */
async function inactiveXml(connection: IAbapConnection): Promise<string> {
  const response = await connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/activation/inactiveobjects',
    timeout: 30000,
    headers: {
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    },
  });
  return String(response.data ?? '');
}

/** The whole `ioc:entry` for each of our objects — what the list says, unabridged. */
function rawEntries(xml: string, group: string): string[] {
  const wanted = [group.toUpperCase(), `SAPL${group.toUpperCase()}`];
  return [...xml.matchAll(/<ioc:entry\b[\s\S]*?<\/ioc:entry>/g)]
    .map((m) => m[0])
    .filter((entry) => {
      const name = /adtcore:name="([^"]+)"/.exec(entry)?.[1]?.toUpperCase();
      return name !== undefined && wanted.includes(name);
    });
}

/** The inactive list, as names — the document is `ioc:entry`/`ioc:object`/`ioc:ref`. */
async function inactiveNames(connection: IAbapConnection): Promise<string[]> {
  const xml = await inactiveXml(connection);
  const names: string[] = [];
  const ref =
    /<ioc:ref\b[^>]*?adtcore:name="([^"]+)"[^>]*?adtcore:type="([^"]+)"/g;
  const reversed =
    /<ioc:ref\b[^>]*?adtcore:type="([^"]+)"[^>]*?adtcore:name="([^"]+)"/g;
  for (const m of xml.matchAll(ref)) names.push(`${m[2]} ${m[1]}`);
  for (const m of xml.matchAll(reversed)) names.push(`${m[1]} ${m[2]}`);
  return [...new Set(names)];
}

/**
 * The two entries a function group puts on that list: the group and the main
 * program the server regenerates for it. Matched on the bare name, because the
 * type prefix (`FUGR/F`, `FUGR/I`) is what varies between them.
 */
function stillListed(names: string[], group: string): string[] {
  const wanted = [group.toUpperCase(), `SAPL${group.toUpperCase()}`];
  return names.filter((n) => {
    const bare = n.split(/\s+/).pop()?.toUpperCase() ?? '';
    return wanted.includes(bare);
  });
}

/** What discovery says about the activation resource — a poll endpoint would show here. */
async function activationDiscovery(connection: IAbapConnection): Promise<void> {
  try {
    const response = await connection.makeAdtRequest({
      method: 'GET',
      url: '/sap/bc/adt/discovery',
      timeout: 60000,
      headers: { Accept: 'application/atomsvc+xml' },
    });
    const xml = String(response.data ?? '');
    const hits = [
      ...xml.matchAll(/<[^>]*collection[^>]*href="([^"]*activation[^"]*)"/gi),
    ]
      .map((m) => m[1])
      .concat(
        [...xml.matchAll(/href="([^"]*\/activation[^"]*)"/g)].map((m) => m[1]),
      );
    const unique = [...new Set(hits)];
    say(
      unique.length
        ? `  discovery exposes under activation: ${unique.join(', ')}`
        : '  discovery exposes no activation collection at all',
    );
  } catch (error) {
    say(`  discovery could not be read: ${(error as Error).message}`);
  }
}

async function main(): Promise<void> {
  const [groupArg, includeArg, packageArg, transportArg] =
    process.argv.slice(2);
  const group = (groupArg || 'ZAC_PROBE_FUGR').toUpperCase();
  const include = (includeArg || `L${group}Z99`).toUpperCase();
  const configured = fromConfig();
  const packageName = packageArg || configured.packageName;
  const transportRequest = transportArg || configured.transportRequest;
  if (!packageName) {
    say('no package: name one as the third argument, or set `default_package`');
    say(
      'in src/__tests__/helpers/test-config.yaml. This probe will not guess.',
    );
    process.exitCode = 1;
    return;
  }

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);

  // **What this run created, this run takes away.** An include left behind is
  // not merely untidy: it is inactive, it holds the group's own `FUGR/F` entry
  // open, and the next run then measures that instead of what it came to
  // measure. This probe has already been wrong once for exactly that reason —
  // an earlier reading called the group's entry stuck on cloud while the
  // leftover was holding it.
  let weCreatedTheInclude = false;

  try {
    say(`probe-activation-settle — group ${group}, include ${include}`);
    say(`  objects live in package ${packageName}`);
    say(`  poll every ${PERIOD_MS}ms, budget ${BUDGET_MS}ms`);
    say('');

    say('[1] discovery');
    await activationDiscovery(connection);
    say('');

    say('[2] baseline inactive list');
    const baseline = await inactiveNames(connection);
    say(`  ${baseline.length} object(s) inactive`);
    say(`  ours: ${stillListed(baseline, group).join(', ') || '(none)'}`);
    say('');

    say('[3] the group exists');
    const metadata = await client
      .getFunctionGroup()
      .readMetadata({ functionGroupName: group });
    const present =
      metadata.ok && String(metadata.getResult().value ?? '').trim() !== '';
    if (present) {
      say('  already there');
    } else {
      say(`  absent — creating it in ${packageName}`);
      const created = await client.getFunctionGroup().create({
        functionGroupName: group,
        packageName,
        description: 'Probe: is activation synchronous',
        transportRequest,
      });
      say(`  create ok=${created.ok}`);
      if (!created.ok) {
        say(`  create refused: ${created.getError().message}`);
        say('VERDICT: cannot probe — no function group to activate');
        return;
      }
    }
    say('');

    // **Creating an include is what regenerates `SAPL<group>`; rewriting one
    // is not.** The first version of this step wrote a source into the include
    // whatever its state, which measured nothing — the cycles in [10] show a
    // rewrite leaves the list untouched — and destroyed whatever an existing
    // include held, with no copy kept anywhere. So this creates, and never
    // writes into an include it did not create.
    say('[4] make it inactive by creating an include');
    const existing = await client
      .getFunctionInclude()
      .readMetadata({ functionGroupName: group, includeName: include });
    if (existing.ok && String(existing.getResult().value ?? '').trim() !== '') {
      say(`  ${include} is already there and is left exactly as it is`);
      say('  (nothing is written into an include this probe did not create)');
    } else {
      const madeInclude = await client.getFunctionInclude().create({
        functionGroupName: group,
        includeName: include,
        description: 'Probe include',
        transportRequest,
      });
      // **Only a create that succeeded earns the right to delete.** Setting
      // this before the call meant a refused create still armed the cleanup,
      // and the cleanup would then remove an include this run did not make.
      // Which is not a far-fetched path: the read above answers absence and a
      // not-ready object with the same 200, so the branch can be taken over an
      // include that is already there, the create refuses it as existing, and
      // the tidy-up deletes somebody's object. The same destruction the write
      // was taken out for, re-entering through the clean-up.
      weCreatedTheInclude = madeInclude.ok;
      say(`  include create ok=${madeInclude.ok}`);
      if (!madeInclude.ok) say(`  refused: ${madeInclude.getError().message}`);
    }
    say('');

    say('[5] inactive list after that');
    const dirtied = stillListed(await inactiveNames(connection), group);
    say(`  ours: ${dirtied.join(', ') || '(none)'}`);
    if (dirtied.length === 0) {
      say('  nothing of ours is inactive — the activation below has no work,');
      say('  so this run cannot tell a fast activation from an absent one.');
    }
    say('');

    say('[6] activate the group');
    // The low-level function rather than the client member: the probe wants the
    // wire answer, headers included — `x-sap-adt-profiling` carries the time the
    // server spent inside this request, which is the other half of the evidence.
    const started = Date.now();
    let wire: Awaited<ReturnType<typeof activateFunctionGroup>> | undefined;
    let threw: Error | undefined;
    try {
      wire = await activateFunctionGroup(connection, group);
    } catch (error) {
      threw = error as Error;
    }
    const postMs = Date.now() - started;
    say(`  POST returned after ${postMs}ms`);
    if (threw) {
      say(`  it threw: ${threw.message}`);
    } else if (wire) {
      const headers = (wire.headers ?? {}) as Record<string, string>;
      say(`  status ${wire.status}`);
      say(
        `  x-sap-adt-profiling: ${headers['x-sap-adt-profiling'] ?? '(none)'}`,
      );
      const body = String(wire.data ?? '');
      say(`  body: ${body.replace(/\s+/g, ' ').slice(0, 600)}`);
      const executed = /activationExecuted="([^"]*)"/.exec(body)?.[1];
      const errors = [...body.matchAll(/<msg\b[^>]*type="E"/g)].length;
      say(
        `  activationExecuted=${executed ?? '(absent)'}, msg type="E": ${errors}`,
      );
    }
    say('');

    say('[7] read the list until it clears, or until the budget runs out');
    const pollStart = Date.now();
    let settledAt: number | null = null;
    let reads = 0;
    for (;;) {
      const elapsed = Date.now() - pollStart;
      const ours = stillListed(await inactiveNames(connection), group);
      reads += 1;
      say(
        `  +${String(elapsed).padStart(5)}ms  ${ours.join(', ') || '(clear)'}`,
      );
      if (ours.length === 0) {
        settledAt = elapsed;
        break;
      }
      if (Date.now() - pollStart + PERIOD_MS > BUDGET_MS) break;
      await new Promise((r) => setTimeout(r, PERIOD_MS));
    }
    say('');

    // An entry that outlasts the budget is not a slow activation, and the next
    // two readings say which of the remaining explanations it is: what the list
    // itself claims about the object, and what a SECOND activation answers. A
    // server with nothing left to do says `activationExecuted="false"` — and an
    // object still listed after that is one this request does not reach.
    if (settledAt === null) {
      say('[8] what the list says, and what a second activation answers');
      for (const entry of rawEntries(await inactiveXml(connection), group)) {
        say(`  ${entry.replace(/\s+/g, ' ')}`);
      }
      const again = await activateFunctionGroup(connection, group);
      const body = String(again.data ?? '');
      say(`  second activation: status ${again.status}`);
      say(`  body: ${body.replace(/\s+/g, ' ').slice(0, 600)}`);
      const stillThere = stillListed(await inactiveNames(connection), group);
      say(`  list after it: ${stillThere.join(', ') || '(clear)'}`);
      say('');

      // The other activation endpoint. `/activation` is one POST that answers a
      // checklist; `/activation/runs` starts a **run**, answers its id in
      // `Location`, and has `/runs/{id}` and `/results/{id}` behind it — an
      // asynchronous protocol by construction. Same object references, same
      // URIs (`buildObjectUri` maps `FUGR/F` to the group), so what differs is
      // only which endpoint was asked.
      say('[9] the same references through /activation/runs');
      const refs = stillThere.map((listed) => {
        const [type, name] = listed.split(/\s+/);
        return { type, name };
      });
      say(`  sending: ${refs.map((r) => `${r.type} ${r.name}`).join(', ')}`);
      const runWire = await activateObjectsGroup(connection, refs, false);
      const runHeaders = (runWire.headers ?? {}) as Record<string, string>;
      say(`  status ${runWire.status}`);
      say(`  Location: ${runHeaders.location ?? '(none)'}`);
      say(
        `  body: ${String(runWire.data ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 600)}`,
      );

      // The run id is the whole point of this endpoint: it turns "did it work"
      // into a resource that can be read afterwards. `runs/{id}` says what the
      // run is doing, `results/{id}` what it produced — and for an object the
      // list keeps showing, that pair is the only place the server explains
      // itself.
      const runId = (runHeaders.location ?? '').split('/').pop() ?? '';
      if (runId) {
        const runDoc = await getActivationRun(connection, runId);
        say(
          `  runs/${runId}: ${String(runDoc.data ?? '')
            .replace(/\s+/g, ' ')
            .slice(0, 800)}`,
        );
        const resultsDoc = await getActivationResults(connection, runId);
        say(
          `  results/${runId}: ${String(resultsDoc.data ?? '')
            .replace(/\s+/g, ' ')
            .slice(0, 800)}`,
        );
      }

      const runStart = Date.now();
      for (;;) {
        const elapsed = Date.now() - runStart;
        const ours = stillListed(await inactiveNames(connection), group);
        say(
          `  +${String(elapsed).padStart(5)}ms  ${ours.join(', ') || '(clear)'}`,
        );
        if (ours.length === 0) break;
        if (Date.now() - runStart + PERIOD_MS > BUDGET_MS) break;
        await new Promise((r) => setTimeout(r, PERIOD_MS));
      }
      say('');
    }

    // **One observation is not a measurement**, and the first version of this
    // loop proved it: it rewrote the include's source, watched for `SAPL<group>`
    // by name, found nothing inactive in six cycles, and still printed
    // SYNCHRONOUS — over zero observations. Two things were wrong. Rewriting an
    // existing include does not regenerate the main program; **creating** one
    // does, which is why the very first run saw it and none of the later ones
    // did. And watching for names guessed in advance cannot see work that lands
    // somewhere else.
    //
    // So a cycle now creates the include, takes the whole list before and
    // after, and calls the difference the work — whatever it turns out to be.
    // Then it activates and re-reads at once: an entry that has already gone on
    // that read was finished before the POST answered. The include is deleted
    // again at the end of the cycle, so the next one starts where this began.
    const cycleWork: Array<{
      appeared: string[];
      left: string[];
      lingering: string[];
    }> = [];
    if (CYCLES > 0) {
      say(
        `[10] ${CYCLES} cycle(s) of create \u2192 activate \u2192 read at once`,
      );
      const probeInclude = `L${group}Z98`.toUpperCase();
      for (let n = 1; n <= CYCLES; n += 1) {
        const before = new Set(await inactiveNames(connection));
        const made = await client.getFunctionInclude().create({
          functionGroupName: group,
          includeName: probeInclude,
          description: 'Probe include (created and deleted per cycle)',
          transportRequest,
        });
        const appeared = (await inactiveNames(connection)).filter(
          (name) => !before.has(name),
        );

        const t0 = Date.now();
        const answer = await activateFunctionGroup(connection, group);
        const postMs = Date.now() - t0;
        const executed =
          /activationExecuted="([^"]*)"/.exec(String(answer.data ?? ''))?.[1] ??
          '(absent)';

        const readAt = Date.now();
        const now = new Set(await inactiveNames(connection));
        const readMs = Date.now() - readAt;
        const left = appeared.filter((name) => now.has(name));

        say(
          `  cycle ${n}: create=${made.ok} | went inactive: ${appeared.join(', ') || '(nothing)'}`,
        );
        say(
          `           POST ${postMs}ms activationExecuted=${executed}` +
            ` | read +${readMs}ms, still inactive: ${left.join(', ') || '(none of them)'}`,
        );

        // **Still listed is not the same as not finished.** An entry that is
        // still there can be one the POST had not got to yet, or one this POST
        // was never going to touch, and only waiting separates them: a lag
        // clears on its own, a scope does not. So anything left over is polled
        // for the budget before the cycle says which it was.
        let lingering = left;
        if (left.length > 0) {
          const waitStart = Date.now();
          for (;;) {
            if (Date.now() - waitStart + PERIOD_MS > BUDGET_MS) break;
            await new Promise((r) => setTimeout(r, PERIOD_MS));
            const listed = new Set(await inactiveNames(connection));
            lingering = left.filter((name) => listed.has(name));
            if (lingering.length === 0) {
              say(
                `           cleared on its own after ${Date.now() - waitStart}ms`,
              );
              break;
            }
          }
          if (lingering.length > 0) {
            say(
              `           still listed after ${Date.now() - waitStart}ms: ${lingering.join(', ')}`,
            );
          }
        }
        // **Which activation clears which entry.** The group's own activation
        // leaves the include listed, and the group's entry with it. So the
        // cycle now activates the INCLUDE too and reads the list again: if
        // both go at that point, `FUGR/F` was never stuck — it was waiting for
        // the part underneath it, and the repair a suite owes a borrowed group
        // is to activate what it wrote, not the container.
        const includeAnswer = await client
          .getFunctionInclude()
          .activate({ functionGroupName: group, includeName: probeInclude });
        const afterInclude = stillListed(
          await inactiveNames(connection),
          group,
        );
        const includeGone = !(await inactiveNames(connection)).some((n) =>
          n.endsWith(probeInclude),
        );
        say(
          `           then activating the include itself: ok=${includeAnswer.ok}` +
            ` | include gone=${includeGone}` +
            ` | group entries left: ${afterInclude.join(', ') || '(none)'}`,
        );

        cycleWork.push({ appeared, left, lingering });

        // Same rule as step [4]: the cycle removes the include only if its own
        // create made one. A refused create means something is already there
        // under that name, and deleting it would be this probe destroying an
        // object it never owned.
        if (made.ok) {
          const removed = await client.getFunctionInclude().delete({
            functionGroupName: group,
            includeName: probeInclude,
            transportRequest,
          });
          if (!removed.ok) {
            say(
              `           cleanup: delete refused — ${removed.getError().message}`,
            );
          }
          await activateFunctionGroup(connection, group);
        } else {
          say('           cleanup: nothing to remove, the create was refused');
        }
      }
      say('');
    }

    say('VERDICT');
    if (settledAt === null) {
      say(`  still listed after ${BUDGET_MS}ms and ${reads} read(s).`);
      say('  Not a lag: nothing moved in that window. Step [8] says whether');
      say('  the server thinks there is anything left to activate at all.');
    } else if (reads === 1) {
      say(`  clear on the FIRST read, ${settledAt}ms after the POST returned.`);
      say('  The work was over before the answer was sent: SYNCHRONOUS.');
    } else {
      say(
        `  clear only on read ${reads}, ${settledAt}ms after the POST returned.`,
      );
      say('  The POST answers before the work is finished: ASYNCHRONOUS, and');
      say(`  ${settledAt}ms is the measured lag on this system.`);
    }
    if (cycleWork.length) {
      const withWork = cycleWork.filter((c) => c.appeared.length > 0);
      const unfinished = withWork.filter((c) => c.left.length > 0);
      say('');
      say(
        `  ${withWork.length} of ${cycleWork.length} cycle(s) put something on the list for the activation to do.`,
      );
      if (withWork.length === 0) {
        // The refusal to conclude is the point. A cycle where nothing went
        // inactive cannot distinguish an activation that finished instantly
        // from one that never ran, and counting those as evidence is how the
        // first version of this loop printed a verdict over zero observations.
        say('  None of them is evidence either way: with nothing to activate,');
        say('  a finished POST and an absent one look the same. Not proven.');
      } else if (unfinished.length === 0) {
        say(
          `  In all ${withWork.length}, everything that went inactive was gone on the read`,
        );
        say(
          '  taken straight after the POST. The work finishes inside the request:',
        );
        say('  SYNCHRONOUS.');
      } else {
        const settledLate = unfinished.filter((c) => c.lingering.length === 0);
        const neverSettled = unfinished.filter((c) => c.lingering.length > 0);
        say(
          `  ${unfinished.length} of them still had entries listed on that read.`,
        );
        if (settledLate.length > 0) {
          say(
            `  ${settledLate.length} cleared later with no further request: that is a LAG,`,
          );
          say('  and the per-cycle line above has the milliseconds.');
        }
        if (neverSettled.length > 0) {
          const names = [
            ...new Set(neverSettled.flatMap((c) => c.lingering)),
          ].join(', ');
          say(
            `  ${neverSettled.length} never cleared within the budget: ${names}.`,
          );
          say('  Nothing that waits this long is waiting — this is scope, not');
          say('  timing: the POST names the GROUP, and an include under it is');
          say('  its own object with its own activation. The per-cycle line');
          say(
            '  above says what activating the include then cleared, which on',
          );
          say("  the measured runs was the include AND the group's own entry.");
        }
      }
    }
  } finally {
    if (weCreatedTheInclude) {
      say(`[cleanup] removing ${include}, which this run created`);
      const removed = await client.getFunctionInclude().delete({
        functionGroupName: group,
        includeName: include,
        transportRequest,
      });
      say(`  delete ok=${removed.ok}`);
      if (!removed.ok) say(`  refused: ${removed.getError().message}`);
      // Deleting an include regenerates `SAPL<group>` in its turn, so the
      // group is activated once more — otherwise the tidy-up leaves behind the
      // very thing it was tidying.
      const settled = await activateFunctionGroup(connection, group);
      say(`  group activated again: status ${settled.status}`);
      const left = stillListed(await inactiveNames(connection), group);
      say(`  list on the way out: ${left.join(', ') || '(clear)'}`);
    }
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
