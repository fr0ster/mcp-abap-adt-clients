/**
 * What the package actually hands out from its root.
 *
 * This exists because a claim in the CHANGELOG once outran the code:
 * `parseSearchResults` (a reading, since moved to @mcp-abap-adt/adt-strategies
 * as `readSearchHits`) was described as exported while the symbol never reached
 * the public barrel. It had `export` in
 * its own module, the module was not re-exported, and nothing noticed — a
 * deep import into `dist/core/shared/search` was the only way in, which is not
 * an API, it is a consumer reaching past the package boundary.
 *
 * So this imports from the package ENTRY POINT, the way a consumer does. A
 * `src/`-relative import would still pass with the barrel unwired and prove
 * nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as rootExports from '../../index';
import { AdtSAPError } from '../../index';

describe('public API surface', () => {
  it('hands out AdtSAPError from the package root', () => {
    // Every client throws this. A consumer who cannot import it cannot tell a
    // refusal from any other failure, and `.document` — the answer SAP actually
    // sent — is unreachable. It shipped that way in the first draft: the class
    // had `export`, the changelog named it, the tests asserted on it, and
    // nothing outside this package could see it.
    expect(typeof AdtSAPError).toBe('function');
  });

  it('is the class the clients throw, with its fields intact', () => {
    const raised = new AdtSAPError(
      'SAP refused the request: locked',
      '<exc:exception/>',
      'ExceptionResourceNotFound',
      'com.sap.adt',
    );

    // `instanceof` across the entry point is the check that matters: a second
    // copy reachable by a deep import would satisfy `typeof` and fail every
    // consumer's `catch`.
    expect(raised).toBeInstanceOf(Error);
    expect(raised.name).toBe('AdtSAPError');
    expect(raised.document).toBe('<exc:exception/>');
    expect(raised.adtType).toBe('ExceptionResourceNotFound');
    expect(raised.namespace).toBe('com.sap.adt');
  });
});

/**
 * The runtime surface, pinned exactly.
 *
 * Two guards, and neither guesses. The first is this manifest: every value the
 * package hands out, listed. A new export or a lost one fails here and has to
 * be acknowledged by editing the list, which is the point — the surface is a
 * decision, not a side effect.
 *
 * The second holds the README to it. An earlier version of that check tried to
 * recognise claims by their shape in prose, and kept missing some: a list
 * wrapped onto a second line, two helpers separated by a slash, a whole section
 * it was never pointed at. Heuristics over prose are not a guard, they are an
 * illusion of one. The README now marks its claim lists explicitly and the test
 * reads only what is marked.
 */
const RUNTIME_EXPORTS = [
  'AdtAbapGitClient',
  'AdtAppendStructure',
  'AdtAtc',
  'AdtClient',
  'AdtClientLegacy',
  'AdtClientsWS',
  'AdtContentTypesBase',
  'AdtContentTypesModern',
  'AdtExecutor',
  'AdtInclude',
  'AdtMessageClass',
  'AdtMessageClassMessage',
  'AdtParseError',
  'AdtRuntimeClient',
  'AdtSAPError',
  'AdtScalarFunction',
  'AdtScalarFunctionImplementation',
  'AdtService',
  'AdtServiceBinding',
  'ApplicationLog',
  'AtcLog',
  'CT_INCLUDE',
  'CrossTrace',
  'DdicActivation',
  'FeedRepository',
  'GatewayErrorLog',
  'Profiler',
  'RuntimeDumps',
  'St05Trace',
  'SystemMessages',
  'abapGitDocuments',
  'accessControlDocuments',
  'appendStructureDocuments',
  'applicationLogDocuments',
  'atcDocuments',
  'atcLogDocuments',
  'authorizationFieldDocuments',
  'behaviorDefinitionDocuments',
  'buildDumpIdPrefix',
  'buildRuntimeDumpsUserQuery',
  'changeTransportTaskType',
  'classDocuments',
  'classExecutorDocuments',
  'createAdtClient',
  'crossTraceDocuments',
  'dataElementDocuments',
  'ddicActivationDocuments',
  'ddlDocuments',
  'domainDocuments',
  'enhancementDocuments',
  'featureToggleDocuments',
  'feedDocuments',
  'fetchDiscoveryEndpoints',
  'functionGroupDocuments',
  'functionIncludeDocuments',
  'functionModuleDocuments',
  'gatewayErrorLogDocuments',
  'getSystemInformation',
  'includeDocuments',
  'interfaceDocuments',
  'isEndpointInDiscovery',
  'isModernAdtSystem',
  'mainSourceFor',
  'messageClassDocuments',
  'messageDocuments',
  'metadataExtensionDocuments',
  'nothing',
  'nothingIsARefusal',
  'packageDocuments',
  'profilerDocuments',
  'programDocuments',
  'programExecutorDocuments',
  'rawDocument',
  'resolveBindingVariant',
  'resolveContentTypes',
  'runtimeDumpsDocuments',
  'scalarFunctionDocuments',
  'scalarFunctionImplementationDocuments',
  'serviceDefinitionDocuments',
  'serviceDocuments',
  'st05TraceDocuments',
  'structureDocuments',
  'systemMessagesDocuments',
  'tableDocuments',
  'tableTypeDocuments',
  'traceSchedulingDocuments',
  'transformationDocuments',
  'transportDocuments',
  'unitTestDocuments',
  'utilDocuments',
  'wireItself',
];

describe('runtime export surface', () => {
  const actual = Object.keys(rootExports).sort();

  it('is exactly the manifest', () => {
    expect(actual).toEqual([...RUNTIME_EXPORTS].sort());
  });

  it('does not hand out SERVICE_BINDING_VARIANT_MAP', () => {
    // Removed in 9.0.0: it is defined in @mcp-abap-adt/interfaces.
    expect(actual).not.toContain('SERVICE_BINDING_VARIANT_MAP');
  });
});

describe('README export claims', () => {
  const readme = readFileSync(resolve(__dirname, '../../../README.md'), 'utf8');
  const runtime = new Set(Object.keys(rootExports));

  /** Every backticked name inside a `surface:begin`/`surface:end` fence. */
  function claimedNames(): string[] {
    const names = new Set<string>();
    const fences = readme.matchAll(
      /<!--\s*surface:begin\s*-->([\s\S]*?)<!--\s*surface:end\s*-->/g,
    );
    let count = 0;
    for (const fence of fences) {
      count += 1;
      for (const m of fence[1].matchAll(
        /`([A-Za-z_][A-Za-z0-9_]*)(?:\([^`]*\))?`/g,
      )) {
        // An interface is `I` + capital by convention; the rest are values.
        if (!/^I[A-Z]/.test(m[1])) names.add(m[1]);
      }
    }
    if (count === 0) throw new Error('README has no surface fences to check');
    return [...names];
  }

  it('names only values the package exports', () => {
    const unexported = claimedNames().filter((n) => !runtime.has(n));

    expect(unexported).toEqual([]);
  });
});
