/**
 * A small real development, built through this library, onto a transport.
 *
 * The suites create one object at a time, in `$TMP`-like local packages, and
 * take it away again. That never asks the question a consumer actually has:
 * can you build a *thing* — several objects that depend on each other, in a
 * package that transports, recorded on a request — and does it run afterwards.
 *
 * The thing is a library loan register, chosen because it needs exactly the
 * shape that hurts: an interface, an implementation of it, a value object, a
 * service that composes both, and a runnable entry point. Five objects, four
 * dependency edges, so activation order is not a detail — a class cannot
 * activate before what it references.
 *
 *   ZIF_AC_LOAN_POLICY        the rule: when is it due, what is the fine
 *   ZCL_AC_LOAN_ITEM          one loan
 *   ZCL_AC_LOAN_POLICY_STD    14 days, 5 per day late          -> the interface
 *   ZCL_AC_LOAN_REGISTER      issue / take back / count open   -> item + policy
 *   ZCL_AC_LOAN_DEMO          if_oo_adt_classrun runner        -> all of them
 *
 * Usage:
 *
 *   npx ts-node scripts/dev-loan-register.ts ZAC_TR_PKG E19K906816
 *   npx ts-node scripts/dev-loan-register.ts ZAC_TR_PKG E19K906816 --update-request=E19K906818
 *   npx ts-node scripts/dev-loan-register.ts ZAC_TR_PKG E19K906816 --clean
 *
 * Idempotent: an object that already exists is updated rather than created, so
 * a re-run is a second development cycle on the same five objects.
 *
 * **A re-run alone does not show that the change landed on the request.** The
 * creates put every object into that request already, so the listing afterwards
 * looks the same whether `update` carried the transport or dropped it.
 * `--update-request` is what separates them: the updates go to a second
 * request, its contents are read before and after, and an object appearing in
 * the second listing and not the first is the observation. Without the flag the
 * script says so rather than implying a result.
 *
 * The run at the end is the point. Activation answering ok says the objects
 * compile; only executing them says the development works. The expected output
 * is asserted, so a silent wrong answer fails rather than prints.
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
import { AdtExecutor } from '../src/clients/AdtExecutor';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

type Kind = 'interface' | 'class';

interface Artefact {
  kind: Kind;
  name: string;
  description: string;
  source: string;
}

const POLICY_INTERFACE = `INTERFACE zif_ac_loan_policy
  PUBLIC.

  METHODS due_date
    IMPORTING iv_issued_on  TYPE d
    RETURNING VALUE(rv_due) TYPE d.

  METHODS fine
    IMPORTING iv_due         TYPE d
              iv_returned    TYPE d
    RETURNING VALUE(rv_fine) TYPE i.

ENDINTERFACE.`;

const LOAN_ITEM = `CLASS zcl_ac_loan_item DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    METHODS constructor
      IMPORTING iv_book      TYPE string
                iv_borrower  TYPE string
                iv_issued_on TYPE d.
    METHODS book RETURNING VALUE(rv_book) TYPE string.
    METHODS borrower RETURNING VALUE(rv_borrower) TYPE string.
    METHODS issued_on RETURNING VALUE(rv_on) TYPE d.
    METHODS take_back IMPORTING iv_on TYPE d.
    METHODS is_open RETURNING VALUE(rv_open) TYPE abap_bool.

  PRIVATE SECTION.
    DATA mv_book        TYPE string.
    DATA mv_borrower    TYPE string.
    DATA mv_issued_on   TYPE d.
    DATA mv_returned_on TYPE d.

ENDCLASS.

CLASS zcl_ac_loan_item IMPLEMENTATION.

  METHOD constructor.
    mv_book      = iv_book.
    mv_borrower  = iv_borrower.
    mv_issued_on = iv_issued_on.
  ENDMETHOD.

  METHOD book.
    rv_book = mv_book.
  ENDMETHOD.

  METHOD borrower.
    rv_borrower = mv_borrower.
  ENDMETHOD.

  METHOD issued_on.
    rv_on = mv_issued_on.
  ENDMETHOD.

  METHOD take_back.
    mv_returned_on = iv_on.
  ENDMETHOD.

  METHOD is_open.
    IF mv_returned_on IS INITIAL.
      rv_open = abap_true.
    ELSE.
      rv_open = abap_false.
    ENDIF.
  ENDMETHOD.

ENDCLASS.`;

const POLICY_STD = `CLASS zcl_ac_loan_policy_std DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES zif_ac_loan_policy.
    CONSTANTS c_loan_days    TYPE i VALUE 14.
    CONSTANTS c_fine_per_day TYPE i VALUE 5.

ENDCLASS.

CLASS zcl_ac_loan_policy_std IMPLEMENTATION.

  METHOD zif_ac_loan_policy~due_date.
    rv_due = iv_issued_on + c_loan_days.
  ENDMETHOD.

  METHOD zif_ac_loan_policy~fine.
    IF iv_returned <= iv_due.
      rv_fine = 0.
    ELSE.
      rv_fine = ( iv_returned - iv_due ) * c_fine_per_day.
    ENDIF.
  ENDMETHOD.

ENDCLASS.`;

const REGISTER = `CLASS zcl_ac_loan_register DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    METHODS constructor
      IMPORTING io_policy TYPE REF TO zif_ac_loan_policy.

    METHODS issue
      IMPORTING iv_book        TYPE string
                iv_borrower    TYPE string
                iv_on          TYPE d
      RETURNING VALUE(ro_loan) TYPE REF TO zcl_ac_loan_item.

    METHODS take_back
      IMPORTING iv_book        TYPE string
                iv_on          TYPE d
      RETURNING VALUE(rv_fine) TYPE i.

    METHODS open_count RETURNING VALUE(rv_count) TYPE i.

  PRIVATE SECTION.
    DATA mo_policy TYPE REF TO zif_ac_loan_policy.
    DATA mt_loans  TYPE STANDARD TABLE OF REF TO zcl_ac_loan_item WITH EMPTY KEY.

ENDCLASS.

CLASS zcl_ac_loan_register IMPLEMENTATION.

  METHOD constructor.
    mo_policy = io_policy.
  ENDMETHOD.

  METHOD issue.
    ro_loan = NEW zcl_ac_loan_item(
      iv_book      = iv_book
      iv_borrower  = iv_borrower
      iv_issued_on = iv_on ).
    APPEND ro_loan TO mt_loans.
  ENDMETHOD.

  METHOD take_back.
    DATA lv_due TYPE d.
    LOOP AT mt_loans INTO DATA(lo_loan).
      IF lo_loan->book( ) = iv_book AND lo_loan->is_open( ) = abap_true.
        lo_loan->take_back( iv_on ).
        lv_due = mo_policy->due_date( lo_loan->issued_on( ) ).
        rv_fine = mo_policy->fine( iv_due      = lv_due
                                   iv_returned = iv_on ).
        RETURN.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD open_count.
    LOOP AT mt_loans INTO DATA(lo_loan).
      IF lo_loan->is_open( ) = abap_true.
        rv_count = rv_count + 1.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.`;

const DEMO = `CLASS zcl_ac_loan_demo DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.

ENDCLASS.

CLASS zcl_ac_loan_demo IMPLEMENTATION.

  METHOD if_oo_adt_classrun~main.
    DATA(lo_policy)   = NEW zcl_ac_loan_policy_std( ).
    DATA(lo_register) = NEW zcl_ac_loan_register( lo_policy ).

    DATA(lv_issued) = CONV d( '20260901' ).

    DATA(lo_first) = lo_register->issue( iv_book     = 'ABAP to the Future'
                                         iv_borrower = 'OKYSLYTSIA'
                                         iv_on       = lv_issued ).
    DATA(lo_second) = lo_register->issue( iv_book     = 'Clean ABAP'
                                          iv_borrower = 'OKYSLYTSIA'
                                          iv_on       = lv_issued ).

    out->write( |open after issuing: { lo_register->open_count( ) }| ).

    DATA(lv_late) = lo_register->take_back( iv_book = 'Clean ABAP'
                                            iv_on   = CONV d( '20260920' ) ).
    out->write( |late return fine: { lv_late }| ).

    DATA(lv_ontime) = lo_register->take_back( iv_book = 'ABAP to the Future'
                                              iv_on   = CONV d( '20260910' ) ).
    out->write( |on time fine: { lv_ontime }| ).

    out->write( |open at end: { lo_register->open_count( ) }| ).
  ENDMETHOD.

ENDCLASS.`;

/** Dependency order. Nothing here may be built before what it references. */
const ARTEFACTS: Artefact[] = [
  {
    kind: 'interface',
    name: 'ZIF_AC_LOAN_POLICY',
    description: 'Loan policy: due dates and fines',
    source: POLICY_INTERFACE,
  },
  {
    kind: 'class',
    name: 'ZCL_AC_LOAN_ITEM',
    description: 'One book loan',
    source: LOAN_ITEM,
  },
  {
    kind: 'class',
    name: 'ZCL_AC_LOAN_POLICY_STD',
    description: 'Standard loan policy: 14 days, 5 per day late',
    source: POLICY_STD,
  },
  {
    kind: 'class',
    name: 'ZCL_AC_LOAN_REGISTER',
    description: 'Loan register: issue, take back, count open',
    source: REGISTER,
  },
  {
    kind: 'class',
    name: 'ZCL_AC_LOAN_DEMO',
    description: 'Runnable demo of the loan register',
    source: DEMO,
  },
];

/** What the demo must print. A wrong number is a failure, not an observation. */
const EXPECTED = [
  'open after issuing: 2',
  'late return fine: 25',
  'on time fine: 0',
  'open at end: 0',
];

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function handlerFor(client: AdtClient, a: Artefact) {
  return a.kind === 'interface' ? client.getInterface() : client.getClass();
}

function configFor(a: Artefact, pkg: string, request: string) {
  const base = {
    packageName: pkg,
    transportRequest: request,
    description: a.description,
  };
  return a.kind === 'interface'
    ? { ...base, interfaceName: a.name }
    : { ...base, className: a.name };
}

/**
 * Create it, or write over it if it is already there.
 *
 * Not a convenience: a second run has to be a *change* to existing objects,
 * because "does an update land on the request" is half the question being
 * asked, and a script that only ever creates can never answer it.
 */
async function build(
  client: AdtClient,
  a: Artefact,
  pkg: string,
  request: string,
  updateRequest?: string,
): Promise<boolean> {
  // biome-ignore lint/suspicious/noExplicitAny: two handler contracts, one flow
  const handler = handlerFor(client, a) as any;
  const config = configFor(a, pkg, request);
  // The update goes to its own request when one was given. With a single
  // request the object is already listed there after the create, so a listing
  // that does not change afterwards is equally consistent with the update
  // carrying the transport and with it dropping the value — the question this
  // script exists to answer cannot be answered that way.
  const updateConfig = updateRequest
    ? configFor(a, pkg, updateRequest)
    : config;

  // `create` makes the object and nothing else. Passing `sourceCode` to it no
  // longer compiles — interfaces 38.0.0 took the field off the member and the
  // concrete handlers followed — but it used to, and it was ignored on the
  // wire: measured here, a class created with a full body came back as ADT's
  // empty skeleton, and the demo then refused to run, "a class must implement
  // IF_OO_ADT_CLASSRUN", because it did not. The source is a write, and a
  // write needs a lock.
  const created = await handler.create(config);
  let state = 'created';
  if (!created.ok) {
    const why = created.getError().message ?? '';
    if (!/exist/i.test(why)) {
      say(`  ${a.name.padEnd(24)} CREATE REFUSED: ${why}`);
      return false;
    }
    state = 'existed';
  }

  const lock = await handler.lock(config);
  if (!lock.ok) {
    say(`  ${a.name.padEnd(24)} LOCK REFUSED: ${lock.getError().message}`);
    return false;
  }
  const handle = String(lock.getResult().value ?? '');
  // The unlock is in a `finally`. A throw between the lock and the release
  // leaves a real object locked on a real system, the lock survives a session
  // recycle, and the next run's write is answered 403 with nothing visibly
  // holding it — only the unlock clears it.
  let updated: { ok: boolean; getError(): { message: string } };
  let unlockRefused = '';
  try {
    updated = await handler.update(updateConfig, {
      sourceCode: a.source,
      lockHandle: handle,
    });
  } finally {
    const released = await handler.unlock(config, handle);
    if (released && released.ok === false) {
      unlockRefused = released.getError().message;
      say(`  ${a.name.padEnd(24)} UNLOCK REFUSED: ${unlockRefused}`);
    }
  }
  if (!updated.ok) {
    say(`  ${a.name.padEnd(24)} UPDATE REFUSED: ${updated.getError().message}`);
    return false;
  }
  // A refused unlock ends the run. Printing it and carrying on let the script
  // exit 0 having left an object locked, which is worse than a failure: the
  // next run's write is answered 403 by an object nothing appears to hold, and
  // the message that explained it has scrolled past.
  if (unlockRefused) return false;
  say(`  ${a.name.padEnd(24)} ${state}, source written`);

  const activated = await handler.activate(config);
  if (!activated.ok) {
    say(
      `  ${a.name.padEnd(24)} ACTIVATE REFUSED: ${activated.getError().message}`,
    );
    return false;
  }
  return true;
}

async function remove(
  client: AdtClient,
  a: Artefact,
  pkg: string,
  request: string,
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: two handler contracts, one flow
  const handler = handlerFor(client, a) as any;
  const config = configFor(a, pkg, request);
  const answer = await handler.delete(config);
  say(
    `  ${a.name.padEnd(24)} ${answer.ok ? 'deleted' : `NOT deleted: ${answer.getError().message}`}`,
  );
}

/** The objects a request holds — `tm:abap_object`, and `.value`, not the wrapper. */
async function requestContents(
  connection: IAbapConnection,
  logger: ReturnType<typeof createConnectionLogger>,
  request: string,
): Promise<string[]> {
  const answer = await new AdtClient(connection, logger)
    .getRequest()
    .readMetadata({ transportNumber: request, description: '' });
  if (!answer.ok) return [`(unreadable: ${answer.getError().message})`];
  const xml = String(answer.getResult().value ?? '');
  const seen = [
    ...xml.matchAll(/tm:name="([^"]+)"[^>]*tm:wbtype="([^"]+)"/g),
  ].map(([, name, type]) => `${type} ${name}`);
  return [...new Set(seen)].sort();
}

async function main(): Promise<void> {
  const [pkg, request, ...rest] = process.argv.slice(2);
  if (!pkg || !request) {
    say(
      'usage: dev-loan-register.ts <package> <requestNumber> ' +
        '[--update-request=<requestNumber>] [--clean]',
    );
    process.exitCode = 1;
    return;
  }
  const clean = rest.includes('--clean');
  const updateRequest = rest
    .find((r) => r.startsWith('--update-request='))
    ?.slice('--update-request='.length);

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const client = new AdtClient(connection, logger);

  try {
    say(`\nrequest ${request} before: `);
    for (const o of await requestContents(connection, logger, request)) {
      say(`  ${o}`);
    }
    if (updateRequest) {
      say(`\nrequest ${updateRequest} before (the updates go here):`);
      for (const o of await requestContents(
        connection,
        logger,
        updateRequest,
      )) {
        say(`  ${o}`);
      }
    }

    if (clean) {
      say('\nremoving, dependents first:');
      for (const a of [...ARTEFACTS].reverse()) {
        await remove(client, a, pkg, request);
      }
      return;
    }

    say(`\nbuilding into ${pkg} on ${request}, in dependency order:`);
    for (const a of ARTEFACTS) {
      if (!(await build(client, a, pkg, request, updateRequest))) {
        say('\nstopped: a dependency did not come up.');
        process.exitCode = 1;
        return;
      }
    }

    say(`\nrequest ${request} after:`);
    for (const o of await requestContents(connection, logger, request)) {
      say(`  ${o}`);
    }
    if (updateRequest) {
      say(`\nrequest ${updateRequest} after (the updates went here):`);
      for (const o of await requestContents(
        connection,
        logger,
        updateRequest,
      )) {
        say(`  ${o}`);
      }
      say(
        '\nCompare the two listings for ' +
          `${updateRequest}. An object appearing in the second and not the ` +
          'first is what shows the update carried its transport.',
      );
    } else {
      say(
        '\nThe update half is UNPROVEN in this run: creates and updates shared ' +
          `${request}, so every object was already listed there before the ` +
          'first update. Re-run with --update-request=<another request>.',
      );
    }

    say('\nrunning ZCL_AC_LOAN_DEMO:');
    const run = await new AdtExecutor(connection, logger)
      .getClassExecutor()
      .run({ className: 'ZCL_AC_LOAN_DEMO' });
    if (!run.ok) {
      say(`  RUN REFUSED: ${run.getError().message}`);
      process.exitCode = 1;
      return;
    }
    const output = String(run.getResult().value ?? '');
    for (const line of output.split('\n').filter((l) => l.trim())) {
      say(`  | ${line.trim()}`);
    }

    const missing = EXPECTED.filter((e) => !output.includes(e));
    say(
      missing.length === 0
        ? '\nall four expected lines present — the development works'
        : `\nWRONG OUTPUT, missing: ${missing.join(' | ')}`,
    );
    if (missing.length > 0) process.exitCode = 1;
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`\nfailed: ${(error as Error).message}`);
  process.exitCode = 1;
});
