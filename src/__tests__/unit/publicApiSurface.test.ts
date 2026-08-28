/**
 * What the package actually hands out from its root.
 *
 * This exists because a claim in the CHANGELOG outran the code:
 * `parseSearchResults` was described as "exported for callers already holding
 * the XML" while the symbol never reached the public barrel. It had `export` in
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
import { parseSearchResults, parseTransportTree } from '../../index';

describe('public API surface', () => {
  it('hands out parseSearchResults from the package root', () => {
    expect(typeof parseSearchResults).toBe('function');
  });

  it('parses through the public entry point, not just past it', () => {
    // Exercised via the root import, so an export that exists but resolves to
    // something unusable would fail here rather than in the deep module.
    const hits = parseSearchResults(
      `<objectReferences>
         <objectReference adtcore:name="ZCL_PUBLIC" adtcore:type="CLAS/OC"/>
       </objectReferences>`,
    );

    expect(hits).toEqual([
      {
        name: 'ZCL_PUBLIC',
        type: 'CLAS/OC',
        description: '',
        packageName: undefined,
        uri: undefined,
      },
    ]);
  });

  it('hands out parseTransportTree from the package root', () => {
    expect(typeof parseTransportTree).toBe('function');
  });

  it('parses a transport tree through the public entry point, not just past it', () => {
    const tree = parseTransportTree(
      '<?xml version="1.0"?><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" ' +
        'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="CB9900000000"/>',
    );

    expect(tree).toEqual({
      attributes: { 'adtcore:name': 'CB9900000000' },
      requests: [],
    });
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
  'AbapDebugger',
  'AdtAbapGitClient',
  'AdtAppendStructure',
  'AdtAtc',
  'AdtClient',
  'AdtClientBatch',
  'AdtClientLegacy',
  'AdtClientsWS',
  'AdtContentTypesBase',
  'AdtContentTypesModern',
  'AdtExecutor',
  'AdtInclude',
  'AdtMessageClass',
  'AdtMessageClassMessage',
  'AdtRuntimeClient',
  'AdtRuntimeClientBatch',
  'AdtRuntimeClientExperimental',
  'AdtScalarFunction',
  'AdtScalarFunctionImplementation',
  'AdtService',
  'AdtServiceBinding',
  'AmdpDebugger',
  'ApplicationLog',
  'AtcLog',
  'BatchRecordingConnection',
  'CT_INCLUDE',
  'CrossTrace',
  'DdicActivation',
  'Debugger',
  'DebuggerSessionClient',
  'FeedRepository',
  'GatewayErrorLog',
  'MemorySnapshots',
  'Profiler',
  'RuntimeDumps',
  'St05Trace',
  'SystemMessages',
  'buildDumpIdPrefix',
  'buildRuntimeDumpsUserQuery',
  'createAdtClient',
  'fetchDiscoveryEndpoints',
  'getSystemInformation',
  'isEndpointInDiscovery',
  'isModernAdtSystem',
  'parseSearchResults',
  'parseTransportTree',
  'resolveBindingVariant',
  'resolveContentTypes',
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
