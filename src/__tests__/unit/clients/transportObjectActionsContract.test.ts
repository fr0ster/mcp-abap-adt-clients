/**
 * Type-level only: `@ts-expect-error` asserts the call is a COMPILE error. If
 * the requirement is ever loosened, the directive itself errors as unused.
 *
 * **These exist because the contract used to permit two calls that cannot
 * work.** While this package depended on `@mcp-abap-adt/interfaces` 45.1.0,
 * `getRequest()` answered a type where `createTask`'s whole options argument
 * and `removeObject`'s `position` were optional — so both shapes below
 * type-checked for a consumer, and both were measured against an on-premise
 * system on 2026-09-21 to be impossible: the first is refused with an empty
 * user name, the second answers `200` and removes nothing.
 *
 * The implementation was corrected first, which left `getRequest()` handing
 * back a contract that disagreed with the object behind it. `interfaces-adt`
 * 2.0.0 settled that, and this file is what keeps them agreeing.
 */

import type { AdtClient } from '../../../clients/AdtClient';
import { headersOf } from '../../helpers/adtHeaders';
import { transportParsing } from '../../helpers/transportParsing';

() => {
  const c = null as unknown as AdtClient;

  // @ts-expect-error createTask needs targetUser: without it the server
  // resolves the owner to an empty name and refuses.
  c.getRequest().createTask('DEVK905941');

  // @ts-expect-error and naming the options without the user is no better.
  c.getRequest().createTask('DEVK905941', {});

  // @ts-expect-error removeObject needs the position: without it the server
  // answers 200 and removes nothing.
  c.getRequest().removeObject('DEVK905942', { name: 'ZCL_X', type: 'CLAS' });

  // What a caller writes instead — the reading that produces the position,
  // and the removal that consumes it. No error expected on either.
  c.getRequest().readObjects('DEVK905942');
  c.getRequest().removeObject(
    'DEVK905942',
    {
      name: 'ZCL_X',
      type: 'CLAS',
      position: '000025',
    },
    { headers: headersOf(c.getRequest(), 'removeObject') },
  );
  c.getRequest().createTask('DEVK905941', {
    headers: headersOf(c.getRequest(), 'createTask'),
    targetUser: 'DEVELOPER',
  });

  // An entry being added does not exist yet, so it has no position to give.
  c.getRequest().addObject(
    'DEVK905942',
    { name: 'ZCL_X', type: 'CLAS' },
    { headers: headersOf(c.getRequest(), 'addObject') },
  );

  // **A listed entry is not removable on sight.** `readObjects` answers
  // `position?: string`, because an entry the server described without one
  // exists and filling it with `''` would be a call that removes nothing
  // while reporting success. Spreading an entry straight into `removeObject`
  // therefore does not compile: the caller is asked what to do about the
  // entry that has no position.
  void (async () => {
    const listed = await c
      .getRequest(transportParsing)
      .readObjects('DEVK905942');
    if (!listed.ok) return;
    const [entry] = listed.getResult().value;
    // @ts-expect-error position is optional on a listed entry, required here
    await c.getRequest().removeObject('DEVK905942', { ...entry });

    // Narrowed, it compiles — and that narrowing is the point.
    if (entry.position !== undefined)
      await c
        .getRequest()
        .removeObject(
          'DEVK905942',
          { ...entry, position: entry.position },
          { headers: headersOf(c.getRequest(), 'removeObject') },
        );
  })();
};

it('the transport object-action contract compiles as asserted', () =>
  expect(true).toBe(true));
