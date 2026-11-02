/**
 * A validate without a package sends the package parameter empty — never the
 * text `undefined` — and a validate with one sends it as before.
 *
 * Measured on an on-premise system (2026-11-02): name validation answers an
 * empty `packagename` exactly as it answers a real package, and refuses a
 * request without the parameter. Until 42.0.0 these members read the package
 * as `config.packageName as string`, so an absent one reached the URL as
 * `packagename=undefined` (or, for the service binding, threw a `TypeError`
 * before any request). Program and include validation are the exception: SAP
 * refuses an empty package there (SEDI_ADT 003), so their config requires one
 * — a call without it does not compile (checked below).
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

/** Records every request and answers none: only what was sent is asserted. */
function recordingConnection(): {
  connection: IAbapConnection;
  sent: IAbapRequestOptions[];
} {
  const sent: IAbapRequestOptions[] = [];
  const connection: IAbapConnection = {
    connect: async () => {},
    getBaseUrl: async () => 'http://sap.invalid',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      sent.push(options);
      throw new Error('recorded, not answered');
    },
  };
  return { connection, sent };
}

type Validation = (
  client: AdtClient,
  packageName: string | undefined,
) => Promise<unknown>;

/** Each validate, called with only what it needs besides the package. */
const validations: Array<[string, Validation, string]> = [
  [
    'AdtClass',
    (c, packageName) =>
      c.getClass().validate({ className: 'ZCL_X', packageName }),
    'packagename',
  ],
  [
    'AdtInterface',
    (c, packageName) =>
      c.getInterface().validate({ interfaceName: 'ZIF_X', packageName }),
    'packagename',
  ],
  [
    'AdtDdl',
    (c, packageName) => c.getDdl().validate({ ddlName: 'ZDDL_X', packageName }),
    'packagename',
  ],
  [
    'AdtAccessControl',
    (c, packageName) =>
      c
        .getAccessControl()
        .validate({ accessControlName: 'ZDCL_X', packageName }),
    'packagename',
  ],
  [
    'AdtMetadataExtension',
    (c, packageName) =>
      c.getMetadataExtension().validate({ name: 'ZDDLX_X', packageName }),
    'packagename',
  ],
  [
    'AdtBehaviorImplementation',
    (c, packageName) =>
      c.getBehaviorImplementation().validate({
        className: 'ZBP_X',
        behaviorDefinition: 'ZBDEF_X',
        packageName,
      }),
    'packagename',
  ],
  [
    'AdtBehaviorDefinition',
    (c, packageName) =>
      c.getBehaviorDefinition().validate({
        name: 'ZBDEF_X',
        rootEntity: 'ZROOT_X',
        description: 'Behavior',
        implementationType: 'Managed',
        packageName,
      }),
    'package',
  ],
];

function queryOf(request: IAbapRequestOptions | undefined): URLSearchParams {
  const url = request?.url ?? '';
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
}

describe('validate without a package', () => {
  it.each(validations)(
    '%s sends the package parameter empty',
    async (_name, validate, parameter) => {
      const { connection, sent } = recordingConnection();
      await validate(new AdtClient(connection), undefined);

      expect(sent).toHaveLength(1);
      const query = queryOf(sent[0]);
      expect(query.getAll(parameter)).toEqual(['']);
      expect(sent[0]?.url).not.toContain('undefined');
    },
  );

  it.each(validations)(
    '%s sends a given package as before',
    async (_name, validate, parameter) => {
      const { connection, sent } = recordingConnection();
      await validate(new AdtClient(connection), 'ZMY_PACKAGE');

      expect(sent).toHaveLength(1);
      expect(queryOf(sent[0]).getAll(parameter)).toEqual(['ZMY_PACKAGE']);
    },
  );

  it('AdtServiceBinding sends an empty DEVCLASS in its transport check', async () => {
    const { connection, sent } = recordingConnection();
    await new AdtClient(connection)
      .getServiceBinding()
      .validate({ bindingName: 'ZSB_X' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('/sap/bc/adt/cts/transportchecks');
    expect(String(sent[0]?.data)).toContain('<DEVCLASS></DEVCLASS>');
    expect(String(sent[0]?.data)).not.toContain('UNDEFINED');
  });

  it('AdtProgram and AdtInclude send the package they require', async () => {
    const { connection, sent } = recordingConnection();
    const client = new AdtClient(connection);
    await client
      .getProgram()
      .validate({ programName: 'ZPROG_X', packageName: 'ZMY_PACKAGE' });
    await client
      .getInclude()
      .validate({ includeName: 'ZINC_X', packageName: 'zmy_package' });

    expect(queryOf(sent[0]).getAll('packagename')).toEqual(['ZMY_PACKAGE']);
    expect(queryOf(sent[1]).getAll('packagename')).toEqual(['ZMY_PACKAGE']);
  });

  it('AdtProgram and AdtInclude do not compile without a package', () => {
    // Type-level: never called; `npm run test:check` fails if either compiles.
    const unused = (client: AdtClient) => [
      // @ts-expect-error -- SAP's program validation refuses an empty package
      client.getProgram().validate({ programName: 'ZPROG_X' }),
      // @ts-expect-error -- the include validation is the program's handler
      client.getInclude().validate({ includeName: 'ZINC_X' }),
    ];
    expect(typeof unused).toBe('function');
  });

  it('AdtServiceBinding.readTransport sends an empty DEVCLASS without a package', async () => {
    const { connection, sent } = recordingConnection();
    await new AdtClient(connection)
      .getServiceBinding()
      .readTransport({ bindingName: 'ZSB_X' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('/sap/bc/adt/cts/transportchecks');
    expect(String(sent[0]?.data)).toContain('<DEVCLASS></DEVCLASS>');
    expect(String(sent[0]?.data)).not.toContain('UNDEFINED');
  });

  it('AdtServiceBinding sends a given package as DEVCLASS', async () => {
    const { connection, sent } = recordingConnection();
    await new AdtClient(connection)
      .getServiceBinding()
      .validate({ bindingName: 'ZSB_X', packageName: 'zmy_package' });

    expect(String(sent[0]?.data)).toContain('<DEVCLASS>ZMY_PACKAGE</DEVCLASS>');
  });
});
