/**
 * The type code each API writes into what it sends — a create payload's
 * `adtcore:type`, a validation's `objtype` — typed against the ADT type tables
 * of `@mcp-abap-adt/interfaces-adt`.
 *
 * `CodeOf<A>` is the codes the on-premise table lists under API `A`, so a code
 * written for an API that does not list it fails to compile here rather than
 * reaching ADT. The on-premise table is the widest: every other table's APIs
 * and codes are among its own.
 *
 * Internal. Nothing here is exported from the package.
 */

import type { ADT_TYPES_ONPREM, AdtApi } from '@mcp-abap-adt/interfaces-adt';

/** The codes the on-premise table lists under API `A`. */
export type CodeOf<A extends AdtApi<'onprem'>> =
  keyof (typeof ADT_TYPES_ONPREM)[A]['codes'] & string;

/** The code of each API with one code, as its payloads write it. */
export const TYPE_CODE = {
  accessControl: 'DCLS/DL',
  appendStructure: 'TABL/DS',
  behaviorDefinition: 'BDEF/BDO',
  behaviorImplementation: 'CLAS/OC',
  class: 'CLAS/OC',
  dataElement: 'DTEL/DE',
  ddl: 'DDLS/DF',
  domain: 'DOMA/DD',
  featureToggle: 'FTG2/FT',
  functionGroup: 'FUGR/F',
  functionInclude: 'FUGR/I',
  functionModule: 'FUGR/FF',
  include: 'PROG/I',
  interface: 'INTF/OI',
  messageClass: 'MSAG/N',
  metadataExtension: 'DDLX/EX',
  package: 'DEVC/K',
  program: 'PROG/P',
  scalarFunction: 'DSFD/SCF',
  scalarFunctionImplementation: 'DSFI/SFI',
  serviceBinding: 'SRVB/SVB',
  serviceDefinition: 'SRVD/SRV',
  structure: 'TABL/DS',
  table: 'TABL/DT',
  tableType: 'TTYP/DA',
  transformation: 'XSLT/VT',
} as const satisfies { readonly [A in AdtApi<'onprem'>]?: CodeOf<A> };
