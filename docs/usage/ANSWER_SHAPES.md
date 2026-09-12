# What ADT actually answers

This is evidence, not advice. Every row below is a recorded exchange — request,
status, headers and body — captured from a running system and kept as a file, so
that a consumer choosing a failure strategy chooses from measurements rather than
from this package's opinion.

The recordings live in this repository under [`corpus/adt/`](../../corpus): one
`.json` per step carrying the request and the response metadata, beside a
`.body.xml` or `.body.txt` with the payload as it arrived. Case names say what
each demonstrates — `refusal-check-nonexistent-object`,
`refusal-validation-name-taken-ddl`, and so on.

Collect them with `npm run corpus:capture`, which drives this package's own
public surface and records each raw exchange above the layer that adds
credentials. The same corpus is kept in the consumer repository as well — see
[`corpus/README.md`](../../corpus/README.md) for why both copies exist.

**Why this document exists.** `@mcp-abap-adt/adt-clients` ships no error
strategy. That is not modesty: it is the only defensible position once these
answers are laid side by side, because no single rule reads them all correctly.

## A refusal is usually not a status

Ten recorded refusals arrive inside a **2xx**. The status says the conversation
succeeded, which it did — the server understood the question and answered it. The
answer is "no".

| what was refused | status | how the "no" is written |
|---|---|---|
| activation of a class with a syntax error | 200 | `<chkl:messages>` with `<msg type="E">` |
| a check of a class that does not exist | 200 | `<chkrun:checkReport chkrun:status="notProcessed">` |
| a check of source with a syntax error | 200 | `<chkrun:checkMessage>` entries |
| deleting a class held by another session | 200 | `<del:deletionResult>` with `del:isDeleted="false"` |
| a deletion check on that class | 200 | `<del:checkResponse>` with `del:isDeletable="false"` |
| validating a DDL name already taken | 200 | `<asx:abap>` with `<SEVERITY>ERROR</SEVERITY>` |
| validating a function group name already taken | 200 | the same `asx:abap` shape |
| a node structure for a package that is not there | 200 | **an empty body** |

Seven recorded refusals arrive as a status instead:

| what was refused | status | body |
|---|---|---|
| locking a class another session holds | 403 | `<exc:exception>` |
| reading the source of a class that does not exist | 404 | `<exc:exception>` |
| reading a package that does not exist | 404 | `<exc:exception>` |
| writing without a valid lock handle | 423 | `<exc:exception>` |
| validating a class name already taken | 400 | `<exc:exception type="InvalidClifName">` |
| validating a domain name already taken | 400 | `<exc:exception>` |
| validating a table name already taken | 400 | `<exc:exception>` |

## The same question, two different answers

Read the last rows of both tables together.

**"Is this name already taken?"** is one question, asked of one endpoint family,
and the server answers it two ways depending on the object type:

| type | status | shape |
|---|---|---|
| class | 400 | `exc:exception`, `InvalidClifName` |
| domain | 400 | `exc:exception` |
| table | 400 | `exc:exception` |
| DDL source | **200** | `asx:abap`, `SEVERITY` = `ERROR` |
| function group | **200** | `asx:abap`, `SEVERITY` = `ERROR` |

A strategy that treats a non-2xx as the failure gets three of these right and
misses two — silently, reporting a taken name as available. A strategy that reads
`SEVERITY` gets those two and has nothing to read in the other three. Neither is
wrong; they are answers to different systems' habits, and which you need depends
on which types you touch.

**This is why the failure strategy is a parameter of the call.** It is not a
configuration knob that was left open for flexibility's sake.

## Two answers that are indistinguishable

Worth knowing before writing any rule of your own.

**A clean check and a check of something absent.** Both HTTP 200, both with zero
messages. Only `chkrun:status` differs:

| asked about | `chkrun:status` | `chkrun:statusText` | messages |
|---|---|---|---|
| a class that exists and compiles | `processed` | `Object … has been checked` | 0 |
| a class that does not exist | `notProcessed` | `Resource CLASS … does not exist.` | 0 |

Count messages and these are the same answer. `src/__tests__/integration/shared/checkRun.test.ts`
asserts the distinction.

**An empty package and a package that is not there.** `/repository/nodestructure`
answers `200` with an empty body for both. The status cannot separate them and
there is no document to read. `/sap/bc/adt/packages/{name}` can: it answers `404`
for a name that was never created and `200` with a document for one that exists
and is empty.

## What this package does with all of it

Nothing, and deliberately.

- **No error strategy ships.** `nothingIsARefusal` is the only one here, and it
  finds none: every exchange that produced an answer comes back as a success
  carrying it. A request that never completed is still a failure — there is no
  answer to read.
- **The reading is injected**, once, at construction. The shipped defaults hand
  back the document for almost everything, because a document is the one shape
  that loses nothing.
- **The verdict is injected** per call, through `analyse`, because whether an
  answer is a failure depends on what you were doing when you asked.

Build both from the corpus above, against the types and the system you actually
use. Reading this package's source will tell you what it does; it will not tell
you what your server says.

**If you have no opinion yet**, `@mcp-abap-adt/adt-strategies` has one. It lives
in this repository under `packages/adt-strategies`, ships six shapes derived
from the recordings above, and each one is tested against the refusal it came
from *and* the success it has to be told apart from. Take it, or take `firstOf`
and assemble your own.

## See also

- [`MIGRATION-19.md`](MIGRATION-19.md) — what moved to the consumer in 19.0.0
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — answers that are accurate about
  the wrong thing, including the `S_ABPLNGVS` language-version refusal
- [`../../examples`](../../examples) — the sequences, written out
