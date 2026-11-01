/**
 * Every metadata read sends the version its caller names — `active`,
 * `inactive` or `workingArea` — as `version=<value>`, beside
 * `withLongPolling=true` when that is asked for too; and a read that names no
 * version sends exactly the request it sent before this rule.
 *
 * Why the caller names it: measured on premise (2026-11-01, read only),
 * a class with an inactive version answered its inactive document to a read
 * with no version, to `inactive` and to `workingArea`, and its active one
 * only to `active`. A read without a version is not "the active version", so
 * a caller who means one says which.
 *
 * Each case asserts the whole URL, so a second `?`, a dropped parameter or a
 * parameter on a read that sent none before is a failure, not a pass.
 */
import type {
  AdtReadVersion,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

interface MetadataRead {
  /** The kind, as the test names it. */
  readonly kind: string;
  /** The read, with the caller's options. */
  readonly read: (
    client: AdtClientOnPrem,
    options: IReadOptions,
  ) => Promise<unknown>;
  /** The object's address, no query. */
  readonly url: string;
  /** The version the read sent before when none is named; none for most. */
  readonly unnamed?: AdtReadVersion;
  /** Whether the read sends `withLongPolling` when it is asked for. */
  readonly longPolling: boolean;
}

const READS: readonly MetadataRead[] = [
  {
    kind: 'class',
    read: (c, o) => c.getClass().readMetadata({ className: 'ZCL_V' }, o),
    url: '/sap/bc/adt/oo/classes/zcl_v',
    longPolling: true,
  },
  {
    kind: 'local types (a class member)',
    read: (c, o) => c.getLocalTypes().readMetadata({ className: 'ZCL_V' }, o),
    url: '/sap/bc/adt/oo/classes/zcl_v',
    longPolling: true,
  },
  {
    kind: 'behavior implementation',
    read: (c, o) =>
      c.getBehaviorImplementation().readMetadata({ className: 'ZBP_V' }, o),
    url: '/sap/bc/adt/oo/classes/zbp_v',
    longPolling: true,
  },
  {
    kind: 'interface',
    read: (c, o) =>
      c.getInterface().readMetadata({ interfaceName: 'ZIF_V' }, o),
    url: '/sap/bc/adt/oo/interfaces/zif_v',
    longPolling: true,
  },
  {
    kind: 'program',
    read: (c, o) => c.getProgram().readMetadata({ programName: 'ZPROG_V' }, o),
    url: '/sap/bc/adt/programs/programs/zprog_v',
    longPolling: true,
  },
  {
    kind: 'include',
    read: (c, o) => c.getInclude().readMetadata({ includeName: 'ZINC_V' }, o),
    url: '/sap/bc/adt/programs/includes/zinc_v',
    longPolling: false,
  },
  {
    kind: 'function group',
    read: (c, o) =>
      c.getFunctionGroup().readMetadata({ functionGroupName: 'ZFG_V' }, o),
    url: '/sap/bc/adt/functions/groups/zfg_v',
    longPolling: true,
  },
  {
    kind: 'function module',
    read: (c, o) =>
      c
        .getFunctionModule()
        .readMetadata(
          { functionGroupName: 'ZFG_V', functionModuleName: 'Z_FM_V' },
          o,
        ),
    url: '/sap/bc/adt/functions/groups/zfg_v/fmodules/z_fm_v',
    longPolling: true,
  },
  {
    kind: 'function include',
    read: (c, o) =>
      c
        .getFunctionInclude()
        .readMetadata(
          { functionGroupName: 'ZFG_V', includeName: 'LZFG_VF01' },
          o,
        ),
    url: '/sap/bc/adt/functions/groups/zfg_v/includes/lzfg_vf01',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'DDL source',
    read: (c, o) => c.getDdl().readMetadata({ ddlName: 'ZDDL_V' }, o),
    url: '/sap/bc/adt/ddic/ddl/sources/zddl_v',
    longPolling: true,
  },
  {
    kind: 'table',
    read: (c, o) => c.getTable().readMetadata({ tableName: 'ZTAB_V' }, o),
    url: '/sap/bc/adt/ddic/tables/ztab_v',
    longPolling: true,
  },
  {
    kind: 'structure',
    read: (c, o) =>
      c.getStructure().readMetadata({ structureName: 'ZSTR_V' }, o),
    url: '/sap/bc/adt/ddic/structures/zstr_v',
    longPolling: true,
  },
  {
    kind: 'append structure',
    read: (c, o) =>
      c.getAppendStructure().readMetadata({ appendStructureName: 'ZAPP_V' }, o),
    url: '/sap/bc/adt/ddic/structures/zapp_v',
    unnamed: 'inactive',
    longPolling: true,
  },
  {
    kind: 'table type',
    read: (c, o) =>
      c.getTableType().readMetadata({ tableTypeName: 'ZTT_V' }, o),
    url: '/sap/bc/adt/ddic/tabletypes/ztt_v',
    longPolling: true,
  },
  {
    kind: 'domain',
    read: (c, o) => c.getDomain().readMetadata({ domainName: 'ZDOM_V' }, o),
    url: '/sap/bc/adt/ddic/domains/zdom_v',
    longPolling: true,
  },
  {
    kind: 'data element',
    read: (c, o) =>
      c.getDataElement().readMetadata({ dataElementName: 'ZDTEL_V' }, o),
    url: '/sap/bc/adt/ddic/dataelements/zdtel_v',
    longPolling: true,
  },
  {
    kind: 'package',
    read: (c, o) => c.getPackage().readMetadata({ packageName: 'ZPKG_V' }, o),
    url: '/sap/bc/adt/packages/zpkg_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'message class',
    read: (c, o) => c.getMessageClass().readMetadata({ name: 'ZMC_V' }, o),
    url: '/sap/bc/adt/messageclass/zmc_v',
    longPolling: true,
  },
  {
    kind: 'service definition',
    read: (c, o) =>
      c
        .getServiceDefinition()
        .readMetadata({ serviceDefinitionName: 'ZSD_V' }, o),
    url: '/sap/bc/adt/ddic/srvd/sources/zsd_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'metadata extension',
    read: (c, o) =>
      c.getMetadataExtension().readMetadata({ name: 'ZMDE_V' }, o),
    url: '/sap/bc/adt/ddic/ddlx/sources/zmde_v',
    longPolling: true,
  },
  {
    kind: 'access control',
    read: (c, o) =>
      c.getAccessControl().readMetadata({ accessControlName: 'ZDCL_V' }, o),
    url: '/sap/bc/adt/acm/dcl/sources/zdcl_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'behavior definition',
    read: (c, o) =>
      c.getBehaviorDefinition().readMetadata({ name: 'ZBDEF_V' }, o),
    url: '/sap/bc/adt/bo/behaviordefinitions/zbdef_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'transformation',
    read: (c, o) =>
      c.getTransformation().readMetadata({ transformationName: 'ZXSLT_V' }, o),
    url: '/sap/bc/adt/xslt/transformations/zxslt_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'scalar function',
    read: (c, o) =>
      c.getScalarFunction().readMetadata({ scalarFunctionName: 'ZSF_V' }, o),
    url: '/sap/bc/adt/ddic/dsfd/sources/zsf_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'scalar function implementation',
    read: (c, o) =>
      c
        .getScalarFunctionImplementation()
        .readMetadata({ implementationName: 'ZSFI_V' }, o),
    url: '/sap/bc/adt/ddic/dsfi/zsfi_v',
    unnamed: 'inactive',
    longPolling: true,
  },
  {
    kind: 'authorization field',
    read: (c, o) =>
      c
        .getAuthorizationField()
        .readMetadata({ authorizationFieldName: 'ZAUTHF_V' }, o),
    url: '/sap/bc/adt/aps/iam/auth/zauthf_v',
    unnamed: 'active',
    longPolling: true,
  },
  {
    kind: 'enhancement',
    read: (c, o) =>
      c
        .getEnhancement()
        .readMetadata(
          { enhancementName: 'ZENH_V', enhancementType: 'enhoxhb' },
          o,
        ),
    url: '/sap/bc/adt/enhancements/enhoxhb/zenh_v',
    longPolling: true,
  },
  {
    kind: 'generic metadata read (getUtils)',
    read: (c, o) =>
      c.getUtils().readObjectMetadata('DOMA/DD', 'ZDOM_V', undefined, o),
    url: '/sap/bc/adt/ddic/domains/zdom_v',
    longPolling: true,
  },
];

const VERSIONS: readonly AdtReadVersion[] = [
  'active',
  'inactive',
  'workingArea',
];

async function sentUrl(
  read: MetadataRead,
  options: IReadOptions,
): Promise<string | undefined> {
  const connection = new RecordingConnection();
  await read.read(new AdtClientOnPrem(connection, noopLogger), options);
  expect(connection.sent).toHaveLength(1);
  return connection.sent[0]?.url;
}

describe.each(READS)('$kind metadata read', (read) => {
  it.each(VERSIONS)('sends version=%s', async (version) => {
    expect(await sentUrl(read, { version })).toBe(
      `${read.url}?version=${version}`,
    );
  });

  it.each(VERSIONS)('sends version=%s beside long polling', async (version) => {
    const longPolling = read.longPolling ? '&withLongPolling=true' : '';
    expect(await sentUrl(read, { version, withLongPolling: true })).toBe(
      `${read.url}?version=${version}${longPolling}`,
    );
  });

  it('sends the request it sent before when no version is named', async () => {
    const before = read.unnamed ? `?version=${read.unnamed}` : '';
    expect(await sentUrl(read, {})).toBe(`${read.url}${before}`);
  });

  it('…and with long polling, the request it sent before', async () => {
    const params: string[] = [];
    if (read.unnamed) {
      params.push(`version=${read.unnamed}`);
    }
    if (read.longPolling) {
      params.push('withLongPolling=true');
    }
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    expect(await sentUrl(read, { withLongPolling: true })).toBe(
      `${read.url}${query}`,
    );
  });
});

/**
 * Two reads hand the version to the connection as `params` rather than in the
 * URL, as they did before: the feature toggle's (which never sends long
 * polling, `featureToggleNoLongPolling.test.ts`) and the service binding's.
 */
describe('reads that pass the version as request params', () => {
  async function sent(
    read: (client: AdtClientOnPrem) => Promise<unknown>,
  ): Promise<{ url?: string; params?: unknown }> {
    const connection = new RecordingConnection();
    await read(new AdtClientOnPrem(connection, noopLogger));
    expect(connection.sent).toHaveLength(1);
    return { url: connection.sent[0]?.url, params: connection.sent[0]?.params };
  }

  it.each(VERSIONS)('feature toggle sends version=%s', async (version) => {
    expect(
      await sent((c) =>
        c
          .getFeatureToggle()
          .readMetadata({ featureToggleName: 'ZFT_V' }, { version }),
      ),
    ).toEqual({
      url: '/sap/bc/adt/sfw/featuretoggles/zft_v',
      params: { version },
    });
  });

  it('feature toggle sends what it sent before when no version is named', async () => {
    expect(
      await sent((c) =>
        c.getFeatureToggle().readMetadata({ featureToggleName: 'ZFT_V' }),
      ),
    ).toEqual({
      url: '/sap/bc/adt/sfw/featuretoggles/zft_v',
      params: { version: 'active' },
    });
  });

  it.each(VERSIONS)('service binding sends version=%s', async (version) => {
    expect(
      await sent((c) =>
        c
          .getServiceBinding()
          .readMetadata({ bindingName: 'ZSB_V' }, { version }),
      ),
    ).toEqual({
      url: '/sap/bc/adt/businessservices/bindings/zsb_v',
      params: { version },
    });
  });

  it('service binding sends what it sent before when no version is named', async () => {
    expect(
      await sent((c) =>
        c.getServiceBinding().readMetadata({ bindingName: 'ZSB_V' }),
      ),
    ).toEqual({
      url: '/sap/bc/adt/businessservices/bindings/zsb_v',
      params: undefined,
    });
  });
});
