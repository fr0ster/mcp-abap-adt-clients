/**
 * ADT Clients — core barrel
 * Covers: AdtClient, AdtClientLegacy, createAdtClient, all core/** object types,
 * core/shared utilities, and the @mcp-abap-adt/interfaces re-export block (back-compat).
 * Ambiguous utils (discoveryEndpoints, systemInfo) are placed here per the "ambiguous → core" rule.
 */

// Contract types for client APIs (IAdtClientOptions, IAdtSystemContext) come
// from @mcp-abap-adt/interfaces — that is the one place to import them.

export { AdtClient } from './clients/AdtClient';
export { AdtClientLegacy } from './clients/AdtClientLegacy';
export { createAdtClient } from './clients/createAdtClient';
export { AdtAppendStructure } from './core/appendStructure';

export {
  AdtMessageClass,
  AdtMessageClassMessage,
} from './core/messageClass';
export { AdtScalarFunction } from './core/scalarFunction';
export { AdtScalarFunctionImplementation } from './core/scalarFunctionImplementation';

export {
  AdtService,
  AdtServiceBinding,
  resolveBindingVariant,
} from './core/service';

export { parseSearchResults } from './core/shared';
export {
  AdtContentTypesBase,
  AdtContentTypesModern,
} from './core/shared/contentTypes';
export { parseTransportTree } from './core/transport/parseTransportTree';
/**
 * The refusal a 2xx can carry.
 *
 * Every client throws this now, so a consumer must be able to name it —
 * `instanceof` is how they tell "SAP said no, and here is what it said" apart
 * from any other failure, and `.document` is where the untouched answer lives.
 * It shipped unreachable in the first draft: the class had `export`, the
 * changelog named it, the tests asserted on it, and nothing outside this package
 * could see it.
 *
 * Only the classes. `sapErrorIn` and `throwIfSapError` install the check
 * and are the library's own business — a consumer catches a refusal, they do not
 * detect one, and a member is exported because somebody needs it.
 */
export { AdtParseError, AdtSAPError } from './utils/adtErrors';
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
