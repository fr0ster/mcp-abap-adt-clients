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
export {
  fetchDiscoveryEndpoints,
  isEndpointInDiscovery,
} from './utils/discoveryEndpoints';
export {
  getSystemInformation,
  isModernAdtSystem,
  resolveContentTypes,
} from './utils/systemInfo';
