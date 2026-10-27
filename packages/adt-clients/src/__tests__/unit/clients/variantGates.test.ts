/**
 * A call the variant does not serve does not compile (review focus 2 of the
 * ADT type codes plan). Each `@ts-expect-error` is a call the ADT type tables
 * refuse for the receiver's variant; `npm run test:check` fails when one of
 * them compiles, and the call beside it that the tables serve must compile.
 * The legacy override's checks are in `adt-clients-legacy`.
 *
 * Type-level: the checks sit in a function nothing calls. The one runtime
 * assertion keeps Jest from reporting an empty file.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtClient } from '../../../clients/AdtClient';
import type {
  AdtClientCloud,
  AdtClientOnPrem,
} from '../../../clients/AdtClientVariants';
import { createAdtClient } from '../../../clients/createAdtClient';
import { buildObjectUri } from '../../../utils/activationUtils';

async function variantGates(
  onprem: AdtClientOnPrem,
  cloud: AdtClientCloud,
  modern: AdtClient,
  basis740: AdtClient<'basis740'>,
  connection: IAbapConnection,
): Promise<void> {
  // A factory the variant lacks: 7.40's table has no `table`.
  onprem.getTable();
  cloud.getTable();
  modern.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `table` API
  basis740.getTable();
  // @ts-expect-error -- ADT_TYPES_BASIS_740 serves no `package` API
  basis740.getPackage();

  // An operation the API lacks: a function group has no source to read, and
  // a program include no check — on any variant.
  // @ts-expect-error -- `functionGroup` lists no `read`
  onprem.getFunctionGroup().read;
  // @ts-expect-error -- `include` lists no `check`
  onprem.getInclude().check;
  // …and one the API lacks on one variant: 7.40's `ddl` lists no `versions`.
  await onprem.getDdl().getVersions({ ddlName: 'ZI_GATE' });
  // @ts-expect-error -- ADT_TYPES_BASIS_740's `ddl` lists no `versions`
  await basis740.getDdl().getVersions({ ddlName: 'ZI_GATE' });

  // An operation one code of the API lacks: only `ENHO/XHH` reads source.
  await onprem
    .getEnhancement()
    .read({ enhancementName: 'ZENH_GATE', enhancementType: 'enhoxhh' });
  await onprem.getEnhancement().read({
    enhancementName: 'ZENH_GATE',
    // @ts-expect-error -- `ENHO/XHB` lists no `read`
    enhancementType: 'enhoxhb',
  });

  // A missing parent: a function module is addressed under its group.
  await onprem
    .getFunctionModule()
    .read({ functionGroupName: 'ZFG_GATE', functionModuleName: 'Z_FM_GATE' });
  // @ts-expect-error -- a function module's config names its group
  await onprem.getFunctionModule().read({ functionModuleName: 'Z_FM_GATE' });
  buildObjectUri('Z_FM_GATE', 'FUGR/FF', 'ZFG_GATE');
  // @ts-expect-error -- FUGR/FF is addressed under its parent
  buildObjectUri('Z_FM_GATE', 'FUGR/FF');

  // A 7.40 client is no modern one, so no upcast reopens a gate.
  // @ts-expect-error -- AdtClient<'basis740'> is not an AdtClient of the modern variant
  const upcast: AdtClient = basis740;
  void upcast;
  // The variants are invariant to each other, the narrower one included: a
  // gate's receiver is compared both ways. A consumer names one variant.
  // @ts-expect-error -- AdtClientOnPrem is not AdtClient of the modern variant
  const narrowed: AdtClient = onprem;
  void narrowed;

  // `createAdtClient` answers the declared variant's client.
  const declared: AdtClientCloud = await createAdtClient(connection, {
    variant: 'cloud',
  });
  void declared;
}

it('the variant gates are type-checked by npm run test:check', () => {
  expect(typeof variantGates).toBe('function');
});
