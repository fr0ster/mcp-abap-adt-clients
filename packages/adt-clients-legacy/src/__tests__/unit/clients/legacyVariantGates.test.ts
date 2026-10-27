/**
 * The variant gates hold through the legacy overrides (review focus 2 of the
 * ADT type codes plan): `AdtClientLegacy` is `AdtClient<'basis740'>`, every
 * override keeps the base's gate, and the handlers it answers are fixed to
 * `'basis740'`. Each `@ts-expect-error` is a call ADT_TYPES_BASIS_740
 * refuses; `npm run test:check` fails when one compiles. The overrides still
 * refuse at run time, for callers outside the type system.
 *
 * Type-level: the checks sit in a function nothing calls.
 */
import type { AdtClient } from '@mcp-abap-adt/adt-clients';
import type { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

async function legacyVariantGates(legacy: AdtClientLegacy): Promise<void> {
  // The client is the 7.40 variant's.
  const asBase: AdtClient<'basis740'> = legacy;
  void asBase;
  // …and no modern one, so no upcast reopens the gates its overrides keep.
  // @ts-expect-error -- AdtClientLegacy is not AdtClient of the modern variant
  const asModern: AdtClient = legacy;
  void asModern;

  // A factory the variant lacks, through an override that refuses it.
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `table` API
  legacy.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `package` API
  legacy.getPackage();
  legacy.getClass();

  // An operation the API lacks on 7.40, through the handler's override.
  await legacy.getClass().read({ className: 'ZCL_GATE' });
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `deletionCheck`
  await legacy.getClass().checkDeletion(
    { className: 'ZCL_GATE' },
    {
      headers: { accept: 'application/xml', contentType: 'application/xml' },
    },
  );
  // @ts-expect-error -- 7.40's `CLAS/OC` lists no `transport`
  await legacy.getClass().readTransport({ className: 'ZCL_GATE' });
  // @ts-expect-error -- 7.40's `DDLS/DF` lists no `versions`
  await legacy.getDdl().getVersions({ ddlName: 'ZI_GATE' });
  // @ts-expect-error -- 7.40's transport request lists no `createTask`
  await legacy.getRequest().createTask('TRKORR01', {
    headers: { accept: 'application/xml', contentType: 'application/xml' },
    targetUser: 'USER_GATE',
  });

  // A missing parent, through the legacy function module.
  await legacy
    .getFunctionModule()
    .read({ functionGroupName: 'ZFG_GATE', functionModuleName: 'Z_FM_GATE' });
  // @ts-expect-error -- a function module's config names its group
  await legacy.getFunctionModule().read({ functionModuleName: 'Z_FM_GATE' });
}

it('the legacy variant gates are type-checked by npm run test:check', () => {
  expect(typeof legacyVariantGates).toBe('function');
});
