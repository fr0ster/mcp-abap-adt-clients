# Decisions, and why

Every entry here is a choice that could reasonably have gone the other way. The
point is not the choice — it is the reasoning and the evidence, so that whoever
meets the question next can tell a decision from an accident, and can reopen one
without re-deriving it from scratch.

**Adding an entry.** One per decision, in the shape used below, and it starts
from the **problem** — the thing that was actually hit, not the principle it
illustrates. Then what was decided, what it was decided *against*, why, and what
would change it. An entry that cannot name what would overturn it is a
preference, not a decision; an entry that cannot name the problem is a rule
somebody invented.

**This file replaces committed run logs and probe captures.** Those used to be
landed under `docs/evidence/` and kept. They should not be: a log is the raw
material a decision is made from, and once the decision is written the log is a
large file nobody reads, carrying whatever the run happened to print. What is
worth keeping is what/how/why — and the log itself stays in git history for
anyone who wants to check the distillation.

**Superseding.** Do not delete an entry. Mark it superseded and link to the one
that replaces it: the history of a reversed decision is the most useful part of
it.

The **contract's** decisions — what belongs in a type, what a capability atom
may state — live in `@mcp-abap-adt/interfaces`, in its own `DECISIONS.md`.
Entries here are about this implementation.

---

## 1. A method the factory cannot return is not API

**Problem.** `getProfiler()` is typed `IProfiler`. Four methods on the concrete
`Profiler` class — `latestTraceId()`, `listTraceIds()`,
`listTraceFilesResponse()`, `listTraceFiles()` — were not in that contract, so
no consumer could call them. One had a caller inside this package; three had
none. Meanwhile the gap they appeared to fill (getting the newest trace) was
reported as unmet, because for anyone outside it was.

**Decided.** Removed, in 15.0.0. A capability reaches consumers through the
contract the factory returns, or it does not exist.

**Against.** Keeping them as a documented "advanced" surface reachable by
casting to the concrete class, or widening `IProfiler` to include them.

**Why.** An unreachable method is worse than a missing one: it reads as coverage
in the class, so nobody writes the thing that is actually needed. It also
invites the cast, and a cast in a test is a test reaching past the contract it
exists to check — `ProgramExecutor.test.ts` had exactly that, with a comment
explaining that the contract "does not carry `latestTraceId()` yet".

**What would change it.** A consumer need that the contract cannot express. Then
the answer is to widen the contract, not to re-add a method beside it.

---

## 2. A removal ships with a replacement a consumer can import

**Problem.** The migration published for decision 1 was `list()` reduced with
`compareRecordedAt`. That function existed and `src/index.ts` did not re-export
it, so the documented migration would not have compiled. The gate meant to catch
this passed, because it matched documented names against every identifier
anywhere under `src`.

**Decided.** `compareRecordedAt` is public since 15.0.0, and `check:docs`
measures each documented import against the surface of the package it is
imported *from* — this package against what `src/index.ts` reaches through its
barrels, each dependency against its own `types` entry.

**Against.** Telling consumers to write the comparison themselves, and treating
the doc gate as a linter rather than a proof.

**Why.** Comparing `recordedAt` as text is wrong across UTC offsets — `09:00:00Z`
is later than `10:00:00+02:00` and sorts lower — so "write it yourself" hands
every consumer the same subtle bug. And a gate that reports nothing is
indistinguishable from a gate that finds nothing: this one had two holes at once
(pooled packages, and `import type` unread) and still printed success.

**What would change it.** Nothing about the rule. The gate's strictness would
change if a documented snippet legitimately needed an internal path — it can,
via a relative import, which is measured against the loose set on purpose.

---

## 3. Unmeasured behaviour is stated as unmeasured

**Problem.** `delete(traceId)` was added against a measured `DELETE` that
answers `200`. What a **missing** id answers was never measured.

**Decided.** The signature is `Promise<void>`, which describes the resolved
value and says nothing about failure; a `404` rejects like any transport error,
and the CHANGELOG and the reference both say the case is unmeasured, so a caller
that must tolerate it has to catch.

**Against.** Swallowing `404` to make deletion idempotent — the shape most
delete APIs take.

**Why.** Idempotence here would be a guess dressed as a guarantee. HTTP's
idempotence is about server state, not about the status a second call returns,
so "DELETE is idempotent" does not license us to invent the response. One
request on an on-prem system settles it; until then the honest contract is the
one that does not claim.

**What would change it.** That one request.

---

## 4. Assertions are the proof; a run log is not

**Problem.** The integration test for `delete()` polls the feed until the id is
gone, and its verdict lines are missing from the run log — a passing test whose
own evidence is invisible. Two plausible explanations were tested and **both
were wrong**: `process.stdout.write` followed by `process.exit()` loses nothing
on this platform, to a pipe or a file, at 1 MB; and a jest suite writing 2000
lines at the end of its last test kept them all.

**Decided.** No logging machinery was added. The mechanism is recorded where the
test is, and the test's assertion stands as the proof.

**Against.** Making the helper write synchronously to fd 1, or writing a verdict
file per run.

**Why.** The RFC run showed what actually happens: the line survives but lands
*after* jest's `Ran all test suites` summary. Progress written straight to
stdout from a jest worker reaches the parent through an asynchronous relay that
`forceExit: true` does not wait for — a race the last test loses. A fix built on
either of the two disproved theories would have added machinery that changes
nothing. And a green test already proves the loop ran: `stillListed` starts
`true`, so the assertion could not pass otherwise.

**What would change it.** Dropping `forceExit`, which needs the open handles
after a SAP run dealt with first.

---

## 5. Only what a run makes is a run's to delete

**Problem.** The delete test needs a trace. The suite already resolves one —
possibly discovered from the feed rather than produced by this run — and these
tests run against systems other people are using.

**Decided.** Deletion is scoped to `traceIdFromThisRun`, set only by the
profiled run, never to the discovered id. When the run produced nothing, the
test skips.

**Against.** Reusing the id the reading tests already resolved.

**Why.** On a shared system the newest trace in the feed belongs to whoever
profiled last. Taking it away mid-analysis is a test damaging someone's work to
assert something about itself.

**What would change it.** Nothing. It costs one variable.

---

## 6. A concrete system never stands in for a value

**Problem.** `buildDumpIdPrefix` documented itself with a real hostname and a
real SID, and two unit tests asserted the resulting string — one specific
machine named as sample data, in a public repository. The same host reached
committed run logs, because `globalSetup` prints the URL it checked.

**Decided.** Placeholders (`HOSTNAME`, `SID`) in code and tests. Run logs are
not kept in the tree at all — see the note at the top of this file.

**Against.** Keeping the real values because they came from a real run and
therefore "document reality".

**Why.** Nothing in the assertion depended on the host being real: the function
concatenates four arguments, and a placeholder shows that better, because it
names what the argument is for instead of where somebody once ran it.

**Deliberately not covered.** The ~35 comments reading "Measured on E19 <date>:
…" stay. Those are not identifiers the code uses; they are the provenance of a
measured fact, and stripping them would leave assertions about SAP with no
record of where the answer came from.

**What would change it.** A decision that provenance must go too — a different
question, and one this entry does not settle.
