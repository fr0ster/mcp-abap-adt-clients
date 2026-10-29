/**
 * The objects the generic ABAP Unit runner's live suites
 * (`integration/core/unitTest/AbapUnit*Run.test.ts`) create, run and delete:
 * a global class with one passing test in its testclasses include, and a CDS
 * view entity with a container class whose local test class is assigned to
 * it (`"! @testing <view>`).
 *
 * Each run names its objects afresh ({@link freshSuffix}), so a run never
 * meets an object of an earlier one. They go into the local package the
 * suite's case names: on premise a `$` package, which registers nothing in
 * CTS — a transportable package makes SAP record the changes in a request it
 * generates. Every delete is read back: the object must be absent.
 *
 * **A suite deletes only what it created.** Each create records the object in
 * the suite's {@link IProbeOwnership} right after SAP accepted it, and the
 * cleanup deletes only what is recorded there: a refused create — a name
 * taken by an object of someone else's — leaves that object alone.
 */

import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { AdtClient } from '../../clients/AdtClient';
import { integrationHeadersOf } from './adtHeaders';
import { cleanupRefusal, expectResult, releasing } from './contract';
import { judged } from './judged';
import { presenceOf } from './objectPresence';

/** Where a probe goes: the local package and its request (`""` for none). */
export interface IProbePlace {
  readonly packageName: string;
  readonly transportRequest: string;
}

/** The objects a suite created, recorded as each create succeeds. */
export interface IProbeOwnership {
  readonly classes: string[];
  readonly views: string[];
}

/** Nothing created yet. */
export function noProbesOwned(): IProbeOwnership {
  return { classes: [], views: [] };
}

/**
 * Delete and read back what the suite owns — the classes first (a container
 * class names its view), then the views — and nothing else. Each answer is
 * `''` or what went wrong, for `raiseAfterCleanup`.
 */
export async function removeOwned(
  client: AdtClient,
  place: IProbePlace,
  owned: IProbeOwnership,
): Promise<string[]> {
  const refusals: string[] = [];
  for (const className of owned.classes)
    refusals.push(await removeClass(client, place, className));
  for (const viewName of owned.views)
    refusals.push(await removeView(client, place, viewName));
  return refusals;
}

/**
 * Six upper-case characters of base 36 from the clock and a random part: a
 * name no earlier run used.
 */
export function freshSuffix(): string {
  const clock = Date.now().toString(36).slice(-3);
  const random = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .padStart(3, '0');
  return `${clock}${random}`.toUpperCase();
}

/** The test method every probe's test class holds, as ADT spells it. */
export const PROBE_TEST_METHOD = 'PASSES';

/**
 * The test methods of an abapunit result, class and method names upper-cased
 * as ADT spells them, each with the alerts under it.
 */
export function ranMethods(
  methods: readonly { testClass: string; name: string; alerts: string[] }[],
): { testClass: string; name: string; alerts: string[] }[] {
  return methods.map((method) => ({
    testClass: method.testClass.toUpperCase(),
    name: method.name.toUpperCase(),
    alerts: method.alerts,
  }));
}

/** A class with one method, its test class calling it. */
export function classSources(className: string): {
  source: string;
  testClassSource: string;
} {
  const name = className.toLowerCase();
  return {
    source: `CLASS ${name} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS add IMPORTING a TYPE i b TYPE i RETURNING VALUE(result) TYPE i.
ENDCLASS.

CLASS ${name} IMPLEMENTATION.
  METHOD add.
    result = a + b.
  ENDMETHOD.
ENDCLASS.`,
    testClassSource: `CLASS ltc_probe DEFINITION FINAL FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    METHODS passes FOR TESTING.
ENDCLASS.

CLASS ltc_probe IMPLEMENTATION.
  METHOD passes.
    cl_abap_unit_assert=>assert_equals( act = NEW ${name}( )->add( a = 1 b = 1 ) exp = 2 ).
  ENDMETHOD.
ENDCLASS.`,
  };
}

/** A view entity over `I_Language`, keyed by `Language`. */
export function viewSource(viewName: string): string {
  return `@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'ABAP Unit generic runner probe'
define view entity ${viewName}
  as select from I_Language
{
  key Language
}`;
}

/** The assigned test class's method that fails on purpose, as ADT spells it. */
export const FAILING_TEST_METHOD = 'FAILS_ON_PURPOSE';

/**
 * A container class's local test class, assigned to the view: one method that
 * passes, one that fails on purpose — a failure alert shows a method executed.
 */
export function assignedTestSources(
  className: string,
  viewName: string,
): { source: string; testClassSource: string } {
  const name = className.toLowerCase();
  return {
    source: `CLASS ${name} DEFINITION PUBLIC FINAL CREATE PUBLIC.
ENDCLASS.

CLASS ${name} IMPLEMENTATION.
ENDCLASS.`,
    testClassSource: `"! @testing ${viewName}
CLASS ltc_view DEFINITION FINAL FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    METHODS passes FOR TESTING.
    METHODS fails_on_purpose FOR TESTING.
ENDCLASS.

CLASS ltc_view IMPLEMENTATION.
  METHOD passes.
    cl_abap_unit_assert=>assert_equals( act = 1 exp = 1 ).
  ENDMETHOD.
  METHOD fails_on_purpose.
    cl_abap_unit_assert=>assert_equals( act = 1 exp = 2 ).
  ENDMETHOD.
ENDCLASS.`,
  };
}

/** Create a class, write its source and its testclasses include, activate it. */
export async function createClassWithTests(
  client: AdtClient,
  place: IProbePlace,
  owned: IProbeOwnership,
  className: string,
  sources: { source: string; testClassSource: string },
): Promise<void> {
  const config = { className, transportRequest: place.transportRequest };
  expectResult(
    await client.getClass().create(
      {
        className,
        packageName: place.packageName,
        transportRequest: place.transportRequest,
        description: 'ABAP Unit generic runner probe',
      },
      {
        analyse: analyseException,
        headers: integrationHeadersOf(client.getClass(), 'create'),
      },
    ),
    `create class ${className}`,
  );
  // Accepted: from here on the class is this suite's to delete.
  owned.classes.push(className);
  const sourceHandle = String(
    expectResult(
      await client.getClass().lock(config, { analyse: analyseException }),
      `lock class ${className}`,
    ),
  );
  await releasing(
    async () =>
      expectResult(
        await client.getClass().update(config, {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getClass(), 'update'),
          source: sources.source,
          lockHandle: sourceHandle,
        }),
        `write class ${className}`,
      ),
    () =>
      client
        .getClass()
        .unlock(config, sourceHandle, { analyse: analyseException }),
    `unlock class ${className}`,
  );
  // A class include is written under the class's own lock.
  const includeHandle = String(
    expectResult(
      await client.getClass().lock(config, { analyse: analyseException }),
      `lock class ${className} for its testclasses include`,
    ),
  );
  await releasing(
    async () =>
      expectResult(
        await client.getLocalTestClass().update(config, {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getLocalTestClass(), 'update'),
          source: sources.testClassSource,
          lockHandle: includeHandle,
        }),
        `write the testclasses include of ${className}`,
      ),
    () =>
      client
        .getClass()
        .unlock(config, includeHandle, { analyse: analyseException }),
    `unlock class ${className} after its testclasses include`,
  );
  expectResult(
    await client.getClass().activate(config, {
      analyse: judged(analyseActivation),
      headers: integrationHeadersOf(client.getClass(), 'activate'),
    }),
    `activate class ${className}`,
  );
}

/** Create a view entity, write its source, activate it. */
export async function createView(
  client: AdtClient,
  place: IProbePlace,
  owned: IProbeOwnership,
  viewName: string,
): Promise<void> {
  const config = {
    ddlName: viewName,
    transportRequest: place.transportRequest,
  };
  expectResult(
    await client.getDdl().create(
      {
        ddlName: viewName,
        packageName: place.packageName,
        transportRequest: place.transportRequest,
        description: 'ABAP Unit generic runner probe',
      },
      {
        analyse: analyseException,
        headers: integrationHeadersOf(client.getDdl(), 'create'),
      },
    ),
    `create view ${viewName}`,
  );
  // Accepted: from here on the view is this suite's to delete.
  owned.views.push(viewName);
  const handle = String(
    expectResult(
      await client.getDdl().lock(config, { analyse: analyseException }),
      `lock view ${viewName}`,
    ),
  );
  await releasing(
    async () =>
      expectResult(
        await client.getDdl().update(config, {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getDdl(), 'update'),
          source: viewSource(viewName),
          lockHandle: handle,
        }),
        `write view ${viewName}`,
      ),
    () => client.getDdl().unlock(config, handle, { analyse: analyseException }),
    `unlock view ${viewName}`,
  );
  expectResult(
    await client.getDdl().activate(config, {
      analyse: judged(analyseActivation),
      headers: integrationHeadersOf(client.getDdl(), 'activate'),
    }),
    `activate view ${viewName}`,
  );
}

/**
 * Delete a class and read it back: `''` when it is gone (or never was), else
 * what went wrong, for `raiseAfterCleanup`.
 */
export async function removeClass(
  client: AdtClient,
  place: IProbePlace,
  className: string,
): Promise<string> {
  const refused = await cleanupRefusal(
    () =>
      client.getClass().delete(
        { className, transportRequest: place.transportRequest },
        {
          analyse: judged(analyseDeletion),
          headers: integrationHeadersOf(client.getClass(), 'delete'),
        },
      ),
    `delete class ${className}`,
  );
  if (refused) return refused;
  const presence = presenceOf(
    await client
      .getClass()
      .read({ className }, undefined, { analyse: analyseException }),
    `class ${className}`,
  );
  if (presence.present === false) return '';
  return presence.present === true
    ? `class ${className} is still there after its delete`
    : presence.reason;
}

/** Delete a view and read it back, as {@link removeClass}. */
export async function removeView(
  client: AdtClient,
  place: IProbePlace,
  viewName: string,
): Promise<string> {
  const refused = await cleanupRefusal(
    () =>
      client.getDdl().delete(
        { ddlName: viewName, transportRequest: place.transportRequest },
        {
          analyse: judged(analyseDeletion),
          headers: integrationHeadersOf(client.getDdl(), 'delete'),
        },
      ),
    `delete view ${viewName}`,
  );
  if (refused) return refused;
  const presence = presenceOf(
    await client
      .getDdl()
      .read({ ddlName: viewName }, undefined, { analyse: analyseException }),
    `view ${viewName}`,
  );
  if (presence.present === false) return '';
  return presence.present === true
    ? `view ${viewName} is still there after its delete`
    : presence.reason;
}

/** The local package and request of a case, both required. */
export function probePlace(params: {
  package_name?: unknown;
  transport_request?: unknown;
}): IProbePlace {
  const packageName = params.package_name;
  const transportRequest = params.transport_request;
  if (typeof packageName !== 'string' || packageName.trim() === '') {
    throw new Error('params.package_name (the local package) is not set');
  }
  if (typeof transportRequest !== 'string') {
    throw new Error(
      'params.transport_request is not set ("" for a local package)',
    );
  }
  return { packageName: packageName.trim(), transportRequest };
}
