/**
 * Where each kind of ADT object lives — the one place an object address is
 * built.
 *
 * Every module used to build its own: 369 literals in 237 files, and five
 * type-to-address tables that had drifted apart (an enhancement sent to the
 * XSLT collection, an interface known by a type code ADT does not use). A
 * record per kind, with exactly the arguments its address needs, is what keeps
 * a program include, a function include and a class include from being taken
 * for one another — ATC finds a function include under its group and not under
 * `/programs/includes/`, measured on an on-premise and a cloud system
 * (2026-10-01).
 *
 * Paths are written out in full on purpose: the enforcement test reads every
 * string field of every record and forbids it anywhere else in `src/`.
 * `validation` is stated per kind because it is not derivable from the
 * collection. There is no lock builder: the `_action` query differs by module
 * and is not an address.
 *
 * Internal. Nothing here is exported from the package.
 */

import type { EnhancementType } from '@mcp-abap-adt/interfaces-adt';

/**
 * The only way a name enters an address: lowercased and percent-encoded, as in
 * the addresses ADT itself answers with. A namespace `/ABC/` becomes
 * `%2Fabc%2F`: encodeURIComponent's uppercase hex, which RFC 3986 makes
 * equivalent to the `%2f` ADT writes.
 */
export function seg(name: string): string {
  return encodeURIComponent(name.toLowerCase());
}

export const sourceUri = (objectUri: string): string =>
  `${objectUri}/source/main`;
export const versionsUri = (resourceUri: string): string =>
  `${resourceUri}/versions`;
export const transportUri = (objectUri: string): string =>
  `${objectUri}/transport`;

export type ClassIncludeKind =
  | 'definitions'
  | 'implementations'
  | 'macros'
  | 'testclasses'
  | 'main';

export type ODataServiceType = 'odatav2' | 'odatav4';

export const PROGRAM = {
  collection: '/sap/bc/adt/programs/programs',
  validation: '/sap/bc/adt/programs/validation',
  uri: (name: string) => `/sap/bc/adt/programs/programs/${seg(name)}`,
} as const;

export const PROGRAM_INCLUDE = {
  collection: '/sap/bc/adt/programs/includes',
  validation: '/sap/bc/adt/includes/validation',
  uri: (name: string) => `/sap/bc/adt/programs/includes/${seg(name)}`,
} as const;

export const CLASS = {
  collection: '/sap/bc/adt/oo/classes',
  validation: '/sap/bc/adt/oo/validation/objectname',
  uri: (name: string) => `/sap/bc/adt/oo/classes/${seg(name)}`,
} as const;

export const CLASS_INCLUDE = {
  uri: (className: string, kind: ClassIncludeKind) =>
    `${CLASS.uri(className)}/includes/${kind}`,
} as const;

export const INTERFACE = {
  collection: '/sap/bc/adt/oo/interfaces',
  validation: '/sap/bc/adt/oo/validation/objectname',
  uri: (name: string) => `/sap/bc/adt/oo/interfaces/${seg(name)}`,
} as const;

export const FUNCTION_GROUP = {
  collection: '/sap/bc/adt/functions/groups',
  validation: '/sap/bc/adt/functions/validation',
  uri: (name: string) => `/sap/bc/adt/functions/groups/${seg(name)}`,
} as const;

export const FUNCTION_MODULE = {
  validation: '/sap/bc/adt/functions/validation',
  collection: (group: string) => `${FUNCTION_GROUP.uri(group)}/fmodules`,
  uri: (group: string, name: string) =>
    `${FUNCTION_GROUP.uri(group)}/fmodules/${seg(name)}`,
} as const;

export const FUNCTION_INCLUDE = {
  collection: (group: string) => `${FUNCTION_GROUP.uri(group)}/includes`,
  uri: (group: string, name: string) =>
    `${FUNCTION_GROUP.uri(group)}/includes/${seg(name)}`,
} as const;

export const PACKAGE = {
  collection: '/sap/bc/adt/packages',
  validation: '/sap/bc/adt/packages/validation',
  uri: (name: string) => `/sap/bc/adt/packages/${seg(name)}`,
} as const;

export const DDL_SOURCE = {
  collection: '/sap/bc/adt/ddic/ddl/sources',
  validation: '/sap/bc/adt/ddic/ddl/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/ddl/sources/${seg(name)}`,
} as const;

/** A classic DDIC view (`VIEW/DV`) — group operations address it here. */
export const DDIC_VIEW = {
  collection: '/sap/bc/adt/ddic/views',
  uri: (name: string) => `/sap/bc/adt/ddic/views/${seg(name)}`,
} as const;

export const TABLE = {
  collection: '/sap/bc/adt/ddic/tables',
  validation: '/sap/bc/adt/ddic/tables/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/tables/${seg(name)}`,
} as const;

/** Structures, append structures included — ADT keeps both in one collection. */
export const STRUCTURE = {
  collection: '/sap/bc/adt/ddic/structures',
  validation: '/sap/bc/adt/ddic/structures/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/structures/${seg(name)}`,
} as const;

export const DOMAIN = {
  collection: '/sap/bc/adt/ddic/domains',
  validation: '/sap/bc/adt/ddic/domains/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/domains/${seg(name)}`,
} as const;

export const DATA_ELEMENT = {
  collection: '/sap/bc/adt/ddic/dataelements',
  validation: '/sap/bc/adt/ddic/dataelements/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/dataelements/${seg(name)}`,
} as const;

export const TABLE_TYPE = {
  collection: '/sap/bc/adt/ddic/tabletypes',
  validation: '/sap/bc/adt/ddic/tabletypes/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/tabletypes/${seg(name)}`,
} as const;

export const BEHAVIOR_DEFINITION = {
  collection: '/sap/bc/adt/bo/behaviordefinitions',
  validation: '/sap/bc/adt/bo/behaviordefinitions/validation',
  uri: (name: string) => `/sap/bc/adt/bo/behaviordefinitions/${seg(name)}`,
} as const;

export const SERVICE_DEFINITION = {
  collection: '/sap/bc/adt/ddic/srvd/sources',
  validation: '/sap/bc/adt/ddic/srvd/sources/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/srvd/sources/${seg(name)}`,
} as const;

export const SERVICE_BINDING = {
  /**
   * The root the jobs and OData addresses hang off. Declared as a string so the
   * enforcement test sees it: the builders below are functions of the service
   * type, and a test that read only string fields would miss them.
   */
  root: '/sap/bc/adt/businessservices',
  release: '/sap/bc/adt/businessservices/release',
  collection: '/sap/bc/adt/businessservices/bindings',
  bindingTypes: '/sap/bc/adt/businessservices/bindings/bindingtypes',
  uri: (name: string) => `/sap/bc/adt/businessservices/bindings/${seg(name)}`,
  publishJobs: (type: ODataServiceType) =>
    `/sap/bc/adt/businessservices/${type}/publishjobs`,
  unpublishJobs: (type: ODataServiceType) =>
    `/sap/bc/adt/businessservices/${type}/unpublishjobs`,
  /**
   * The published OData service a binding exposes. The name goes in as given:
   * one caller uppercases a binding name, the other passes an object name
   * through, and neither case was measured.
   */
  odataService: (type: ODataServiceType, name: string) =>
    `/sap/bc/adt/businessservices/${type}/${encodeURIComponent(name)}`,
} as const;

export const ACCESS_CONTROL = {
  collection: '/sap/bc/adt/acm/dcl/sources',
  validation: '/sap/bc/adt/acm/dcl/validation',
  uri: (name: string) => `/sap/bc/adt/acm/dcl/sources/${seg(name)}`,
} as const;

export const METADATA_EXTENSION = {
  collection: '/sap/bc/adt/ddic/ddlx/sources',
  validation: '/sap/bc/adt/ddic/ddlx/sources/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/ddlx/sources/${seg(name)}`,
} as const;

export const TRANSFORMATION = {
  collection: '/sap/bc/adt/xslt/transformations',
  /**
   * What the module sends, and wrong: it answers 404 on an on-premise and a
   * cloud system. Discovery documents
   * `/sap/bc/adt/xslt/transformations/{transformationname}/validation`, which
   * answers 400 asking for a `transformation` document in the body — a request
   * shape the module does not send, so the fix is not an address change.
   */
  validation: '/sap/bc/adt/xslt/validation',
  uri: (name: string) => `/sap/bc/adt/xslt/transformations/${seg(name)}`,
} as const;

export const MESSAGE_CLASS = {
  collection: '/sap/bc/adt/messageclass',
  validation: '/sap/bc/adt/messageclass/validation',
  uri: (name: string) => `/sap/bc/adt/messageclass/${seg(name)}`,
} as const;

export const FEATURE_TOGGLE = {
  collection: '/sap/bc/adt/sfw/featuretoggles',
  validation: '/sap/bc/adt/sfw/featuretoggles/validation',
  uri: (name: string) => `/sap/bc/adt/sfw/featuretoggles/${seg(name)}`,
  check: (name: string) => `${FEATURE_TOGGLE.uri(name)}/check`,
  states: (name: string) => `${FEATURE_TOGGLE.uri(name)}/states`,
  toggle: (name: string) => `${FEATURE_TOGGLE.uri(name)}/toggle`,
} as const;

export const AUTHORIZATION_FIELD = {
  collection: '/sap/bc/adt/aps/iam/auth',
  validation: '/sap/bc/adt/aps/iam/auth/validation',
  uri: (name: string) => `/sap/bc/adt/aps/iam/auth/${seg(name)}`,
} as const;

/** The subtype is a path segment: `/enhancements/enhoxh/<name>`. */
export const ENHANCEMENT = {
  root: '/sap/bc/adt/enhancements',
  collection: (type: EnhancementType) => `/sap/bc/adt/enhancements/${type}`,
  uri: (type: EnhancementType, name: string) =>
    `/sap/bc/adt/enhancements/${type}/${seg(name)}`,
} as const;

export const SCALAR_FUNCTION = {
  collection: '/sap/bc/adt/ddic/dsfd/sources',
  validation: '/sap/bc/adt/ddic/dsfd/sources/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/dsfd/sources/${seg(name)}`,
} as const;

export const SCALAR_FUNCTION_IMPLEMENTATION = {
  collection: '/sap/bc/adt/ddic/dsfi',
  validation: '/sap/bc/adt/ddic/dsfi/validation',
  uri: (name: string) => `/sap/bc/adt/ddic/dsfi/${seg(name)}`,
} as const;

export const TRANSPORT_REQUEST = {
  collection: '/sap/bc/adt/cts/transportrequests',
  /**
   * Not `seg`: a request number is case-sensitive in the address — as given it
   * answers 200, lowercased 404, on an on-premise and a cloud system alike
   * (2026-10-01).
   */
  uri: (number: string) =>
    `/sap/bc/adt/cts/transportrequests/${encodeURIComponent(number)}`,
} as const;

/**
 * Below BASIS 7.50 the CTS endpoint sits outside `/sap/bc/adt/`. The one kind
 * whose address differs on legacy — so it is a record of its own, never a
 * substitution inside `TRANSPORT_REQUEST`.
 */
export const TRANSPORT_REQUEST_LEGACY = {
  collection: '/sap/bc/cts/transportrequests',
} as const;

/** Every record by name — what the enforcement test reads. */
export const RECORDS = {
  PROGRAM,
  PROGRAM_INCLUDE,
  CLASS,
  CLASS_INCLUDE,
  INTERFACE,
  FUNCTION_GROUP,
  FUNCTION_MODULE,
  FUNCTION_INCLUDE,
  PACKAGE,
  DDL_SOURCE,
  DDIC_VIEW,
  TABLE,
  STRUCTURE,
  DOMAIN,
  DATA_ELEMENT,
  TABLE_TYPE,
  BEHAVIOR_DEFINITION,
  SERVICE_DEFINITION,
  SERVICE_BINDING,
  ACCESS_CONTROL,
  METADATA_EXTENSION,
  TRANSFORMATION,
  MESSAGE_CLASS,
  FEATURE_TOGGLE,
  AUTHORIZATION_FIELD,
  ENHANCEMENT,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  TRANSPORT_REQUEST,
  TRANSPORT_REQUEST_LEGACY,
} as const;
