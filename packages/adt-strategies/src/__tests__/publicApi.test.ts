import type {
  AdtActivationFacts,
  AdtActivationRefusal,
  AdtMessage,
  AdtRefusal,
  IAdtActivationFailure,
  IAdtMessageFailure,
  IAdtStillInactive,
} from '../index';
import * as api from '../index';
import { rawOf } from '../result';

/**
 * The entry point, as a consumer sees it.
 *
 * The other files import from the modules directly, which is convenient and
 * proves nothing about the barrel: a name left out of `index.ts` compiles
 * everywhere inside the package and is simply missing from the published one.
 * The failure mode is invisible until somebody installs it.
 */
describe('the published surface', () => {
  it('exports every strategy and every reading, callable', () => {
    const expected = [
      'ACTIVATION_RUNS_COLLECTION',
      'abapGitErrorLog',
      'abapGitExternalRepo',
      'abapGitRepos',
      'analyseActivation',
      'analyseAny',
      'analyseCdsTestDoubles',
      'analyseCheck',
      'analyseDebuggeeEnd',
      'analyseDebuggerFreed',
      'analyseDeletion',
      'analyseException',
      'analyseMessageClassMessage',
      'analyseObjectProperties',
      'analysePublication',
      'analysePublicationLock',
      'analyseUnitTest',
      'analyseUnitTestStart',
      'analyseUnsupportedStatus',
      'analyseValidation',
      'answeredObject',
      'asItCame',
      'atcRunStatus',
      'atcStartedRun',
      'atcSystemCheckVariant',
      'atcWaitingRun',
      'atcWorklistId',
      'compareRecordedAt',
      'extractRunId',
      'featureToggleCheckState',
      'featureToggleRuntimeState',
      'feedDescriptors',
      'feedEntries',
      'feedGatewayErrorDetail',
      'feedGatewayErrors',
      'feedSystemMessages',
      'feedVariants',
      'isIndeterminateWalkAnswer',
      'objectOutline',
      'objectVersions',
      'profilerDbAccesses',
      'profilerHitList',
      'profilerStatements',
      'profilerTraceEntries',
      'rawOf',
      'readActivationRefusal',
      'readAdtRefusal',
      'readCdsTestDoublesRefusal',
      'readCheckRunRefusal',
      'readDeletionRefusal',
      'readExceptionRefusal',
      'readExceptionSubType',
      'readMessageClassMessageAbsence',
      'readNamedItems',
      'readNodeStructure',
      'readObjectOutline',
      'readObjectPropertiesAbsence',
      'readPublicationRefusal',
      'readSearchHits',
      'readServiceDefinitionElementInfo',
      'readStructureElementInfo',
      'readUnitTestRefusal',
      'readValidationRefusal',
      'serviceDefinitionElementInfo',
      'stillInactiveAmong',
      'structureElementInfo',
      'traceSchedulingProfilerId',
      'traceSchedulingRequests',
      'traceSchedulingTypes',
      'transportCreated',
      'transportObjectEntries',
      'transportSearchConfigurations',
      'transportTree',
      'unitTestRunId',
      'utilActivationRunId',
      'utilDiscoveryCollections',
      'utilInactiveObjects',
      'utilNamedItems',
      'utilNodeContents',
      'utilSearchHits',
      'utilWhereUsedReferences',
    ];
    expect(Object.keys(api).sort()).toEqual(expected);
    for (const name of expected.filter(
      (name) => name !== 'ACTIVATION_RUNS_COLLECTION',
    )) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function');
    }
    expect(api.ACTIVATION_RUNS_COLLECTION).toBe('/sap/bc/adt/activation/runs');
  });

  /**
   * The types, held to their shape by the compiler rather than by an
   * assertion — this block fails the build if a field is renamed or dropped,
   * which is the only way a type export can be "tested".
   */
  it('keeps the shapes the readings promise', () => {
    const message: AdtMessage = {
      type: 'E',
      text: 'a sentence',
      code: 'MESSAGE(GTH)',
      t100: { id: 'SADT_RESOURCE', no: '026', values: ['x'] },
      line: '15',
      uri: '/sap/bc/adt/oo/classes/zcl_x',
    };
    const refusal: AdtRefusal = {
      message: 'a sentence',
      adtType: 'InvalidClifName',
      namespace: 'com.sap.adt',
      messages: [message],
      form: 'exception',
    };
    const failure: IAdtMessageFailure = {
      origin: 'refusal',
      message: refusal.message,
      messages: refusal.messages,
    };

    expect(failure.messages[0].t100?.no).toBe('026');
    expect(refusal.form).toBe('exception');
  });

  it('keeps the shapes of an activation that did not activate', () => {
    const listed: IAdtStillInactive = {
      uri: '/sap/bc/adt/functions/groups/zfg/source/main',
      type: 'FUGR/I',
      name: 'SAPLZFG',
      parentUri: '/sap/bc/adt/functions/groups/zfg',
    };
    const refusal: AdtActivationRefusal = {
      message: 'Not activated: a sentence',
      messages: [{ type: 'E', text: 'a sentence' }],
      form: 'activation',
      stillInactive: [listed],
    };
    const failure: IAdtActivationFailure = {
      origin: 'refusal',
      message: refusal.message,
      messages: refusal.messages,
      stillInactive: refusal.stillInactive,
    };
    const facts: AdtActivationFacts = {
      named: ['/sap/bc/adt/functions/groups/zfg'],
      inactiveObjects: { data: '', status: 200, statusText: 'OK', headers: {} },
    };

    expect(failure.stillInactive[0]?.parentUri).toBe(facts.named[0]);
  });
});

describe('rawOf', () => {
  it.each([
    ['a string, unchanged', 'CLASS zcl_x.', 'CLASS zcl_x.'],
    ['undefined, as nothing', undefined, ''],
    ['null, as nothing', null, ''],
  ])('%s', (_label, data, expected) => {
    expect(rawOf({ data } as never)).toBe(expected);
  });

  it('an object, as its JSON — a transport may have parsed the document', () => {
    expect(rawOf({ data: { a: 1 } } as never)).toBe('{"a":1}');
  });

  it('a number, as its text', () => {
    expect(rawOf({ data: 42 } as never)).toBe('42');
  });

  it('an object that cannot be stringified, as whatever it prints as', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(rawOf({ data: cyclic } as never)).toBe('[object Object]');
  });
});
