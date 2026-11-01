/**
 * Every source read takes the version as interfaces-adt 25 types it —
 * `AdtReadVersion`: `active`, `inactive` or `workingArea` — and sends
 * `workingArea` to `?version=` as it sends the other two. A read given
 * `active`, `inactive` or nothing sends exactly the request it sent before:
 * the class includes and the enhancement still ask for an `inactive` source
 * as `workingArea`, the metadata extension still sends no version for
 * `active`, and the reads that default a missing version still default it.
 *
 * Each case asserts the whole URL (or the request params, for the reads that
 * pass the version that way), so a second `?` or a dropped parameter fails.
 */
import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** What each version sends: the query after the address, `''` for none. */
interface Queries {
  readonly none: string;
  readonly active: string;
  readonly inactive: string;
  readonly workingArea: string;
}

interface SourceRead {
  readonly kind: string;
  readonly read: (
    client: AdtClientOnPrem,
    version: AdtReadVersion | undefined,
  ) => Promise<unknown>;
  readonly url: string;
  readonly queries: Queries;
}

/** A read that sends the version it is given and nothing without one. */
const AS_GIVEN: Queries = {
  none: '',
  active: '?version=active',
  inactive: '?version=inactive',
  workingArea: '?version=workingArea',
};

/** A read that defaults a missing version to `active`. */
const ACTIVE_BY_DEFAULT: Queries = { ...AS_GIVEN, none: '?version=active' };

/** A read that defaults a missing version to `inactive`. */
const INACTIVE_BY_DEFAULT: Queries = { ...AS_GIVEN, none: '?version=inactive' };

/** A read whose resource names its inactive version `workingArea`. */
const INACTIVE_IS_WORKING_AREA: Queries = {
  none: '?version=active',
  active: '?version=active',
  inactive: '?version=workingArea',
  workingArea: '?version=workingArea',
};

const READS: readonly SourceRead[] = [
  {
    kind: 'class',
    read: (c, v) => c.getClass().read({ className: 'ZCL_V' }, v),
    url: '/sap/bc/adt/oo/classes/zcl_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'class local types',
    read: (c, v) => c.getLocalTypes().read({ className: 'ZCL_V' }, v),
    url: '/sap/bc/adt/oo/classes/zcl_v/includes/implementations',
    queries: INACTIVE_IS_WORKING_AREA,
  },
  {
    kind: 'class local definitions',
    read: (c, v) => c.getLocalDefinitions().read({ className: 'ZCL_V' }, v),
    url: '/sap/bc/adt/oo/classes/zcl_v/includes/definitions',
    queries: INACTIVE_IS_WORKING_AREA,
  },
  {
    kind: 'class local macros',
    read: (c, v) => c.getLocalMacros().read({ className: 'ZCL_V' }, v),
    url: '/sap/bc/adt/oo/classes/zcl_v/includes/macros',
    queries: INACTIVE_IS_WORKING_AREA,
  },
  {
    kind: 'class local test classes',
    read: (c, v) => c.getLocalTestClass().read({ className: 'ZCL_V' }, v),
    url: '/sap/bc/adt/oo/classes/zcl_v/includes/testclasses',
    queries: INACTIVE_IS_WORKING_AREA,
  },
  {
    kind: 'behavior implementation',
    read: (c, v) =>
      c.getBehaviorImplementation().read({ className: 'ZBP_V' }, v),
    url: '/sap/bc/adt/oo/classes/zbp_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'interface',
    read: (c, v) => c.getInterface().read({ interfaceName: 'ZIF_V' }, v),
    url: '/sap/bc/adt/oo/interfaces/zif_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'program',
    read: (c, v) => c.getProgram().read({ programName: 'ZPROG_V' }, v),
    url: '/sap/bc/adt/programs/programs/zprog_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'include',
    read: (c, v) => c.getInclude().read({ includeName: 'ZINC_V' }, v),
    url: '/sap/bc/adt/programs/includes/zinc_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'function group',
    read: (c, v) =>
      c.getFunctionGroup().read({ functionGroupName: 'ZFG_V' }, v),
    url: '/sap/bc/adt/functions/groups/zfg_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'function module',
    read: (c, v) =>
      c
        .getFunctionModule()
        .read({ functionGroupName: 'ZFG_V', functionModuleName: 'Z_FM_V' }, v),
    url: '/sap/bc/adt/functions/groups/zfg_v/fmodules/z_fm_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'function include',
    read: (c, v) =>
      c
        .getFunctionInclude()
        .read({ functionGroupName: 'ZFG_V', includeName: 'LZFG_VF01' }, v),
    url: '/sap/bc/adt/functions/groups/zfg_v/includes/lzfg_vf01/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'DDL source',
    read: (c, v) => c.getDdl().read({ ddlName: 'ZDDL_V' }, v),
    url: '/sap/bc/adt/ddic/ddl/sources/zddl_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'table',
    read: (c, v) => c.getTable().read({ tableName: 'ZTAB_V' }, v),
    url: '/sap/bc/adt/ddic/tables/ztab_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'structure',
    read: (c, v) => c.getStructure().read({ structureName: 'ZSTR_V' }, v),
    url: '/sap/bc/adt/ddic/structures/zstr_v/source/main',
    queries: AS_GIVEN,
  },
  {
    kind: 'append structure',
    read: (c, v) =>
      c.getAppendStructure().read({ appendStructureName: 'ZAPP_V' }, v),
    url: '/sap/bc/adt/ddic/structures/zapp_v/source/main',
    queries: INACTIVE_BY_DEFAULT,
  },
  {
    kind: 'service definition',
    read: (c, v) =>
      c.getServiceDefinition().read({ serviceDefinitionName: 'ZSD_V' }, v),
    url: '/sap/bc/adt/ddic/srvd/sources/zsd_v/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'metadata extension',
    read: (c, v) => c.getMetadataExtension().read({ name: 'ZMDE_V' }, v),
    url: '/sap/bc/adt/ddic/ddlx/sources/zmde_v/source/main',
    queries: { ...AS_GIVEN, active: '' },
  },
  {
    kind: 'access control',
    read: (c, v) =>
      c.getAccessControl().read({ accessControlName: 'ZDCL_V' }, v),
    url: '/sap/bc/adt/acm/dcl/sources/zdcl_v/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'behavior definition',
    read: (c, v) => c.getBehaviorDefinition().read({ name: 'ZBDEF_V' }, v),
    url: '/sap/bc/adt/bo/behaviordefinitions/zbdef_v/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'transformation',
    read: (c, v) =>
      c.getTransformation().read({ transformationName: 'ZXSLT_V' }, v),
    url: '/sap/bc/adt/xslt/transformations/zxslt_v/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'scalar function',
    read: (c, v) =>
      c.getScalarFunction().read({ scalarFunctionName: 'ZSF_V' }, v),
    url: '/sap/bc/adt/ddic/dsfd/sources/zsf_v/source/main',
    queries: ACTIVE_BY_DEFAULT,
  },
  {
    kind: 'scalar function implementation',
    read: (c, v) =>
      c
        .getScalarFunctionImplementation()
        .read({ implementationName: 'ZSFI_V' }, v),
    url: '/sap/bc/adt/ddic/dsfi/zsfi_v/source/main',
    queries: INACTIVE_BY_DEFAULT,
  },
  {
    kind: 'enhancement',
    read: (c, v) =>
      c
        .getEnhancement()
        .read({ enhancementName: 'ZENH_V', enhancementType: 'enhoxhh' }, v),
    url: '/sap/bc/adt/enhancements/enhoxhh/zenh_v/source/main',
    queries: INACTIVE_IS_WORKING_AREA,
  },
  {
    kind: 'generic source read (getUtils)',
    read: (c, v) =>
      c.getUtils().readObjectSource('PROG/P', 'ZPROG_V', undefined, v),
    url: '/sap/bc/adt/programs/programs/zprog_v/source/main',
    queries: AS_GIVEN,
  },
];

const VERSIONS: readonly AdtReadVersion[] = [
  'active',
  'inactive',
  'workingArea',
];

async function sentUrl(
  read: SourceRead,
  version: AdtReadVersion | undefined,
): Promise<string | undefined> {
  const connection = new RecordingConnection();
  await read.read(new AdtClientOnPrem(connection, noopLogger), version);
  expect(connection.sent).toHaveLength(1);
  return connection.sent[0]?.url;
}

describe.each(READS)('$kind source read', (read) => {
  it.each(VERSIONS)('version %s', async (version) => {
    expect(await sentUrl(read, version)).toBe(
      `${read.url}${read.queries[version]}`,
    );
  });

  it('no version', async () => {
    expect(await sentUrl(read, undefined)).toBe(
      `${read.url}${read.queries.none}`,
    );
  });
});

describe('the generic source address', () => {
  it.each(VERSIONS)('getObjectSourceUri builds version %s', (version) => {
    const utils = new AdtClientOnPrem(
      new RecordingConnection(),
      noopLogger,
    ).getUtils();
    expect(
      utils.getObjectSourceUri('CLAS/OC', 'ZCL_V', undefined, version),
    ).toBe(`/sap/bc/adt/oo/classes/zcl_v/source/main?version=${version}`);
  });
});

/**
 * Reads that hand the version to the connection as request params: the
 * feature toggle's read and its source, the service binding's read, and the
 * application log's object and source (measured on S/4HANA 2025, 2026-11-01:
 * `200` for the three values, `400` for any other).
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

  it.each(VERSIONS)('feature toggle read sends %s', async (version) => {
    expect(
      await sent((c) =>
        c.getFeatureToggle().read({ featureToggleName: 'ZFT_V' }, version),
      ),
    ).toEqual({
      url: '/sap/bc/adt/sfw/featuretoggles/zft_v',
      params: { version },
    });
  });

  it.each(VERSIONS)('feature toggle source sends %s', async (version) => {
    expect(
      await sent((c) =>
        c
          .getFeatureToggle()
          .readSource({ featureToggleName: 'ZFT_V' }, version),
      ),
    ).toEqual({
      url: '/sap/bc/adt/sfw/featuretoggles/zft_v/source/main',
      params: { version },
    });
  });

  it.each(VERSIONS)('service binding read sends %s', async (version) => {
    expect(
      await sent((c) =>
        c.getServiceBinding().read({ bindingName: 'ZSB_V' }, version),
      ),
    ).toEqual({
      url: '/sap/bc/adt/businessservices/bindings/zsb_v',
      params: { version },
    });
  });
});

describe('the application log passes the version as request params', () => {
  async function sent(
    read: (runtime: AdtRuntimeClient) => Promise<unknown>,
  ): Promise<{ url?: string; params?: unknown }> {
    const connection = new RecordingConnection();
    await read(new AdtRuntimeClient(connection, noopLogger));
    expect(connection.sent).toHaveLength(1);
    return { url: connection.sent[0]?.url, params: connection.sent[0]?.params };
  }

  it.each(VERSIONS)('object sends %s', async (version) => {
    expect(
      await sent((r) => r.getApplicationLog().getObject('ZLOG_V', { version })),
    ).toEqual({
      url: '/sap/bc/adt/applicationlog/objects/ZLOG_V',
      params: { version },
    });
  });

  it.each(VERSIONS)('source sends %s', async (version) => {
    expect(
      await sent((r) => r.getApplicationLog().getSource('ZLOG_V', { version })),
    ).toEqual({
      url: '/sap/bc/adt/applicationlog/objects/ZLOG_V/source/main',
      params: { version },
    });
  });
});
