import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { create as createAccessControl } from '../../../../core/accessControl/create';
import { AdtBehaviorImplementation } from '../../../../core/behaviorImplementation/AdtBehaviorImplementation';
import { AdtInclude } from '../../../../core/include/AdtInclude';
import { create as createInclude } from '../../../../core/include/create';
import { AdtMessageClass } from '../../../../core/messageClass/AdtMessageClass';
import { create as createServiceDefinition } from '../../../../core/serviceDefinition/create';
import { create as createTransformation } from '../../../../core/transformation/create';

// A create must carry the responsible person and the master system it has, and
// must not write an empty attribute for one it lacks.

function recorder(): { conn: IAbapConnection; bodies: string[] } {
  const bodies: string[] = [];
  const conn = {
    makeAdtRequest: async (o: { data?: unknown }) => {
      bodies.push(String(o.data ?? ''));
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { conn, bodies };
}

const CTX = { responsible: 'DEVELOPER', masterSystem: 'SID' };

describe('message class create', () => {
  const config = {
    name: 'ZMC',
    description: 'd',
    packageName: 'ZPKG',
  };

  it('carries the context responsible and master system', async () => {
    const { conn, bodies } = recorder();
    await new AdtMessageClass(conn, undefined, CTX).create(config);
    expect(bodies[0]).toContain('adtcore:responsible="DEVELOPER"');
    expect(bodies[0]).toContain('adtcore:masterSystem="SID"');
  });

  it('writes neither attribute for an empty-string context', async () => {
    const { conn, bodies } = recorder();
    await new AdtMessageClass(conn, undefined, {
      responsible: '',
      masterSystem: '',
    }).create(config);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).not.toContain('adtcore:masterSystem');
  });

  it('writes neither attribute when the context has none', async () => {
    const { conn, bodies } = recorder();
    await new AdtMessageClass(conn).create(config);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).not.toContain('adtcore:masterSystem');
  });
});

describe.each([
  [
    'service definition',
    (c: IAbapConnection, responsible?: string) =>
      createServiceDefinition(c, {
        service_definition_name: 'ZSRVD',
        package_name: 'ZPKG',
        responsible,
      } as never),
  ],
  [
    'transformation',
    (c: IAbapConnection, responsible?: string) =>
      createTransformation(c, {
        transformation_name: 'ZXSLT',
        transformation_type: 'XSLT_Program',
        package_name: 'ZPKG',
        responsible,
      } as never),
  ],
  [
    'access control',
    (c: IAbapConnection, responsible?: string) =>
      createAccessControl(c, {
        access_control_name: 'ZDCL',
        package_name: 'ZPKG',
        responsible,
      } as never),
  ],
])('%s create', (_name, run) => {
  it('writes no empty responsible attribute when there is none', async () => {
    const { conn, bodies } = recorder();
    await run(conn, undefined);
    expect(bodies[0]).not.toContain('adtcore:responsible');
  });

  it('escapes the values it writes', async () => {
    const { conn, bodies } = recorder();
    await run(conn, 'A&"B');
    expect(bodies[0]).toContain('adtcore:responsible="A&amp;&quot;B"');
  });

  it('writes the responsible person when set', async () => {
    const { conn, bodies } = recorder();
    await run(conn, 'DEVELOPER');
    expect(bodies[0]).toContain('adtcore:responsible="DEVELOPER"');
  });
});

// A class create sends no adtcore:responsible: SAP stores that attribute as
// the class's creator (createdBy) and records the logon user as responsible
// whatever is sent. Measured on-premise 2026-10-04.
describe('class create', () => {
  const config = { className: 'ZCL_X', packageName: 'ZPKG', description: 'd' };

  it('sends no responsible from the system context', async () => {
    const { conn, bodies } = recorder();
    await new AdtClient(conn, undefined, { ...CTX } as never)
      .getClass()
      .create(config as never);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).toContain('adtcore:masterSystem="SID"');
  });

  it('sends no responsible from the config', async () => {
    const { conn, bodies } = recorder();
    await new AdtClient(conn, undefined, { ...CTX } as never)
      .getClass()
      .create({ ...config, responsible: 'OTHER' } as never);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).not.toContain('OTHER');
  });
});

describe('behavior implementation create through the client', () => {
  it('carries the client master system like a class create', async () => {
    const { conn, bodies } = recorder();
    const client = new AdtClient(conn, undefined, {
      ...CTX,
    } as never);
    await client.getBehaviorImplementation().create({
      className: 'ZBP_I_X',
      packageName: 'ZPKG',
      description: 'd',
    } as never);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).toContain('adtcore:masterSystem="SID"');
  });

  it('the class itself, without a context, sends neither', async () => {
    const { conn, bodies } = recorder();
    await new AdtBehaviorImplementation(conn).create({
      className: 'ZBP_I_X',
      packageName: 'ZPKG',
      description: 'd',
    } as never);
    expect(bodies[0]).not.toContain('adtcore:responsible');
    expect(bodies[0]).not.toContain('adtcore:masterSystem');
  });
});

describe('include create', () => {
  const config = { includeName: 'ZINC', packageName: 'ZPKG' };

  it('carries the context responsible and master system', async () => {
    const { conn, bodies } = recorder();
    await new AdtInclude(conn, undefined, undefined, undefined, CTX).create(
      config,
    );
    expect(bodies[0]).toContain('adtcore:responsible="DEVELOPER"');
    expect(bodies[0]).toContain('adtcore:masterSystem="SID"');
  });

  it('carries the client context when obtained through the client', async () => {
    const { conn, bodies } = recorder();
    await new AdtClient(conn, undefined, { ...CTX } as never)
      .getInclude()
      .create(config);
    expect(bodies[0]).toContain('adtcore:responsible="DEVELOPER"');
    expect(bodies[0]).toContain('adtcore:masterSystem="SID"');
  });

  it('low-level create writes none when absent', async () => {
    const { conn, bodies } = recorder();
    await createInclude(conn, { includeName: 'ZINC', packageName: 'ZPKG' });
    expect(bodies[0]).not.toContain('adtcore:responsible');
  });
});
