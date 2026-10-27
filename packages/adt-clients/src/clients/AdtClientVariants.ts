/**
 * The client of each modern release variant, its variant fixed: the
 * factories and members a variant's ADT type table does not serve do not
 * compile on it. The two serve the same APIs and operations today; a
 * consumer names the one its system is, and the declaration stays true when
 * they part. SAP_BASIS 7.40 is `AdtClientLegacy` of
 * `@mcp-abap-adt/adt-clients-legacy`.
 */

import { AdtClient } from './AdtClient';

/** S/4HANA 2025 on premise — `ADT_TYPES_ONPREM`. */
export class AdtClientOnPrem extends AdtClient<'onprem'> {}

/** ABAP cloud — `ADT_TYPES_CLOUD`. */
export class AdtClientCloud extends AdtClient<'cloud'> {}
