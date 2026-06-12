import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { create as createBehaviorDefinition } from '../../../core/behaviorDefinition/create';
import { createMetadataExtension } from '../../../core/metadataExtension/create';
import { AdtProgram } from '../../../core/program/AdtProgram';
import { create as createProgram } from '../../../core/program/create';
import { AdtServiceBinding } from '../../../core/service/AdtService';

/**
 * Master/original language wiring (fr0ster/mcp-abap-adt#105).
 *
 * create payloads must carry the configured master language in BOTH
 * adtcore:language and adtcore:masterLanguage, and fall back to EN when unset.
 * High-level handlers resolve config.masterLanguage ?? systemContext.masterLanguage.
 */
describe('masterLanguage on create', () => {
  function mockConnection() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 201, data: '' }),
      setSessionType: jest.fn(),
      getSessionId: jest.fn().mockReturnValue('sess'),
    } as unknown as IAbapConnection;
  }

  function bodyOf(connection: IAbapConnection): string {
    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    return String(call.data);
  }

  describe('low-level program create', () => {
    it('uses the given language for both language attributes', async () => {
      const c = mockConnection();
      await createProgram(c, {
        programName: 'ZTEST',
        packageName: '$TMP',
        masterLanguage: 'ZH',
      });
      const body = bodyOf(c);
      expect(body).toContain('adtcore:language="ZH"');
      expect(body).toContain('adtcore:masterLanguage="ZH"');
    });

    it('falls back to EN when language is not provided', async () => {
      const c = mockConnection();
      await createProgram(c, { programName: 'ZTEST', packageName: '$TMP' });
      const body = bodyOf(c);
      expect(body).toContain('adtcore:language="EN"');
      expect(body).toContain('adtcore:masterLanguage="EN"');
    });
  });

  describe('low-level metadataExtension create', () => {
    it('uses the language for BOTH attributes (no hardcoded EN language)', async () => {
      const c = mockConnection();
      await createMetadataExtension(c, {
        name: 'ZMDE',
        packageName: '$TMP',
        description: 'x',
        masterLanguage: 'ZH',
      });
      const body = bodyOf(c);
      expect(body).toContain('adtcore:language="ZH"');
      expect(body).toContain('adtcore:masterLanguage="ZH"');
    });
  });

  describe('low-level behaviorDefinition create', () => {
    it('uses the language for both attributes, EN otherwise', async () => {
      const c1 = mockConnection();
      await createBehaviorDefinition(c1, {
        name: 'ZBDEF',
        package: '$TMP',
        description: 'x',
        implementationType: 'managed',
        language: 'ZH',
      } as never);
      expect(bodyOf(c1)).toContain('adtcore:masterLanguage="ZH"');
      expect(bodyOf(c1)).toContain('adtcore:language="ZH"');

      const c2 = mockConnection();
      await createBehaviorDefinition(c2, {
        name: 'ZBDEF',
        package: '$TMP',
        description: 'x',
        implementationType: 'managed',
      } as never);
      expect(bodyOf(c2)).toContain('adtcore:masterLanguage="EN"');
    });
  });

  describe('ServiceBinding honours the global systemContext override', () => {
    function bindingBody(connection: IAbapConnection): string {
      const call = (connection.makeAdtRequest as jest.Mock).mock.calls.find(
        (c) => String(c[0]?.data).includes('srvb:serviceBinding'),
      );
      return String(call?.[0]?.data);
    }

    const baseParams = {
      bindingName: 'ZSB',
      packageName: '$TMP',
      description: 'x',
      serviceDefinitionName: 'ZSD',
      serviceName: 'ZSRV',
      serviceVersion: '0001',
      bindingVariant: 'ODATA_V4_UI',
    } as never;

    it('uses systemContext.masterLanguage (global option) when params omit it', async () => {
      const c = mockConnection();
      const binding = new AdtServiceBinding(c, undefined, {
        masterLanguage: 'FR',
      });
      await binding.createServiceBinding(baseParams);
      expect(bindingBody(c)).toContain('adtcore:masterLanguage="FR"');
    });

    it('explicit params.masterLanguage overrides the global option', async () => {
      const c = mockConnection();
      const binding = new AdtServiceBinding(c, undefined, {
        masterLanguage: 'FR',
      });
      await binding.createServiceBinding({
        ...(baseParams as object),
        masterLanguage: 'ZH',
      } as never);
      expect(bindingBody(c)).toContain('adtcore:masterLanguage="ZH"');
    });
  });

  describe('high-level AdtProgram.create resolution', () => {
    it('uses systemContext.masterLanguage when config omits it', async () => {
      const c = mockConnection();
      const program = new AdtProgram(c, undefined, { masterLanguage: 'IT' });
      await program.create({ programName: 'ZTEST', packageName: '$TMP' });
      expect(bodyOf(c)).toContain('adtcore:masterLanguage="IT"');
    });

    it('config.masterLanguage overrides systemContext', async () => {
      const c = mockConnection();
      const program = new AdtProgram(c, undefined, { masterLanguage: 'IT' });
      await program.create({
        programName: 'ZTEST',
        packageName: '$TMP',
        masterLanguage: 'FR',
      });
      expect(bodyOf(c)).toContain('adtcore:masterLanguage="FR"');
    });

    it('falls back to EN with no language anywhere', async () => {
      const c = mockConnection();
      const program = new AdtProgram(c, undefined, {});
      await program.create({ programName: 'ZTEST', packageName: '$TMP' });
      expect(bodyOf(c)).toContain('adtcore:masterLanguage="EN"');
    });
  });
});
