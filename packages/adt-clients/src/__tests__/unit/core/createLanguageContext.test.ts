/**
 * Every high-level create resolves its language one way: the config's when it
 * gives one, else the client's system context's, else none — and states it
 * once, in the body and as `sap-language` (fr0ster/mcp-abap-adt#348).
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { TEST_HEADERS } from '../../helpers/adtHeaders';
import { RecordingConnection } from '../../helpers/recordingConnection';

type Create = (
  client: AdtClient,
  language: string | undefined,
  options: { headers: IAdtHeaders },
) => Promise<unknown>;

const P = 'ZPKG';

const CREATES: readonly [string, Create][] = [
  [
    'class',
    (c, l, o) =>
      c.getClass().create(
        {
          className: 'ZCL_X',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'interface',
    (c, l, o) =>
      c.getInterface().create(
        {
          interfaceName: 'ZIF_X',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'include',
    (c, l, o) =>
      c.getInclude().create(
        {
          includeName: 'ZINC',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'program',
    (c, l, o) =>
      c.getProgram().create(
        {
          programName: 'ZPROG',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'DDL source',
    (c, l, o) =>
      c.getDdl().create(
        {
          ddlName: 'ZDDL',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'table',
    (c, l, o) =>
      c.getTable().create(
        {
          tableName: 'ZTAB',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'structure',
    (c, l, o) =>
      c.getStructure().create(
        {
          structureName: 'ZSTRU',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'table type',
    (c, l, o) =>
      c.getTableType().create(
        {
          tableTypeName: 'ZTTYP',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'access control',
    (c, l, o) =>
      c.getAccessControl().create(
        {
          accessControlName: 'ZDCL',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'append structure',
    (c, l, o) =>
      c.getAppendStructure().create(
        {
          appendStructureName: 'ZAPPEND',
          baseObject: 'ZBASE',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'behaviour definition',
    (c, l, o) =>
      c.getBehaviorDefinition().create(
        {
          name: 'ZBDEF',
          packageName: P,
          description: 'd',
          rootEntity: 'ZR',
          implementationType: 'Managed',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'metadata extension',
    (c, l, o) =>
      c.getMetadataExtension().create(
        {
          name: 'ZDDLX',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'enhancement',
    (c, l, o) =>
      c.getEnhancement().create(
        {
          enhancementName: 'ZENH',
          enhancementType: 'enhsxsb',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'service definition',
    (c, l, o) =>
      c.getServiceDefinition().create(
        {
          serviceDefinitionName: 'ZSRVD',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'scalar function',
    (c, l, o) =>
      c.getScalarFunction().create(
        {
          scalarFunctionName: 'ZSF',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'scalar function implementation',
    (c, l, o) =>
      c.getScalarFunctionImplementation().create(
        {
          implementationName: 'ZSFI',
          scalarFunctionName: 'ZSF',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'transformation',
    (c, l, o) =>
      c.getTransformation().create(
        {
          transformationName: 'ZXSLT',
          transformationType: 'XSLTProgram',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'domain',
    (c, l, o) =>
      c.getDomain().create(
        {
          domainName: 'ZDOM',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'data element',
    (c, l, o) =>
      c.getDataElement().create(
        {
          dataElementName: 'ZDTEL',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'function group',
    (c, l, o) =>
      c.getFunctionGroup().create(
        {
          functionGroupName: 'ZFG',
          packageName: P,
          description: 'd',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'package',
    (c, l, o) =>
      c.getPackage().create(
        {
          packageName: 'ZPKG_X',
          superPackage: P,
          description: 'd',
          softwareComponent: 'LOCAL',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'service binding',
    (c, l, o) =>
      c.getServiceBinding().create(
        {
          bindingName: 'ZSRVB',
          packageName: P,
          description: 'd',
          serviceDefinitionName: 'ZSRVD',
          serviceName: 'ZSRV',
          serviceVersion: '0001',
          bindingVariant: 'ODATA_V4_UI',
          masterLanguage: l,
        },
        o,
      ),
  ],
  [
    'message class',
    (c, l, o) =>
      c
        .getMessageClass()
        .create(
          { name: 'ZMSG', packageName: P, description: 'd', masterLanguage: l },
          o,
        ),
  ],
];

/** The create's POST: the last request sent. */
async function createRequest(
  create: Create,
  context: string | undefined,
  configured: string | undefined,
): Promise<IAbapRequestOptions> {
  const connection = new RecordingConnection();
  const client = new AdtClient(connection, undefined, {
    masterLanguage: context,
  });
  await create(client, configured, { headers: TEST_HEADERS });
  const request = connection.sent.at(-1);
  if (request === undefined) throw new Error('nothing sent');
  return request;
}

const body = (request: IAbapRequestOptions): string =>
  typeof request.data === 'string' ? request.data : '';

describe.each(CREATES)(
  '%s create: the language it states',
  (_label, create) => {
    it('takes the system context’s language when the config gives none', async () => {
      const request = await createRequest(create, 'DE', undefined);
      expect(request.headers?.['sap-language']).toBe('DE');
      expect(body(request)).toContain('adtcore:masterLanguage="DE"');
      expect(body(request)).toContain('adtcore:language="DE"');
    });

    it('takes the config’s over the context’s', async () => {
      const request = await createRequest(create, 'DE', 'FR');
      expect(request.headers?.['sap-language']).toBe('FR');
      expect(body(request)).toContain('adtcore:masterLanguage="FR"');
      expect(body(request)).not.toContain('"DE"');
    });

    it('a blank config falls through to the context', async () => {
      const request = await createRequest(create, 'DE', '  ');
      expect(request.headers?.['sap-language']).toBe('DE');
      expect(body(request)).toContain('adtcore:masterLanguage="DE"');
    });

    it('states none when neither gives one', async () => {
      const request = await createRequest(create, undefined, undefined);
      expect(request.headers?.['sap-language']).toBeUndefined();
      expect(body(request)).not.toContain('adtcore:masterLanguage=');
    });
  },
);
