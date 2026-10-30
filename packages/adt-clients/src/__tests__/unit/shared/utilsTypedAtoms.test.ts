/**
 * `getUtils()` satisfies interfaces-adt's typed atoms, per variant.
 *
 * `IAdtTypedGroupLifecycle<…, V>` and `IAdtTypedWhereUsed<…, V>` take the
 * references each request serves on variant `V`: `VIEW/DV` among their codes,
 * `parentName` required for a parented code (`FUGR/FF`). A consumer that
 * composes its contract from them — the server's client contract does — needs
 * `AdtUtils<R, V>` to be assignable to them, for its own `V`. `AdtUtils` does
 * not list them in `implements`: while `V` is open the compiler cannot relate
 * the two code sets (interfaces-adt's are keyed by `V`), so each variant is
 * held here.
 *
 * Three things are checked, at compile time (`npm run test:check`):
 * - the library's code sets equal the contract's, per variant, both ways;
 * - `AdtUtils<R, V>` is assignable to both atoms of `V`, for `'onprem'`,
 *   `'cloud'`, `'basis740'` and the modern default;
 * - what the references refuse: a function module without its group, a code
 *   the operation does not take on the variant (`MSAG/NN`, `FUGR/I`).
 *
 * One runtime case per accepted group-only code proves the address it is sent
 * under; the rest is type-level, in a function nothing calls.
 */
import type {
  AdtGroupActivationCode,
  AdtGroupDeletionCheckCode,
  AdtGroupDeletionCode,
  AdtVariant,
  AdtWhereUsedCode as AdtWhereUsedContractCode,
  IAdtTypedGroupLifecycle,
  IAdtTypedWhereUsed,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtModernVariant } from '../../../clients/variant';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import type {
  AdtActivationCode,
  AdtDeletionCheckCode,
  AdtDeletionCode,
  AdtWhereUsedCode,
} from '../../../core/shared/codeSets';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

type R = typeof utilDocuments;

/** `true` exactly when `A` and `B` are the same set. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Every one of the library's four code sets equals the contract's on `V`. */
type SetsEqual<V extends AdtVariant> = readonly [
  Same<AdtActivationCode<V>, AdtGroupActivationCode<V>>,
  Same<AdtDeletionCheckCode<V>, AdtGroupDeletionCheckCode<V>>,
  Same<AdtDeletionCode<V>, AdtGroupDeletionCode<V>>,
  Same<AdtWhereUsedCode<V>, AdtWhereUsedContractCode<V>>,
];

const ALL_EQUAL = [true, true, true, true] as const;

/** Both typed atoms of variant `V`, over the shipped result set. */
type TypedAtoms<V extends AdtVariant> = IAdtTypedGroupLifecycle<
  ReturnType<R['activation']>,
  ReturnType<R['deletionCheck']>,
  ReturnType<R['deletion']>,
  V
> &
  IAdtTypedWhereUsed<
    ReturnType<R['whereUsed']>,
    ReturnType<R['whereUsedScope']>,
    V
  >;

// Compiles only when the library's sets are the contract's.
const onpremSets: SetsEqual<'onprem'> = ALL_EQUAL;
const cloudSets: SetsEqual<'cloud'> = ALL_EQUAL;
const basis740Sets: SetsEqual<'basis740'> = ALL_EQUAL;
const modernSets: SetsEqual<AdtModernVariant> = ALL_EQUAL;

// Compiles only when `AdtUtils<R, V>` is each atom of `V`.
function onprem(utils: AdtUtils<R, 'onprem'>): TypedAtoms<'onprem'> {
  return utils;
}
function cloud(utils: AdtUtils<R, 'cloud'>): TypedAtoms<'cloud'> {
  return utils;
}
function basis740(utils: AdtUtils<R, 'basis740'>): TypedAtoms<'basis740'> {
  return utils;
}
function modern(
  utils: AdtUtils<R, AdtModernVariant>,
): TypedAtoms<AdtModernVariant> {
  return utils;
}

const headers = { accept: 'application/xml', contentType: 'application/xml' };

/** What the references take and refuse. Type-level: never called. */
async function referenceChecks(
  utils: AdtUtils<R, 'onprem'>,
  utils740: AdtUtils<R, 'basis740'>,
): Promise<void> {
  // A function module names its group…
  await utils.activateObjectsGroup(
    [{ type: 'FUGR/FF', name: 'Z_FM', parentName: 'ZFG' }],
    false,
    { headers },
  );
  // …and without it the reference does not compile (spec 2.3).
  await utils.activateObjectsGroup(
    // @ts-expect-error -- `FUGR/FF` requires `parentName`
    [{ type: 'FUGR/FF', name: 'Z_FM' }],
    false,
    { headers },
  );
  await utils.deleteObjectsGroup(
    // @ts-expect-error -- `FUGR/FF` requires `parentName`
    [{ type: 'FUGR/FF', name: 'Z_FM' }],
    undefined,
    { headers },
  );

  // `VIEW/DV`, a group-only code, in every member the utility table lists it for.
  await utils.activateObjectsGroup([{ type: 'VIEW/DV', name: 'ZV' }], false, {
    headers,
  });
  await utils.deleteObjectsGroup([{ type: 'VIEW/DV', name: 'ZV' }], undefined, {
    headers,
  });
  await utils.getWhereUsed(
    { object_name: 'ZV', object_type: 'VIEW/DV' },
    { headers },
  );
  await utils740.activateObjectsGroup(
    [{ type: 'VIEW/DV', name: 'ZV' }],
    false,
    { headers },
  );

  // A code an operation does not take on the variant.
  await utils.activateObjectsGroup(
    // @ts-expect-error -- a message class message has no address of its own
    [{ type: 'MSAG/NN', name: 'ZMC' }],
    false,
    { headers },
  );
  await utils.getWhereUsed(
    // @ts-expect-error -- where-used has no field for a function include's group
    { object_name: 'ZI', object_type: 'FUGR/I' },
    { headers },
  );
  // `DEVC/K` is activated on a modern variant only: 7.40's utility table
  // lists it for the node structure alone.
  await utils.activateObjectsGroup([{ type: 'DEVC/K', name: 'ZP' }], false, {
    headers,
  });
  await utils740.activateObjectsGroup(
    // @ts-expect-error -- 7.40 lists no group activation for `DEVC/K`
    [{ type: 'DEVC/K', name: 'ZP' }],
    false,
    { headers },
  );
}

describe('getUtils() and the typed atoms', () => {
  it('holds the compile checks above', () => {
    // Type-level: what matters is that this file compiles.
    expect([onpremSets, cloudSets, basis740Sets, modernSets]).toEqual([
      ALL_EQUAL,
      ALL_EQUAL,
      ALL_EQUAL,
      ALL_EQUAL,
    ]);
    expect(
      [onprem, cloud, basis740, modern, referenceChecks].map((f) => typeof f),
    ).toEqual(['function', 'function', 'function', 'function', 'function']);
  });

  it('sends VIEW/DV under /sap/bc/adt/ddic/views in a group activation', async () => {
    const connection = new RecordingConnection();
    const utils = new AdtUtils<R, 'onprem'>(connection, {
      logger: noopLogger,
      results: utilDocuments,
    });
    await utils.activateObjectsGroup([{ type: 'VIEW/DV', name: 'ZV' }], false, {
      headers,
    });
    expect(connection.sent).toHaveLength(1);
    expect(String(connection.sent[0]?.data)).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/views/zv" adtcore:type="VIEW/DV" adtcore:name="ZV"',
    );
  });

  it('sends VIEW/DV as the where-used object', async () => {
    const connection = new RecordingConnection();
    const utils = new AdtUtils<R, 'cloud'>(connection, {
      logger: noopLogger,
      results: utilDocuments,
    });
    await utils.getWhereUsed(
      { object_name: 'ZV', object_type: 'VIEW/DV' },
      { headers },
    );
    expect(connection.sent).toHaveLength(1);
    expect(String(connection.sent[0]?.url)).toContain(
      encodeURIComponent('/sap/bc/adt/ddic/views/zv'),
    );
  });
});
