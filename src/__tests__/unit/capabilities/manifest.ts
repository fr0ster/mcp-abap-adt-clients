/**
 * What every handler this package hands out is supposed to be able to do.
 *
 * **Authored from ADT, not from the code.** A manifest derived from each
 * class's `implements` clause would agree with the code by construction and
 * prove nothing; the point of these checks is to name the places where the code
 * and the truth disagree. So when a check fails, the manifest is the claim and
 * the handler is what gets fixed — unless the manifest itself turns out to be
 * wrong about ADT, in which case the entry changes and the reason is written
 * down here.
 *
 * The subject is the **factory return type**, never the concrete class. A
 * consumer never names `AdtClass`; it calls `client.getClass()`, and that
 * method's declared return type is the contract it receives. Measured
 * 2026-08-14: 37 getters on `AdtClient` against 18 handler classes exported
 * from the package root, so a class-based check would be blind to 19 handlers
 * as well as to every getter's own type.
 */

import type { AdtClient } from '../../../clients/AdtClient';

/** The atoms, and the methods each one is. */
export const ATOM_METHODS = {
  creatable: ['create'],
  readable: ['read', 'readMetadata'],
  updatable: ['update'],
  deletable: ['delete'],
  validatable: ['validate'],
  checkable: ['check'],
  activatable: ['activate'],
  lockable: ['lock', 'unlock'],
  versionable: ['getVersions', 'getVersionSource'],
  transportAware: ['readTransport'],
} as const;

export type Atom = keyof typeof ATOM_METHODS;

/** Everything an ADT object handler can be. */
const FULL = [
  'creatable',
  'readable',
  'updatable',
  'deletable',
  'validatable',
  'checkable',
  'activatable',
  'lockable',
  'versionable',
  'transportAware',
] as const;

/**
 * One request a method must make.
 *
 * A bare string means the capability's own verb — `create` POSTs, `update`
 * PUTs. A pair is for an operation whose chain mixes them: `unitTest.create`
 * POSTs the container class and then **PUT**s the tests into its include, and a
 * list under one implied verb could not say so, so the second half went
 * unchecked. Found in review, 2026-08-15.
 */
export type RequestSpec =
  | string
  | { readonly method: string; readonly path: string };

export interface HandlerEntry {
  /** How a consumer reaches it. The closure hides any arguments the getter takes. */
  factory: (client: AdtClient) => unknown;
  /** Enough config for every method the entry claims. */
  config: Record<string, unknown>;
  /**
   * The ADT resource this object **is**, so a check can ask whether a method
   * addressed it — not merely whether it used the right verb. A chain that
   * PUTs the wrong include still PUTs.
   */
  subject: string;
  /** For a handler whose subject is a part of its object: which part. */
  include?: string;
  /**
   * The request each method makes, by resource — the ADT path it must address.
   *
   * Six review rounds went into arriving at this rather than a rule. Every
   * attempt to describe the right resource by its *shape* — under the subject,
   * ending in `/versions`, containing `/validation` — was satisfied by a path
   * that was not the resource: `…/testclasses/wrong/versions` ends the same
   * way, a class validated against the domain endpoint contains `/validation`,
   * a lock on an include sits under its class. So nothing is described here;
   * everything is named.
   *
   * A list where the operation genuinely addresses more than one resource, and
   * **all** of them are required — a behaviour implementation writes the
   * class's main source and then the implementation include, and naming only
   * the first let the second disappear unnoticed.
   *
   * A method absent from this map is one the generic fixture cannot drive to
   * its request; those are listed in `VERB_NOT_REACHED` in `behaviour.test.ts`
   * and never reach this check. `getVersionSource` is absent everywhere: it
   * fetches the content URI it was handed, which is not the object's path.
   */
  /**
   * Where **this** object's version list lives.
   *
   * A suffix rule is not enough — `…/testclasses/wrong/versions` ends the same
   * way — and the paths differ by object anyway: a class reads
   * `includes/main/versions`, most source objects `source/main/versions`, an
   * include just `versions` under itself. Found in review, 2026-08-15.
   */
  requests?: Readonly<Record<string, RequestSpec | readonly RequestSpec[]>>;
  /** What ADT gives this object. */
  capabilities: readonly Atom[];
  /** Why this set, when the set is not the full one. */
  why?: string;
}

/**
 * `as const satisfies` is load-bearing, not style.
 *
 * `satisfies` checks each entry against {@link HandlerEntry} while `as const`
 * keeps the literal types — the capability tuples and, crucially, each
 * factory's real return type. `shape.ts` derives its whole compile-time check
 * from this object, so there is **one** list rather than two hand-maintained
 * ones that can drift. An earlier version had two, and a comment claiming a
 * check that kept them together; the check did not exist.
 */
export const HANDLERS = {
  // ── Source objects: the full set ─────────────────────────────────────────
  class: {
    factory: (c: AdtClient) => c.getClass(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD',
    config: {
      sourceCode: 'CLASS zcl_guard DEFINITION PUBLIC. ENDCLASS.',
      className: 'ZCL_GUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/oo/classes',
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD/source/main',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD',
      update: '/sap/bc/adt/oo/classes/zcl_guard/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/oo/validation/objectname',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zcl_guard',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard',
      getVersions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/main/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZCL_GUARD/transport',
    },
    capabilities: FULL,
  },
  interface: {
    factory: (c: AdtClient) => c.getInterface(),
    subject: '/sap/bc/adt/oo/interfaces/ZIF_GUARD',
    config: {
      sourceCode: 'INTERFACE zif_guard PUBLIC. ENDINTERFACE.',
      interfaceName: 'ZIF_GUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/oo/interfaces',
      read: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/source/main',
      readMetadata: '/sap/bc/adt/oo/interfaces/ZIF_GUARD',
      update: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/oo/validation/objectname',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/interfaces/zif_guard',
      unlock: '/sap/bc/adt/oo/interfaces/ZIF_GUARD',
      getVersions: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/source/main/versions',
      readTransport: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/transport',
    },
    capabilities: FULL,
  },
  program: {
    factory: (c: AdtClient) => c.getProgram(),
    subject: '/sap/bc/adt/programs/programs/ZGUARD',
    config: {
      sourceCode: 'REPORT zguard.',
      programName: 'ZGUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/programs/programs',
      read: '/sap/bc/adt/programs/programs/ZGUARD/source/main',
      readMetadata: '/sap/bc/adt/programs/programs/ZGUARD',
      update: '/sap/bc/adt/programs/programs/zguard/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/programs/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/programs/programs/zguard',
      unlock: '/sap/bc/adt/programs/programs/zguard',
      getVersions: '/sap/bc/adt/programs/programs/ZGUARD/source/main/versions',
      readTransport: '/sap/bc/adt/programs/programs/ZGUARD/transport',
    },
    capabilities: FULL,
  },
  ddl: {
    factory: (c: AdtClient) => c.getDdl(),
    subject: '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL',
    config: {
      sourceCode: 'define view zguard_ddl as select from t000 { mandt }',
      ddlName: 'ZGUARD_DDL',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/ddl/sources',
      read: '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL/source/main',
      readMetadata: '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/ddl/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/ddl/sources/zguard_ddl',
      unlock: '/sap/bc/adt/ddic/ddl/sources/zguard_ddl',
      getVersions:
        '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL/transport',
    },
    capabilities: FULL,
  },
  table: {
    factory: (c: AdtClient) => c.getTable(),
    subject: '/sap/bc/adt/ddic/tables/ZGUARD_TAB',
    config: {
      sourceCode: "@EndUserText.label: 'guard'\ndefine table zguard_tab {}",
      tableName: 'ZGUARD_TAB',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/tables',
      read: '/sap/bc/adt/ddic/tables/ZGUARD_TAB/source/main',
      readMetadata: '/sap/bc/adt/ddic/tables/ZGUARD_TAB',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/tables/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/tables/ZGUARD_TAB',
      unlock: '/sap/bc/adt/ddic/tables/ZGUARD_TAB',
      getVersions: '/sap/bc/adt/ddic/tables/ZGUARD_TAB/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/tables/ZGUARD_TAB/transport',
    },
    capabilities: FULL,
  },
  structure: {
    factory: (c: AdtClient) => c.getStructure(),
    subject: '/sap/bc/adt/ddic/structures/ZGUARD_STRU',
    config: {
      sourceCode: 'define structure zguard_stru {}',
      structureName: 'ZGUARD_STRU',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/structures',
      read: '/sap/bc/adt/ddic/structures/ZGUARD_STRU/source/main',
      readMetadata: '/sap/bc/adt/ddic/structures/ZGUARD_STRU',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/structures/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/structures/zguard_stru',
      unlock: '/sap/bc/adt/ddic/structures/zguard_stru',
      getVersions:
        '/sap/bc/adt/ddic/structures/ZGUARD_STRU/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/structures/ZGUARD_STRU/transport',
    },
    capabilities: FULL,
  },
  tableType: {
    factory: (c: AdtClient) => c.getTableType(),
    subject: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP',
    config: {
      sourceCode: 'define table type zguard_ttyp of zguard_stru;',
      tableTypeName: 'ZGUARD_TTYP',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/tabletypes',
      read: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP',
      readMetadata: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/tabletypes/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP',
      unlock: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP',
      getVersions:
        '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP/transport',
    },
    capabilities: FULL,
  },
  accessControl: {
    factory: (c: AdtClient) => c.getAccessControl(),
    subject: '/sap/bc/adt/acm/dcl/sources/ZGUARD_DCL',
    config: {
      sourceCode: "@EndUserText.label: 'guard'\ndefine role zguard_dcl {}",
      accessControlName: 'ZGUARD_DCL',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/acm/dcl/sources',
      read: '/sap/bc/adt/acm/dcl/sources/zguard_dcl/source/main',
      readMetadata: '/sap/bc/adt/acm/dcl/sources/zguard_dcl',
      update: '/sap/bc/adt/acm/dcl/sources/zguard_dcl/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/acm/dcl/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/acm/dcl/sources/zguard_dcl',
      unlock: '/sap/bc/adt/acm/dcl/sources/zguard_dcl',
      getVersions:
        '/sap/bc/adt/acm/dcl/sources/zguard_dcl/source/main/versions',
      readTransport: '/sap/bc/adt/acm/dcl/sources/zguard_dcl/transport',
    },
    capabilities: FULL,
  },
  appendStructure: {
    factory: (c: AdtClient) => c.getAppendStructure(),
    subject: '/sap/bc/adt/ddic/structures/ZGUARD_APP',
    config: {
      sourceCode: 'extend structure zguard_tab with zguard_app {}',
      appendStructureName: 'ZGUARD_APP',
      baseObject: 'ZGUARD_TAB',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/structures',
      read: '/sap/bc/adt/ddic/structures/zguard_app/source/main',
      readMetadata: '/sap/bc/adt/ddic/structures/zguard_app',
      update: '/sap/bc/adt/ddic/structures/zguard_app/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/structures/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/structures/zguard_app',
      unlock: '/sap/bc/adt/ddic/structures/zguard_app',
      getVersions:
        '/sap/bc/adt/ddic/structures/zguard_app/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/structures/zguard_app/transport',
    },
    capabilities: FULL,
  },
  behaviorDefinition: {
    factory: (c: AdtClient) => c.getBehaviorDefinition(),
    subject: '/sap/bc/adt/bo/behaviordefinitions/ZGUARD_BDEF',
    config: {
      sourceCode: 'managed implementation in class zbp_guard unique;',
      name: 'ZGUARD_BDEF',
      rootEntity: 'ZGUARD_VIEW',
      implementationType: 'managed',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/bo/behaviordefinitions',
      read: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef/source/main',
      readMetadata: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef',
      update: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/bo/behaviordefinitions/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef',
      unlock: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef',
      getVersions:
        '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef/source/main/versions',
      readTransport: '/sap/bc/adt/bo/behaviordefinitions/zguard_bdef/transport',
    },
    capabilities: FULL,
  },
  behaviorImplementation: {
    factory: (c: AdtClient) => c.getBehaviorImplementation(),
    subject: '/sap/bc/adt/oo/classes/ZBP_GUARD',
    config: {
      sourceCode: 'CLASS zbp_guard DEFINITION PUBLIC. ENDCLASS.',
      className: 'ZBP_GUARD',
      behaviorDefinition: 'ZGUARD_BDEF',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/oo/classes',
      read: '/sap/bc/adt/oo/classes/ZBP_GUARD/source/main',
      readMetadata: '/sap/bc/adt/oo/classes/ZBP_GUARD',
      update: [
        '/sap/bc/adt/oo/classes/zbp_guard/source/main',
        '/sap/bc/adt/oo/classes/zbp_guard/includes/implementations',
      ],
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/oo/validation/objectname',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zbp_guard',
      unlock: '/sap/bc/adt/oo/classes/zbp_guard',
      getVersions:
        '/sap/bc/adt/oo/classes/ZBP_GUARD/includes/implementations/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZBP_GUARD/transport',
    },
    capabilities: FULL,
  },
  metadataExtension: {
    factory: (c: AdtClient) => c.getMetadataExtension(),
    subject: '/sap/bc/adt/ddic/ddlx/sources/ZGUARD_DDLX',
    config: { name: 'ZGUARD_DDLX', packageName: '$TMP', description: 'guard' },
    requests: {
      create: '/sap/bc/adt/ddic/ddlx/sources',
      read: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx/source/main',
      readMetadata: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx',
      delete: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx',
      validate: '/sap/bc/adt/ddic/ddlx/sources/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx',
      unlock: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx',
      getVersions:
        '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/ddlx/sources/zguard_ddlx/transport',
    },
    capabilities: FULL,
  },
  enhancement: {
    factory: (c: AdtClient) => c.getEnhancement(),
    subject: '/sap/bc/adt/enhancements/enhoxhh/ZGUARD_ENH',
    config: {
      enhancementName: 'ZGUARD_ENH',
      // enhoxhh is the flavour whose source can be updated; the others have no
      // source resource, so update would refuse before issuing anything.
      enhancementType: 'enhoxhh',
      sourceCode: '" guard',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/enhancements/enhoxhh',
      read: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh/source/main',
      readMetadata: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh',
      update: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/enhancements/enhoxhh/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh',
      unlock: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh',
      getVersions:
        '/sap/bc/adt/enhancements/enhoxhh/zguard_enh/source/main/versions',
      readTransport: '/sap/bc/adt/enhancements/enhoxhh/zguard_enh/transport',
    },
    capabilities: FULL,
  },
  serviceDefinition: {
    factory: (c: AdtClient) => c.getServiceDefinition(),
    subject: '/sap/bc/adt/ddic/srvd/sources/ZGUARD_SRVD',
    config: {
      sourceCode: 'define service zguard_srvd { expose t000; }',
      serviceDefinitionName: 'ZGUARD_SRVD',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/srvd/sources',
      read: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd/source/main',
      readMetadata: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd',
      update: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/srvd/sources/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd',
      unlock: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd',
      getVersions:
        '/sap/bc/adt/ddic/srvd/sources/zguard_srvd/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/srvd/sources/zguard_srvd/transport',
    },
    capabilities: FULL,
  },
  functionModule: {
    factory: (c: AdtClient) => c.getFunctionModule(),
    subject: '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM',
    config: {
      sourceCode: 'FUNCTION zguard_fm. ENDFUNCTION.',
      functionGroupName: 'ZGUARD_FG',
      functionModuleName: 'ZGUARD_FM',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/functions/groups/zguard_fg/fmodules',
      read: '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM/source/main',
      readMetadata: '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM',
      update:
        '/sap/bc/adt/functions/groups/zguard_fg/fmodules/zguard_fm/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/functions/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/functions/groups/zguard_fg/fmodules/zguard_fm',
      unlock: '/sap/bc/adt/functions/groups/zguard_fg/fmodules/zguard_fm',
      getVersions:
        '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM/source/main/versions',
      readTransport:
        '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM/transport',
    },
    capabilities: FULL,
  },
  scalarFunction: {
    factory: (c: AdtClient) => c.getScalarFunction(),
    subject: '/sap/bc/adt/ddic/dsfd/sources/ZGUARD_DSFD',
    config: {
      sourceCode: 'define function zguard_dsfd returns { x : abap.int4; }',
      scalarFunctionName: 'ZGUARD_DSFD',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/dsfd/sources',
      read: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd/source/main',
      readMetadata: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd',
      update: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/dsfd/sources/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd',
      unlock: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd',
      getVersions:
        '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/dsfd/sources/zguard_dsfd/transport',
    },
    capabilities: FULL,
  },
  scalarFunctionImplementation: {
    factory: (c: AdtClient) => c.getScalarFunctionImplementation(),
    subject: '/sap/bc/adt/ddic/dsfi/ZGUARD_DSFI',
    config: {
      implementationName: 'ZGUARD_DSFI',
      scalarFunctionName: 'ZGUARD_DSFD',
      sourceCode: 'METHOD guard. ENDMETHOD.',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/dsfi',
      read: '/sap/bc/adt/ddic/dsfi/zguard_dsfi/source/main',
      readMetadata: '/sap/bc/adt/ddic/dsfi/zguard_dsfi',
      update: '/sap/bc/adt/ddic/dsfi/zguard_dsfi/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/dsfi/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/dsfi/zguard_dsfi',
      unlock: '/sap/bc/adt/ddic/dsfi/zguard_dsfi',
      getVersions: '/sap/bc/adt/ddic/dsfi/zguard_dsfi/source/main/versions',
      readTransport: '/sap/bc/adt/ddic/dsfi/zguard_dsfi/transport',
    },
    capabilities: FULL,
  },
  transformation: {
    factory: (c: AdtClient) => c.getTransformation(),
    subject: '/sap/bc/adt/xslt/transformations/ZGUARD_XSLT',
    config: {
      sourceCode: '<xsl:transform version="1.0"/>',
      transformationName: 'ZGUARD_XSLT',
      transformationType: 'XSLT',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/xslt/transformations',
      read: '/sap/bc/adt/xslt/transformations/zguard_xslt/source/main',
      readMetadata: '/sap/bc/adt/xslt/transformations/zguard_xslt',
      update: '/sap/bc/adt/xslt/transformations/zguard_xslt/source/main',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/xslt/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/xslt/transformations/zguard_xslt',
      unlock: '/sap/bc/adt/xslt/transformations/zguard_xslt',
      getVersions:
        '/sap/bc/adt/xslt/transformations/zguard_xslt/source/main/versions',
      readTransport: '/sap/bc/adt/xslt/transformations/zguard_xslt/transport',
    },
    capabilities: FULL,
  },
  service: {
    factory: (c: AdtClient) => c.getService(),
    subject: '/sap/bc/adt/businessservices/bindings/ZGUARD_SRVB',
    config: {
      bindingName: 'ZGUARD_SRVB',
      serviceDefinitionName: 'ZGUARD_SRVD',
      serviceName: 'ZGUARD_SRV',
      serviceType: 'ODataV4',
      serviceVersion: '0001',
      bindingVariant: 'ODATA_V4_UI',
      desiredPublicationState: 'published',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      read: '/sap/bc/adt/businessservices/bindings/zguard_srvb',
      readMetadata: '/sap/bc/adt/businessservices/bindings/zguard_srvb',
      delete: [
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      readTransport: '/sap/bc/adt/cts/transportchecks',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'transportAware',
    ],
    why: 'getService() hands out a service binding, so it has the binding’s set: no versions resource, and ADT offers no lock for one. Caught by the guard 2026-08-14 — this entry claimed the full set.',
  },

  // ── Objects with no version history ──────────────────────────────────────
  domain: {
    factory: (c: AdtClient) => c.getDomain(),
    subject: '/sap/bc/adt/ddic/domains/ZGUARD_DOM',
    config: {
      domainName: 'ZGUARD_DOM',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/domains',
      read: '/sap/bc/adt/ddic/domains/ZGUARD_DOM',
      readMetadata: '/sap/bc/adt/ddic/domains/ZGUARD_DOM',
      update: '/sap/bc/adt/ddic/domains/zguard_dom',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/domains/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/domains/zguard_dom',
      unlock: '/sap/bc/adt/ddic/domains/zguard_dom',
      readTransport: '/sap/bc/adt/ddic/domains/ZGUARD_DOM/transport',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'transportAware',
    ],
    why: 'ADT exposes no versions resource for a domain.',
  },
  dataElement: {
    factory: (c: AdtClient) => c.getDataElement(),
    subject: '/sap/bc/adt/ddic/dataelements/ZGUARD_DTEL',
    config: {
      dataElementName: 'ZGUARD_DTEL',
      typeKind: 'domain',
      typeName: 'ZGUARD_DOM',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/ddic/dataelements',
      read: '/sap/bc/adt/ddic/dataelements/ZGUARD_DTEL',
      readMetadata: '/sap/bc/adt/ddic/dataelements/ZGUARD_DTEL',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/ddic/dataelements/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/ddic/dataelements/zguard_dtel',
      unlock: '/sap/bc/adt/ddic/dataelements/zguard_dtel',
      readTransport: '/sap/bc/adt/ddic/dataelements/ZGUARD_DTEL/transport',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'transportAware',
    ],
    why: 'ADT exposes no versions resource for a data element.',
  },
  functionGroup: {
    factory: (c: AdtClient) => c.getFunctionGroup(),
    subject: '/sap/bc/adt/functions/groups/ZGUARD_FG',
    config: {
      functionGroupName: 'ZGUARD_FG',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: [
        '/sap/bc/adt/functions/validation',
        '/sap/bc/adt/functions/groups',
        '/sap/bc/adt/checkruns',
      ],
      read: '/sap/bc/adt/functions/groups/ZGUARD_FG',
      readMetadata: '/sap/bc/adt/functions/groups/ZGUARD_FG',
      update: '/sap/bc/adt/functions/groups/ZGUARD_FG',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/functions/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/functions/groups/zguard_fg',
      unlock: '/sap/bc/adt/functions/groups/zguard_fg',
      readTransport: '/sap/bc/adt/functions/groups/ZGUARD_FG/transport',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'transportAware',
    ],
    why: 'ADT exposes no versions resource for a function group.',
  },
  package: {
    factory: (c: AdtClient) => c.getPackage(),
    subject: '/sap/bc/adt/packages/ZGUARD_PKG',
    config: {
      packageName: 'ZGUARD_PKG',
      superPackage: '$TMP',
      softwareComponent: 'LOCAL',
      responsible: 'GUARD',
      description: 'guard',
    },
    requests: {
      create: ['/sap/bc/adt/packages/validation', '/sap/bc/adt/packages'],
      read: '/sap/bc/adt/packages/ZGUARD_PKG',
      readMetadata: '/sap/bc/adt/packages/ZGUARD_PKG',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/packages/validation',
      check: '/sap/bc/adt/checkruns',
      lock: '/sap/bc/adt/packages/zguard_pkg',
      unlock: '/sap/bc/adt/packages/zguard_pkg',
      readTransport: '/sap/bc/adt/packages/ZGUARD_PKG/transport',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'lockable',
      'transportAware',
    ],
    why: 'No versions resource, and a package is never activated.',
  },
  functionInclude: {
    factory: (c: AdtClient) => c.getFunctionInclude(),
    subject: '/sap/bc/adt/functions/groups/ZGUARD_FG/includes/LZGUARD_FGF01',
    config: {
      functionGroupName: 'ZGUARD_FG',
      includeName: 'LZGUARD_FGF01',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/functions/groups/zguard_fg/includes',
      read: '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01/source/main',
      readMetadata:
        '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01',
      update: '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/functions/groups/zguard_fg',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01',
      unlock: '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01',
      getVersions:
        '/sap/bc/adt/functions/groups/zguard_fg/includes/LZGUARD_FGF01/versions',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'versionable',
    ],
    why: 'An include travels in its function group; the transport is read there.',
  },
  authorizationField: {
    factory: (c: AdtClient) => c.getAuthorizationField(),
    subject: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
    config: {
      authorizationFieldName: 'ZGUARD_AUTH',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/aps/iam/auth',
      read: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
      readMetadata: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
      update: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/aps/iam/auth/validation',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
      unlock: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
    ],
    why: 'The APS IAM endpoint exposes neither versions nor a transport.',
  },
  featureToggle: {
    factory: (c: AdtClient) => c.getFeatureToggle(),
    subject: '/sap/bc/adt/sfw/featuretoggles/ZGUARD_FT',
    config: {
      featureToggleName: 'ZGUARD_FT',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      create: '/sap/bc/adt/sfw/featuretoggles',
      read: '/sap/bc/adt/sfw/featuretoggles/zguard_ft',
      readMetadata: '/sap/bc/adt/sfw/featuretoggles/zguard_ft',
      update: '/sap/bc/adt/sfw/featuretoggles/zguard_ft',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/sfw/featuretoggles',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/sfw/featuretoggles/zguard_ft',
      unlock: '/sap/bc/adt/sfw/featuretoggles/zguard_ft',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
    ],
    why: 'No versions resource, and readTransport is not supported for feature toggles.',
  },
  serviceBinding: {
    factory: (c: AdtClient) => c.getServiceBinding(),
    subject: '/sap/bc/adt/businessservices/bindings/ZGUARD_SRVB',
    config: {
      bindingName: 'ZGUARD_SRVB',
      serviceDefinitionName: 'ZGUARD_SRVD',
      serviceName: 'ZGUARD_SRV',
      serviceType: 'ODataV4',
      serviceVersion: '0001',
      bindingVariant: 'ODATA_V4_UI',
      desiredPublicationState: 'published',
      packageName: '$TMP',
      description: 'guard',
    },
    requests: {
      read: '/sap/bc/adt/businessservices/bindings/zguard_srvb',
      readMetadata: '/sap/bc/adt/businessservices/bindings/zguard_srvb',
      delete: [
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      readTransport: '/sap/bc/adt/cts/transportchecks',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'transportAware',
    ],
    why: 'No versions resource, and ADT offers no lock for a service binding.',
  },

  // ── Parts of an object: no create ────────────────────────────────────────
  localTestClass: {
    factory: (c: AdtClient) => c.getLocalTestClass(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD',
    include: 'testclasses',
    config: {
      className: 'ZCL_GUARD',
      testClassCode: 'CLASS ltcl DEFINITION FOR TESTING.',
    },
    requests: {
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/testclasses',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD',
      update: '/sap/bc/adt/oo/classes/zcl_guard/includes/testclasses',
      delete: '/sap/bc/adt/oo/classes/zcl_guard/includes/testclasses',
      validate: '/sap/bc/adt/checkruns',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zcl_guard',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard',
      getVersions:
        '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/testclasses/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZCL_GUARD/transport',
    },
    capabilities: [
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'versionable',
      'transportAware',
    ],
    why: 'An include exists because its class does; writing it is update. Lock, activation, metadata and transport are the container class’s.',
  },
  localTypes: {
    factory: (c: AdtClient) => c.getLocalTypes(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD',
    include: 'implementations',
    config: { className: 'ZCL_GUARD', localTypesCode: 'TYPES ty_x TYPE i.' },
    requests: {
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/implementations',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD',
      update: '/sap/bc/adt/oo/classes/zcl_guard/includes/implementations',
      delete: '/sap/bc/adt/oo/classes/zcl_guard/includes/implementations',
      validate: '/sap/bc/adt/checkruns',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zcl_guard',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard',
      getVersions:
        '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/implementations/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZCL_GUARD/transport',
    },
    capabilities: [
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'versionable',
      'transportAware',
    ],
    why: 'As localTestClass.',
  },
  localDefinitions: {
    factory: (c: AdtClient) => c.getLocalDefinitions(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD',
    include: 'definitions',
    config: {
      className: 'ZCL_GUARD',
      definitionsCode: 'CLASS lcl DEFINITION.',
    },
    requests: {
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/definitions',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD',
      update: '/sap/bc/adt/oo/classes/zcl_guard/includes/definitions',
      delete: '/sap/bc/adt/oo/classes/zcl_guard/includes/definitions',
      validate: '/sap/bc/adt/checkruns',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zcl_guard',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard',
      getVersions:
        '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/definitions/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZCL_GUARD/transport',
    },
    capabilities: [
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'versionable',
      'transportAware',
    ],
    why: 'As localTestClass.',
  },
  localMacros: {
    factory: (c: AdtClient) => c.getLocalMacros(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD',
    include: 'macros',
    config: { className: 'ZCL_GUARD', macrosCode: 'DEFINE mac.' },
    requests: {
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/macros',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD',
      update: '/sap/bc/adt/oo/classes/zcl_guard/includes/macros',
      delete: '/sap/bc/adt/oo/classes/zcl_guard/includes/macros',
      validate: '/sap/bc/adt/checkruns',
      check: '/sap/bc/adt/checkruns',
      activate: '/sap/bc/adt/activation',
      lock: '/sap/bc/adt/oo/classes/zcl_guard',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard',
      getVersions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/macros/versions',
      readTransport: '/sap/bc/adt/oo/classes/ZCL_GUARD/transport',
    },
    capabilities: [
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'checkable',
      'activatable',
      'lockable',
      'versionable',
      'transportAware',
    ],
    why: 'As localTestClass.',
  },

  // ── Objects that are not source, and not shaped like it ──────────────────
  messageClass: {
    factory: (c: AdtClient) => c.getMessageClass(),
    subject: '/sap/bc/adt/messageclass/ZGUARD_MSG',
    config: { name: 'ZGUARD_MSG', packageName: '$TMP', description: 'guard' },
    requests: {
      create: '/sap/bc/adt/messageclass',
      read: '/sap/bc/adt/messageclass/zguard_msg',
      readMetadata: '/sap/bc/adt/messageclass/zguard_msg',
      update: '/sap/bc/adt/messageclass/zguard_msg',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/messageclass/validation',
      lock: '/sap/bc/adt/messageclass/zguard_msg',
      unlock: '/sap/bc/adt/messageclass/zguard_msg',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'lockable',
    ],
    why: 'A message class is not activated, has no syntax check, no version history, and travels in its package’s transport.',
  },
  messageClassMessage: {
    factory: (c: AdtClient) => c.getMessageClassMessage(),
    subject: '/sap/bc/adt/messageclass/ZGUARD_MSG',
    config: { className: 'ZGUARD_MSG', msgno: '001', msgtext: 'guard' },
    requests: {
      create: '/sap/bc/adt/messageclass/zguard_msg',
      read: '/sap/bc/adt/messageclass/zguard_msg',
      readMetadata: '/sap/bc/adt/messageclass/zguard_msg',
      update: '/sap/bc/adt/messageclass/zguard_msg',
      delete: '/sap/bc/adt/messageclass/zguard_msg',
    },
    capabilities: ['creatable', 'readable', 'updatable', 'deletable'],
    why: 'A message is created, read, changed and removed through its class’s XML, and is nothing else in its own right.',
  },
  transport: {
    factory: (c: AdtClient) => c.getRequest(),
    subject: '/sap/bc/adt/cts/transportrequests/DEVK900000',
    config: {
      description: 'guard',
      transportNumber: 'DEVK900000',
      owner: 'GUARD',
    },
    requests: {
      create: '/sap/bc/adt/cts/transportrequests',
      read: '/sap/bc/adt/cts/transportrequests/DEVK900000',
      readMetadata: '/sap/bc/adt/cts/transportrequests/DEVK900000',
      delete: '/sap/bc/adt/cts/transportrequests/DEVK900000',
    },
    capabilities: ['creatable', 'readable', 'updatable', 'deletable'],
    why: 'A request is created, read, described anew and deleted while empty. Its number is system-generated, so there is nothing to validate before creating one.',
  },

  // ── Unit tests: CRUD over the container, and running ─────────────────────
  unitTest: {
    factory: (c: AdtClient) => c.getUnitTest(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD_TESTS',
    include: 'testclasses',
    config: {
      className: 'ZCL_GUARD_TESTS',
      packageName: '$TMP',
      description: 'guard',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
    },
    requests: {
      create: [
        '/sap/bc/adt/oo/classes',
        // The class is POSTed and then the tests are PUT into it —
        // both are the operation, and the second is the point of it.
        {
          method: 'PUT',
          path: '/sap/bc/adt/oo/classes/zcl_guard_tests/includes/testclasses',
        },
      ],
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD_TESTS/includes/testclasses',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD_TESTS',
      update: '/sap/bc/adt/oo/classes/zcl_guard_tests/includes/testclasses',
      delete: '/sap/bc/adt/oo/classes/zcl_guard_tests/includes/testclasses',
      validate: '/sap/bc/adt/checkruns',
      lock: '/sap/bc/adt/oo/classes/zcl_guard_tests',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard_tests',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'lockable',
    ],
    why: 'The subject is the container class and its testclasses include. Activation, check, versions and transport are the class’s, reached through getClass(). Running is IAdtRunnable, not an object capability.',
  },
  cdsUnitTest: {
    factory: (c: AdtClient) => c.getCdsUnitTest(),
    subject: '/sap/bc/adt/oo/classes/ZCL_GUARD_CDS_TESTS',
    include: 'testclasses',
    config: {
      className: 'ZCL_GUARD_CDS_TESTS',
      packageName: '$TMP',
      description: 'guard',
      cdsViewName: 'ZGUARD_VIEW',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
    },
    requests: {
      create: [
        '/sap/bc/adt/oo/classes',
        // The class is POSTed and then the tests are PUT into it —
        // both are the operation, and the second is the point of it.
        {
          method: 'PUT',
          path: '/sap/bc/adt/oo/classes/zcl_guard_cds_tests/includes/testclasses',
        },
      ],
      read: '/sap/bc/adt/oo/classes/ZCL_GUARD_CDS_TESTS/includes/testclasses',
      readMetadata: '/sap/bc/adt/oo/classes/ZCL_GUARD_CDS_TESTS',
      update: '/sap/bc/adt/oo/classes/zcl_guard_cds_tests/includes/testclasses',
      delete: [
        // ADT refuses a delete it has not approved, so the check is the
        // operation's first half rather than a nicety: a delete that skips it
        // is a different operation from the one this capability names.
        { method: 'POST', path: '/sap/bc/adt/deletion/check' },
        '/sap/bc/adt/deletion/delete',
      ],
      validate: '/sap/bc/adt/checkruns',
      lock: '/sap/bc/adt/oo/classes/zcl_guard_cds_tests',
      unlock: '/sap/bc/adt/oo/classes/zcl_guard_cds_tests',
    },
    capabilities: [
      'creatable',
      'readable',
      'updatable',
      'deletable',
      'validatable',
      'lockable',
    ],
    why: 'As unitTest, plus the CDS test-double check, which is its own interface.',
  },
} as const satisfies Record<string, HandlerEntry>;

/**
 * Factories that are deliberately not object handlers.
 *
 * A `get*` filter is not the criterion — `getUtils()` returns search,
 * where-used and package hierarchy, which has no capability matrix at all. A
 * rule that admits it is wrong, and one that excludes it by name is a
 * hand-maintained list wearing a filter's clothes. So this list is explicit,
 * and a new factory cannot be ignored by silence, only by a decision someone
 * wrote down.
 */
export const NOT_HANDLERS: Record<string, string> = {
  getUtils:
    'AdtUtils — search, where-used, package hierarchy, SQL. Not an object handler and has no capability matrix.',
};
