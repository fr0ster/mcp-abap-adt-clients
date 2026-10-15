/**
 * The ENHO/ENHS family and the enhancement hosts against a real system.
 *
 * What these cases assert was measured on an on-premise and an ABAP Cloud
 * system before the code was written (2026-10-15); the notes are in git history
 * (removed in the 32.0.0 release branch), the facts in the CHANGELOG.
 */
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IEnhancementConfig } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import type { AdtClient } from '../../../../clients/AdtClient';
import { INTERFACE, PROGRAM } from '../../../../endpoints/objects';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { escapeXmlAttr } from '../../../../utils/xml';
import {
  configuredCase,
  gate,
  isTestConfigTemplate,
  MISSING_TEST_CONFIG,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectFailure, expectResult } from '../../../helpers/contract';
import { expectLockReleased } from '../../../helpers/lockReleased';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  getTimeout,
  resolveSharedDependency,
} = require('../../../helpers/test-helper');
const logger = createTestsLogger();
const parser = new XMLParser({ ignoreAttributes: false });
const analyse = { analyse: analyseException };

/** Assert the document itself, rather than a library interpretation of it. */
function root(document: string, name: string): any {
  expect(typeof document).toBe('string');
  const parsed = parser.parse(document);
  expect(Object.keys(parsed).filter((key) => key !== '?xml')).toEqual([name]);
  return parsed[name];
}

describe('Enhancement family and host reads (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloud = false;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      if (isTestConfigTemplate()) throw new Error(MISSING_TEST_CONFIG);
      connection = await createTestConnection(createConnectionLogger());
      isCloud = await isCloudEnvironment(connection);
      const context = await resolveSystemContext(connection, isCloud);
      const resolved = await createTestAdtClient(
        connection,
        createLibraryLogger(),
        context,
      );
      client = resolved.client;
      isLegacy = resolved.isLegacy;
      hasConfig = true;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, logger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  function configured(name: string): TestConfigResolver {
    if (isTestConfigTemplate()) throw new Error(MISSING_TEST_CONFIG);
    const testCase = configuredCase('enhancement', name);
    if (!testCase) {
      throw new Error(missingCaseMessage('enhancement', name));
    }
    if (!hasConfig) {
      throw new Error(`SAP setup failed for enhancement/${name}`);
    }
    return new TestConfigResolver({ testCase, isCloud, isLegacy, logger });
  }

  function required(resolver: TestConfigResolver, key: string): string {
    const value = resolver.getParam(key);
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`${key} not configured`);
    return value;
  }

  function config(
    resolver: TestConfigResolver,
    enhancementType: IEnhancementConfig['enhancementType'],
    key = 'enhancement_name',
  ): Omit<IEnhancementConfig, 'source'> & { source?: never } {
    const enhancementName = required(resolver, key);
    // Only this suite's user objects may be deleted, including leftovers.
    expect(enhancementName).toMatch(/^[ZY]/i);
    const packageName = resolver.getPackageName();
    if (!packageName) throw new Error('default_package not configured');
    return {
      enhancementName,
      enhancementType,
      packageName,
      transportRequest: resolver.getTransportRequest(),
      description: required(resolver, 'description'),
    };
  }

  async function removeLeftover(object: IEnhancementConfig): Promise<void> {
    const existing = await client
      .getEnhancement()
      .readMetadata(object, analyse);
    if (existing.ok) {
      expectResult(
        await client
          .getEnhancement()
          .delete(object, { analyse: analyseDeletion }),
        'delete leftover',
      );
    } else {
      expect(existing.getError().response?.status).toBe(404);
    }
  }

  async function deleteAndVerify(object: IEnhancementConfig): Promise<void> {
    expectResult(
      await client
        .getEnhancement()
        .delete(object, { analyse: analyseDeletion }),
      'delete enhancement',
    );
    const failure = expectFailure(
      await client.getEnhancement().readMetadata(object, analyse),
      'read deleted enhancement',
    );
    expect(failure.response?.status).toBe(404);
  }

  async function lockWindow(
    object: IEnhancementConfig,
    source?: string,
  ): Promise<void> {
    const enhancement = client.getEnhancement();
    const handle = expectResult(
      await enhancement.lock(object, analyse),
      'lock enhancement',
    );
    try {
      expect(handle).toBeTruthy();
      if (source !== undefined) {
        expectResult(
          await enhancement.update(object, {
            ...analyse,
            source,
            lockHandle: handle,
          }),
          'update source',
        );
      }
    } finally {
      expectResult(
        await enhancement.unlock(object, handle, analyse),
        'unlock enhancement',
      );
    }
    // The helper alone opens/closes the independent session proving release.
    await expectLockReleased(
      (other) => other.getEnhancement(),
      object,
      object.enhancementName,
      logger,
    );
  }

  gate('enhancement', 'badi')(
    'badi: write and activate a definition and implementation',
    async () => {
      const resolver = configured('badi');
      const spot = config(resolver, 'enhsxsb', 'spot_name');
      const container = {
        ...config(resolver, 'enhoxhb'),
        enhancementSpot: spot.enhancementName,
      };
      const interfaceName = required(resolver, 'interface_name');
      const className = required(resolver, 'class_name');
      const definitionName = required(resolver, 'definition_name');
      const implementationName = required(resolver, 'implementation_name');
      for (const name of [
        interfaceName,
        className,
        definitionName,
        implementationName,
      ]) {
        expect(name).toMatch(/^[ZY]/i);
      }
      const common = {
        packageName: spot.packageName,
        transportRequest: spot.transportRequest,
        description: spot.description,
      };
      const intfConfig = { ...common, interfaceName };
      const classConfig = { ...common, className };
      const intf = client.getInterface();
      const cls = client.getClass();
      const enhancement = client.getEnhancement();
      const esc = escapeXmlAttr;
      // Cleanup attempts every object in reverse dependency order, even on failure.
      async function cleanup(): Promise<void> {
        try {
          await removeLeftover(container);
        } finally {
          try {
            const read = await cls.readMetadata(classConfig, analyse);
            if (read.ok)
              expectResult(
                await cls.delete(classConfig, { analyse: analyseDeletion }),
                'delete BAdI class',
              );
            else expect(read.getError().response?.status).toBe(404);
          } finally {
            try {
              await removeLeftover(spot);
            } finally {
              const read = await intf.readMetadata(intfConfig, analyse);
              if (read.ok)
                expectResult(
                  await intf.delete(intfConfig, { analyse: analyseDeletion }),
                  'delete BAdI interface',
                );
              else expect(read.getError().response?.status).toBe(404);
            }
          }
        }
      }
      async function writeDocument(
        object: IEnhancementConfig,
        source: string,
      ): Promise<void> {
        const handle = expectResult(
          await enhancement.lock(object, analyse),
          'lock BAdI document',
        );
        try {
          expectResult(
            await enhancement.updateMetadata(object, {
              ...analyse,
              source,
              lockHandle: handle,
            }),
            'write BAdI document',
          );
        } finally {
          expectResult(
            await enhancement.unlock(object, handle, analyse),
            'unlock BAdI document',
          );
        }
        expectResult(
          await enhancement.activate(object, { analyse: analyseActivation }),
          'activate BAdI document',
        );
      }
      function document(
        prefix: 'enhs' | 'enho',
        name: string,
        type: string,
        content: string,
      ): string {
        return `<?xml version="1.0" encoding="UTF-8"?><${prefix}:objectData xmlns:${prefix}="http://www.sap.com/adt/enhancements/${prefix}" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:enhcore="http://www.sap.com/abapsource/enhancementscore" adtcore:name="${esc(name)}" adtcore:type="${type}" adtcore:description="${esc(spot.description ?? '')}" adtcore:language="EN" adtcore:masterLanguage="EN"><adtcore:packageRef adtcore:name="${esc(spot.packageName ?? '')}"/>${content}</${prefix}:objectData>`;
      }
      await cleanup();
      try {
        expectResult(
          await intf.create(intfConfig, analyse),
          'create BAdI interface',
        );
        const interfaceHandle = expectResult(
          await intf.lock(intfConfig, analyse),
          'lock BAdI interface',
        );
        try {
          expectResult(
            await intf.update(intfConfig, {
              ...analyse,
              lockHandle: interfaceHandle,
              source: `INTERFACE ${interfaceName} PUBLIC.\n INTERFACES if_badi_interface.\n METHODS calc RETURNING VALUE(r) TYPE i.\nENDINTERFACE.`,
            }),
            'write BAdI interface',
          );
        } finally {
          expectResult(
            await intf.unlock(intfConfig, interfaceHandle, analyse),
            'unlock BAdI interface',
          );
        }
        expectResult(
          await intf.activate(intfConfig, { analyse: analyseActivation }),
          'activate BAdI interface',
        );
        expectResult(
          await enhancement.create(spot, analyse),
          'create BAdI spot',
        );
        await writeDocument(
          spot,
          document(
            'enhs',
            spot.enhancementName,
            'ENHS/XSB',
            `<enhs:contentCommon enhs:toolType="BADI_DEF"/><enhs:contentSpecific><enhs:badiTechnology><enhs:badiDefinitions><enhs:badiDefinition enhs:name="${esc(definitionName)}" enhs:shorttext="BAdI test" enhs:singleUse="true" enhs:useFallbackClass="false" enhs:filterLimitation="false" enhs:contextMode="N" enhs:amdp="false" enhs:internalUse="false"><enhs:interface adtcore:uri="${esc(INTERFACE.uri(interfaceName))}" adtcore:type="INTF/OI" adtcore:name="${esc(interfaceName)}"/></enhs:badiDefinition></enhs:badiDefinitions></enhs:badiTechnology></enhs:contentSpecific>`,
          ),
        );
        const spotMetadata = root(
          expectResult(
            await enhancement.readMetadata(spot, analyse),
            'active BAdI spot',
          ),
          'enhs:objectData',
        );
        expect(spotMetadata['@_adtcore:version']).toBe('active');
        const definition =
          spotMetadata['enhs:contentSpecific']['enhs:badiTechnology'][
            'enhs:badiDefinitions'
          ]['enhs:badiDefinition'];
        expect(definition['@_enhs:name']).toBe(definitionName);
        expect(definition['enhs:interface']['@_adtcore:name']).toBe(
          interfaceName,
        );
        expectResult(
          await cls.create(classConfig, analyse),
          'create BAdI class',
        );
        const classHandle = expectResult(
          await cls.lock(classConfig, analyse),
          'lock BAdI class',
        );
        try {
          expectResult(
            await cls.update(classConfig, {
              ...analyse,
              lockHandle: classHandle,
              source: `CLASS ${className} DEFINITION PUBLIC FINAL CREATE PUBLIC.\n PUBLIC SECTION.\n INTERFACES if_badi_interface.\n INTERFACES ${interfaceName}.\nENDCLASS.\nCLASS ${className} IMPLEMENTATION.\n METHOD ${interfaceName}~calc.\n r = 1.\n ENDMETHOD.\nENDCLASS.`,
            }),
            'write BAdI class',
          );
        } finally {
          expectResult(
            await cls.unlock(classConfig, classHandle, analyse),
            'unlock BAdI class',
          );
        }
        expectResult(
          await cls.activate(classConfig, { analyse: analyseActivation }),
          'activate BAdI class',
        );
        expectResult(
          await enhancement.create(container, analyse),
          'create BAdI container',
        );
        await writeDocument(
          container,
          document(
            'enho',
            container.enhancementName,
            'ENHO/XHB',
            `<enho:contentCommon enho:toolType="BADI_IMPL"><enho:usages><enhcore:referencedObject enhcore:element_usage="EXTO" enhcore:program_id="R3TR"><enhcore:objectReference adtcore:name="${esc(spot.enhancementName)}" adtcore:type="ENHS/XS"/><enhcore:mainObjectReference/></enhcore:referencedObject></enho:usages></enho:contentCommon><enho:contentSpecific><enho:badiTechnology><enho:badiImplementations><enho:badiImplementation enho:name="${esc(implementationName)}" enho:shortText="BAdI test" enho:example="false" enho:default="false" enho:active="false" enho:customizingLock=""><enho:enhancementSpot adtcore:type="ENHS/XSB" adtcore:name="${esc(spot.enhancementName)}"/><enho:badiDefinition adtcore:type="ENHS/XB" adtcore:name="${esc(definitionName)}"/><enho:implementingClass adtcore:type="CLAS/OC" adtcore:name="${esc(className)}"/></enho:badiImplementation></enho:badiImplementations></enho:badiTechnology></enho:contentSpecific>`,
          ),
        );
        const metadata = root(
          expectResult(
            await enhancement.readMetadata(container, analyse),
            'active BAdI container',
          ),
          'enho:objectData',
        );
        expect(metadata['@_adtcore:version']).toBe('active');
        const implementation =
          metadata['enho:contentSpecific']['enho:badiTechnology'][
            'enho:badiImplementations'
          ]['enho:badiImplementation'];
        expect(implementation['@_enho:name']).toBe(implementationName);
        expect(implementation['enho:implementingClass']['@_adtcore:name']).toBe(
          className,
        );
      } finally {
        await cleanup();
      }
    },
    getTimeout('test'),
  );

  gate('enhancement', 'enhsxsb')(
    'enhsxsb: create, metadata, lock/unlock, activate, delete',
    async () => {
      const resolver = configured('enhsxsb');
      const object = config(resolver, 'enhsxsb');
      await removeLeftover(object);
      try {
        expectResult(
          await client.getEnhancement().create(object, analyse),
          'create XSB',
        );
        const document = expectResult(
          await client.getEnhancement().readMetadata(object, analyse),
          'XSB metadata',
        );
        expect(root(document, 'enhs:objectData')['@_adtcore:type']).toBe(
          'ENHS/XSB',
        );
        await lockWindow(object);
        expectResult(
          await client
            .getEnhancement()
            .activate(object, { analyse: analyseActivation }),
          'activate XSB',
        );
      } finally {
        await deleteAndVerify(object);
      }
    },
    getTimeout('test'),
  );

  gate('enhancement', 'enhoxhb')(
    'enhoxhb: create its own spot and container, then delete in reverse',
    async () => {
      const resolver = configured('enhoxhb');
      const spot = config(resolver, 'enhsxsb', 'spot_name');
      const object = {
        ...config(resolver, 'enhoxhb'),
        enhancementSpot: spot.enhancementName,
      };
      await removeLeftover(object);
      await removeLeftover(spot);
      try {
        expectResult(
          await client.getEnhancement().create(spot, analyse),
          'create XHB spot',
        );
        expectResult(
          await client.getEnhancement().create(object, analyse),
          'create XHB',
        );
        const document = expectResult(
          await client.getEnhancement().readMetadata(object, analyse),
          'XHB metadata',
        );
        const metadata = root(document, 'enho:objectData');
        expect(metadata['@_adtcore:type']).toBe('ENHO/XHB');
        const usages = metadata['enho:contentCommon']['enho:usages'];
        expect(
          usages['enhcore:referencedObject']['enhcore:objectReference'][
            '@_adtcore:name'
          ],
        ).toBe(spot.enhancementName);
      } finally {
        // Attempt both deletions, in dependency order, even when one fails.
        try {
          await removeLeftover(object);
        } finally {
          await removeLeftover(spot);
        }
      }
    },
    getTimeout('test'),
  );

  gate('enhancement', 'enhoxhh')(
    'enhoxhh: use a shared program option, write and activate source',
    async () => {
      const resolver = configured('enhoxhh');
      const object = config(resolver, 'enhoxhh');
      const programName = required(resolver, 'program_name');
      const dependency = resolveSharedDependency('programs', programName);
      if (
        !dependency ||
        !TestConfigResolver.isTestAvailable(dependency, isCloud, isLegacy)
      ) {
        throw new Error(
          `Shared program ${programName} not configured for this system; run shared:setup`,
        );
      }
      await removeLeftover(object);
      const program = client.getProgram();
      const options = expectResult(
        await program.readEnhancementOptions({ programName }, analyse),
        'host options',
      );
      const optionNodes = root(options, 'enho:enhancementOption')[
        'enho:option'
      ];
      const option = Array.isArray(optionNodes) ? optionNodes[0] : optionNodes;
      expect(option).toBeDefined();
      const enhancementOption = option['@_enhocore:full_name'];
      expect(enhancementOption).toEqual(expect.any(String));
      expect(enhancementOption.length).toBeGreaterThan(0);
      const mode = option['@_enho:mode'];
      expect(['static', 'dynamic']).toContain(mode);
      // Wire notes (2026-10-15), “ENHO/XHH”: options say static/dynamic;
      // create rejects those words and requires the corresponding S/D code.
      const enhancementMode = mode === 'static' ? 'S' : 'D';
      try {
        expectResult(
          await client.getEnhancement().create(
            {
              ...object,
              enhancementOption,
              enhancementMode,
              enhancedObject: {
                uri: PROGRAM.uri(programName),
                type: 'PROG/P',
                name: programName,
                program: programName,
              },
            },
            analyse,
          ),
          'create XHH',
        );
        const source = expectResult(
          await client.getEnhancement().read(object, 'inactive', analyse),
          'inactive XHH source',
        );
        expect(source).toMatch(/ENHANCEMENT 1[\s\S]*ENDENHANCEMENT\./);
        const elements = expectResult(
          await program.readEnhancementElements({ programName }, analyse),
          'host elements',
        );
        root(elements, 'enh:enhancements');
        expect(elements).toContain(object.enhancementName);
        const comment = '* Integration enhancement source update';
        await lockWindow(
          object,
          source.replace('ENDENHANCEMENT.', `${comment}\nENDENHANCEMENT.`),
        );
        expectResult(
          await client
            .getEnhancement()
            .activate(object, { analyse: analyseActivation }),
          'activate XHH',
        );
        expect(
          expectResult(
            await client.getEnhancement().read(object, 'active', analyse),
            'active XHH source',
          ),
        ).toContain(comment);
      } finally {
        await removeLeftover(object);
      }
    },
    getTimeout('test'),
  );

  gate('enhancement', 'class_hosts')(
    'reads class elements and preserves the missing-class 400/SEEF_BASE refusal',
    async () => {
      const resolver = configured('class_hosts');
      root(
        expectResult(
          await client
            .getClass()
            .readEnhancementElements(
              { className: required(resolver, 'class_name') },
              analyse,
            ),
          'class elements',
        ),
        'enh:enhancements',
      );
      const answer = await client
        .getClass()
        .readEnhancementElements(
          { className: required(resolver, 'missing_class_name') },
          analyse,
        );
      expect(answer.ok).toBe(false);
      const failure = expectFailure(answer, 'missing class elements');
      expect(failure.response?.status).toBe(400);
      expect(failure.response?.data).toContain('SEEF_BASE');
    },
    getTimeout('test'),
  );

  gate('enhancement', 'program_host')(
    'reads program enhancement implementations',
    async () => {
      const resolver = configured('program_host');
      const document = expectResult(
        await client
          .getProgram()
          .readEnhancementElements(
            { programName: required(resolver, 'program_name') },
            analyse,
          ),
        'program elements',
      );
      const elements = root(document, 'enh:enhancements');
      const implementations = elements['enh:enhancementImplementations'];
      expect(implementations).toBeDefined();
      expect(
        Array.isArray(implementations)
          ? implementations.length
          : implementations
            ? 1
            : 0,
      ).toBeGreaterThan(0);
    },
    getTimeout('test'),
  );

  gate('enhancement', 'function_group_host')(
    'first measurement: function group elements and options',
    async () => {
      const resolver = configured('function_group_host');
      const host = {
        functionGroupName: required(resolver, 'function_group_name'),
      };
      // First measurement: wire notes did not probe this host; assert only success and roots.
      root(
        expectResult(
          await client
            .getFunctionGroup()
            .readEnhancementElements(host, analyse),
          'function group elements',
        ),
        'enh:enhancements',
      );
      root(
        expectResult(
          await client.getFunctionGroup().readEnhancementOptions(host, analyse),
          'function group options',
        ),
        'enho:enhancementOption',
      );
    },
    getTimeout('test'),
  );

  gate('enhancement', 'include_host')(
    'first measurement: include elements with main-program context and options',
    async () => {
      const resolver = configured('include_host');
      const host = { includeName: required(resolver, 'include_name') };
      // First measurement: an on-premise system answered 400 ED/258 without context on both reads,
      // and 200 with the main-program context.
      root(
        expectResult(
          await client.getInclude().readEnhancementElements(host, {
            ...analyse,
            context: required(resolver, 'main_program'),
          }),
          'include elements',
        ),
        'enh:enhancements',
      );
      root(
        expectResult(
          await client.getInclude().readEnhancementOptions(host, {
            ...analyse,
            context: required(resolver, 'main_program'),
          }),
          'include options',
        ),
        'enho:enhancementOption',
      );
    },
    getTimeout('test'),
  );
});
