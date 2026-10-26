/**
 * @mcp-abap-adt/adt-clients-legacy — clients for SAP_BASIS below 7.50 (7.40),
 * built on @mcp-abap-adt/adt-clients.
 *
 * The consumer declares the system: it constructs `AdtClientLegacy` or
 * `AdtExecutorLegacy` over an RFC connection. Nothing detects a legacy system.
 */

export { AdtClientLegacy } from './clients/AdtClientLegacy';
export { AdtExecutorLegacy } from './clients/AdtExecutorLegacy';
export { AdtRequestLegacy } from './core/transport/AdtRequestLegacy';
