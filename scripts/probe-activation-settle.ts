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
 * **And the surprise: activating a group does not clear `FUGR/F` here.** After
 * the first activation the group's own entry stayed on the list through every
 * run, while both endpoints insisted there was nothing to do —
 * `checkExecuted="false" activationExecuted="false" generationExecuted="true"`,
 * zero `msg` children, from `/activation` and from `results/{id}` alike. The
 * entry reads `ioc:deleted="false"`, `adtcore:type="FUGR/F"`, and an empty
 * `<ioc:transport/>`. So on this system a repair that activates the group
 * removes the regenerated `SAPL<group>` and leaves the group itself listed —
 * and neither `ok` nor `activationExecuted` can tell you that, which is the
 * whole reason the list is read here instead of the answer.
 *
 * PR #157 measured both entries clearing on an on-premise system. Whether the
 * difference is the system or the object's history is open, and this probe is
 * how to settle it there: run it and read step [7].
 *
 * **The cycles say the same thing from nine more observations.** Creating an
 * include puts two entries on the list — the include itself and the regenerated
 * `SAPL<group>`. Activating the group answers `activationExecuted="true"` in
 * 748–1386ms, and on the read taken straight after, 526–965ms later,
 * `SAPL<group>` is **always** already gone: 9 cycles out of 9, over two runs.
 * Nothing about this endpoint ever answered ahead of its own work.
 *
 * What stays behind is the include, and it stays for good: polled for ~5.5s in
 * each of four cycles, it never cleared. That is scope rather than timing — the
 * POST names the GROUP, and an include under it is its own object with its own
 * activation. Which is the lesson for the repair in PR #157: activating the
 * group is not the same as activating what was written inside it.
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
  const packageName = packageArg || process.env.SAP_PACKAGE || 'ZADT_BLD_PKG03';
  const transportRequest = transportArg || process.env.SAP_TRANSPORT || '';

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);

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

    // Writing an include is what the FunctionInclude suite does, and what makes
    // the server regenerate `SAPL<group>`. It is therefore the state the
    // question is actually about — not a freshly created group, which is
    // inactive for a simpler reason.
    say('[4] make it inactive by writing an include');
    const existing = await client
      .getFunctionInclude()
      .readMetadata({ functionGroupName: group, includeName: include });
    if (
      !existing.ok ||
      String(existing.getResult().value ?? '').trim() === ''
    ) {
      const madeInclude = await client.getFunctionInclude().create({
        functionGroupName: group,
        includeName: include,
        description: 'Probe include',
        transportRequest,
      });
      say(`  include create ok=${madeInclude.ok}`);
      if (!madeInclude.ok) say(`  refused: ${madeInclude.getError().message}`);
    } else {
      say('  include already there');
    }

    const lock = await client
      .getFunctionInclude()
      .lock({ functionGroupName: group, includeName: include });
    if (!lock.ok) {
      say(`  lock refused: ${lock.getError().message}`);
      say('VERDICT: cannot probe — could not write the include');
      return;
    }
    const lockHandle = lock.getResult().value;
    const stamp = new Date().toISOString();
    const written = await client.getFunctionInclude().update(
      { functionGroupName: group, includeName: include, transportRequest },
      {
        lockHandle,
        sourceCode: `*&---------------------------------------------------------------------*\n*& Include ${include}\n*&---------------------------------------------------------------------*\nDATA: gv_probe TYPE string VALUE '${stamp}'.\n`,
      },
    );
    say(`  write ok=${written.ok}`);
    await client
      .getFunctionInclude()
      .unlock({ functionGroupName: group, includeName: include }, lockHandle);
    say('');

    say('[5] inactive list after the write');
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
        cycleWork.push({ appeared, left, lingering });

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
          say('  Nothing that waits this long is waiting. Those entries are');
          say('  outside what this POST activates — scope, not timing. The');
          say('  activation this probe sends names the GROUP, and an include');
          say('  under it is its own object with its own activation.');
        }
      }
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
