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
   * Where **this** object's name or source is validated.
   *
   * ADT has no single validation endpoint: a class name goes to
   * `/oo/validation/objectname`, a domain's to `/ddic/domains/validation`, and
   * an include's source through a check run. Accepting "any /validation" let a
   * class validated against the domain endpoint pass — found in review,
   * 2026-08-15 — so each object says where its own lives.
   */
  validation?: string;
  /**
   * Where **this** object's version list lives.
   *
   * A suffix rule is not enough — `…/testclasses/wrong/versions` ends the same
   * way — and the paths differ by object anyway: a class reads
   * `includes/main/versions`, most source objects `source/main/versions`, an
   * include just `versions` under itself. Found in review, 2026-08-15.
   */
  versions?: string;
  /**
   * The resource `update` writes.
   *
   * "A PUT under the object" is not enough: `getClass().update()` writing
   * `includes/testclasses` instead of `source/main` is a PUT under the class
   * either way, and would have passed. Found in review, 2026-08-15. Absent for
   * a handler whose update the generic fixture cannot reach — those are listed
   * in `VERB_NOT_REACHED` and never get this far.
   */
  writes?: string;
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
    validation: '/sap/bc/adt/oo/validation/objectname',
    versions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/main/versions',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD/source/main',
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
    validation: '/sap/bc/adt/oo/validation/objectname',
    versions: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/source/main/versions',
    writes: '/sap/bc/adt/oo/interfaces/ZIF_GUARD/source/main',
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
    validation: '/sap/bc/adt/programs/validation',
    versions: '/sap/bc/adt/programs/programs/ZGUARD/source/main/versions',
    writes: '/sap/bc/adt/programs/programs/ZGUARD/source/main',
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
    validation: '/sap/bc/adt/ddic/ddl/validation',
    versions: '/sap/bc/adt/ddic/ddl/sources/ZGUARD_DDL/source/main/versions',
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
    validation: '/sap/bc/adt/ddic/tables/validation',
    versions: '/sap/bc/adt/ddic/tables/ZGUARD_TAB/source/main/versions',
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
    validation: '/sap/bc/adt/ddic/structures/validation',
    versions: '/sap/bc/adt/ddic/structures/ZGUARD_STRU/source/main/versions',
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
    validation: '/sap/bc/adt/ddic/tabletypes/validation',
    versions: '/sap/bc/adt/ddic/tabletypes/ZGUARD_TTYP/source/main/versions',
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
    validation: '/sap/bc/adt/acm/dcl/validation',
    versions: '/sap/bc/adt/acm/dcl/sources/ZGUARD_DCL/source/main/versions',
    writes: '/sap/bc/adt/acm/dcl/sources/ZGUARD_DCL/source/main',
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
    validation: '/sap/bc/adt/ddic/structures/validation',
    versions: '/sap/bc/adt/ddic/structures/ZGUARD_APP/source/main/versions',
    writes: '/sap/bc/adt/ddic/structures/ZGUARD_APP/source/main',
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
    validation: '/sap/bc/adt/bo/behaviordefinitions/validation',
    versions:
      '/sap/bc/adt/bo/behaviordefinitions/ZGUARD_BDEF/source/main/versions',
    writes: '/sap/bc/adt/bo/behaviordefinitions/ZGUARD_BDEF/source/main',
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
    validation: '/sap/bc/adt/oo/validation/objectname',
    versions:
      '/sap/bc/adt/oo/classes/ZBP_GUARD/includes/implementations/versions',
    writes: '/sap/bc/adt/oo/classes/ZBP_GUARD/source/main',
    capabilities: FULL,
  },
  metadataExtension: {
    factory: (c: AdtClient) => c.getMetadataExtension(),
    subject: '/sap/bc/adt/ddic/ddlx/sources/ZGUARD_DDLX',
    config: { name: 'ZGUARD_DDLX', packageName: '$TMP', description: 'guard' },
    validation: '/sap/bc/adt/ddic/ddlx/sources/validation',
    versions: '/sap/bc/adt/ddic/ddlx/sources/ZGUARD_DDLX/source/main/versions',
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
    validation: '/sap/bc/adt/enhancements/enhoxhh/validation',
    versions:
      '/sap/bc/adt/enhancements/enhoxhh/ZGUARD_ENH/source/main/versions',
    writes: '/sap/bc/adt/enhancements/enhoxhh/ZGUARD_ENH/source/main',
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
    validation: '/sap/bc/adt/ddic/srvd/sources/validation',
    versions: '/sap/bc/adt/ddic/srvd/sources/ZGUARD_SRVD/source/main/versions',
    writes: '/sap/bc/adt/ddic/srvd/sources/ZGUARD_SRVD/source/main',
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
    validation: '/sap/bc/adt/functions/validation',
    versions:
      '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM/source/main/versions',
    writes:
      '/sap/bc/adt/functions/groups/ZGUARD_FG/fmodules/ZGUARD_FM/source/main',
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
    validation: '/sap/bc/adt/ddic/dsfd/sources/validation',
    versions: '/sap/bc/adt/ddic/dsfd/sources/ZGUARD_DSFD/source/main/versions',
    writes: '/sap/bc/adt/ddic/dsfd/sources/ZGUARD_DSFD/source/main',
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
    validation: '/sap/bc/adt/ddic/dsfi/validation',
    versions: '/sap/bc/adt/ddic/dsfi/ZGUARD_DSFI/source/main/versions',
    writes: '/sap/bc/adt/ddic/dsfi/ZGUARD_DSFI/source/main',
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
    validation: '/sap/bc/adt/xslt/validation',
    versions:
      '/sap/bc/adt/xslt/transformations/ZGUARD_XSLT/source/main/versions',
    writes: '/sap/bc/adt/xslt/transformations/ZGUARD_XSLT/source/main',
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
    validation: '/sap/bc/adt/businessservices/bindings/bindingtypes',
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
    validation: '/sap/bc/adt/ddic/domains/validation',
    writes: '/sap/bc/adt/ddic/domains/ZGUARD_DOM',
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
    validation: '/sap/bc/adt/ddic/dataelements/validation',
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
    validation: '/sap/bc/adt/functions/validation',
    writes: '/sap/bc/adt/functions/groups/ZGUARD_FG',
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
    validation: '/sap/bc/adt/packages/validation',
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
    validation: '/sap/bc/adt/functions/groups/ZGUARD_FG',
    versions:
      '/sap/bc/adt/functions/groups/ZGUARD_FG/includes/LZGUARD_FGF01/versions',
    writes: '/sap/bc/adt/functions/groups/ZGUARD_FG/includes/LZGUARD_FGF01',
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
    validation: '/sap/bc/adt/aps/iam/auth/validation',
    writes: '/sap/bc/adt/aps/iam/auth/ZGUARD_AUTH',
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
    validation: '/sap/bc/adt/sfw/featuretoggles',
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
    validation: '/sap/bc/adt/businessservices/bindings/bindingtypes',
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
    validation: '/sap/bc/adt/checkruns',
    versions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/testclasses/versions',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/testclasses',
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
    validation: '/sap/bc/adt/checkruns',
    versions:
      '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/implementations/versions',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/implementations',
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
    validation: '/sap/bc/adt/checkruns',
    versions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/definitions/versions',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/definitions',
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
    validation: '/sap/bc/adt/checkruns',
    versions: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/macros/versions',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD/includes/macros',
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
    validation: '/sap/bc/adt/messageclass/validation',
    writes: '/sap/bc/adt/messageclass/ZGUARD_MSG',
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
    writes: '/sap/bc/adt/messageclass/ZGUARD_MSG',
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
    validation: '/sap/bc/adt/checkruns',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD_TESTS/includes/testclasses',
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
    validation: '/sap/bc/adt/checkruns',
    writes: '/sap/bc/adt/oo/classes/ZCL_GUARD_CDS_TESTS/includes/testclasses',
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
