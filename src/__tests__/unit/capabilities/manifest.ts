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
const FULL: Atom[] = [
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
];

/** `FULL` without the atoms named — spelled positively at the use site. */
const allBut = (...without: Atom[]): Atom[] =>
  FULL.filter((a) => !without.includes(a));

export interface HandlerEntry {
  /** How a consumer reaches it. The closure hides any arguments the getter takes. */
  factory: (client: AdtClient) => unknown;
  /** Enough config for every method the entry claims. */
  config: Record<string, unknown>;
  /** What ADT gives this object. */
  capabilities: Atom[];
  /** Why this set, when the set is not the full one. */
  why?: string;
}

export const HANDLERS: Record<string, HandlerEntry> = {
  // ── Source objects: the full set ─────────────────────────────────────────
  class: {
    factory: (c) => c.getClass(),
    config: {
      className: 'ZCL_GUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  interface: {
    factory: (c) => c.getInterface(),
    config: {
      interfaceName: 'ZIF_GUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  program: {
    factory: (c) => c.getProgram(),
    config: {
      programName: 'ZGUARD',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  ddl: {
    factory: (c) => c.getDdl(),
    config: {
      ddlName: 'ZGUARD_DDL',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  table: {
    factory: (c) => c.getTable(),
    config: {
      tableName: 'ZGUARD_TAB',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  structure: {
    factory: (c) => c.getStructure(),
    config: {
      structureName: 'ZGUARD_STRU',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  tableType: {
    factory: (c) => c.getTableType(),
    config: {
      tableTypeName: 'ZGUARD_TTYP',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  accessControl: {
    factory: (c) => c.getAccessControl(),
    config: {
      accessControlName: 'ZGUARD_DCL',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  appendStructure: {
    factory: (c) => c.getAppendStructure(),
    config: {
      appendStructureName: 'ZGUARD_APP',
      baseObject: 'ZGUARD_TAB',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  behaviorDefinition: {
    factory: (c) => c.getBehaviorDefinition(),
    config: {
      name: 'ZGUARD_BDEF',
      rootEntity: 'ZGUARD_VIEW',
      implementationType: 'managed',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  behaviorImplementation: {
    factory: (c) => c.getBehaviorImplementation(),
    config: {
      className: 'ZBP_GUARD',
      behaviorDefinition: 'ZGUARD_BDEF',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  metadataExtension: {
    factory: (c) => c.getMetadataExtension(),
    config: { name: 'ZGUARD_DDLX', packageName: '$TMP', description: 'guard' },
    capabilities: FULL,
  },
  enhancement: {
    factory: (c) => c.getEnhancement(),
    config: {
      enhancementName: 'ZGUARD_ENH',
      // enhoxhh is the flavour whose source can be updated; the others have no
      // source resource, so update would refuse before issuing anything.
      enhancementType: 'enhoxhh',
      sourceCode: '" guard',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  serviceDefinition: {
    factory: (c) => c.getServiceDefinition(),
    config: {
      serviceDefinitionName: 'ZGUARD_SRVD',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  functionModule: {
    factory: (c) => c.getFunctionModule(),
    config: {
      functionGroupName: 'ZGUARD_FG',
      functionModuleName: 'ZGUARD_FM',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  scalarFunction: {
    factory: (c) => c.getScalarFunction(),
    config: {
      scalarFunctionName: 'ZGUARD_DSFD',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  scalarFunctionImplementation: {
    factory: (c) => c.getScalarFunctionImplementation(),
    config: {
      implementationName: 'ZGUARD_DSFI',
      scalarFunctionName: 'ZGUARD_DSFD',
      sourceCode: 'METHOD guard. ENDMETHOD.',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  transformation: {
    factory: (c) => c.getTransformation(),
    config: {
      transformationName: 'ZGUARD_XSLT',
      transformationType: 'XSLT',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: FULL,
  },
  service: {
    factory: (c) => c.getService(),
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
    capabilities: allBut('versionable', 'lockable'),
    why: 'getService() hands out a service binding, so it has the binding’s set: no versions resource, and ADT offers no lock for one. Caught by the guard 2026-08-14 — this entry claimed the full set.',
  },

  // ── Objects with no version history ──────────────────────────────────────
  domain: {
    factory: (c) => c.getDomain(),
    config: {
      domainName: 'ZGUARD_DOM',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('versionable'),
    why: 'ADT exposes no versions resource for a domain.',
  },
  dataElement: {
    factory: (c) => c.getDataElement(),
    config: {
      dataElementName: 'ZGUARD_DTEL',
      typeKind: 'domain',
      typeName: 'ZGUARD_DOM',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('versionable'),
    why: 'ADT exposes no versions resource for a data element.',
  },
  functionGroup: {
    factory: (c) => c.getFunctionGroup(),
    config: {
      functionGroupName: 'ZGUARD_FG',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('versionable'),
    why: 'ADT exposes no versions resource for a function group.',
  },
  package: {
    factory: (c) => c.getPackage(),
    config: {
      packageName: 'ZGUARD_PKG',
      superPackage: '$TMP',
      softwareComponent: 'LOCAL',
      responsible: 'GUARD',
      description: 'guard',
    },
    capabilities: allBut('versionable', 'activatable'),
    why: 'No versions resource, and a package is never activated.',
  },
  functionInclude: {
    factory: (c) => c.getFunctionInclude(),
    config: {
      functionGroupName: 'ZGUARD_FG',
      includeName: 'LZGUARD_FGF01',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('transportAware'),
    why: 'An include travels in its function group; the transport is read there.',
  },
  authorizationField: {
    factory: (c) => c.getAuthorizationField(),
    config: {
      authorizationFieldName: 'ZGUARD_AUTH',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('versionable', 'transportAware'),
    why: 'The APS IAM endpoint exposes neither versions nor a transport.',
  },
  featureToggle: {
    factory: (c) => c.getFeatureToggle(),
    config: {
      featureToggleName: 'ZGUARD_FT',
      packageName: '$TMP',
      description: 'guard',
    },
    capabilities: allBut('versionable', 'transportAware'),
    why: 'No versions resource, and readTransport is not supported for feature toggles.',
  },
  serviceBinding: {
    factory: (c) => c.getServiceBinding(),
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
    capabilities: allBut('versionable', 'lockable'),
    why: 'No versions resource, and ADT offers no lock for a service binding.',
  },

  // ── Parts of an object: no create ────────────────────────────────────────
  localTestClass: {
    factory: (c) => c.getLocalTestClass(),
    config: {
      className: 'ZCL_GUARD',
      testClassCode: 'CLASS ltcl DEFINITION FOR TESTING.',
    },
    capabilities: allBut('creatable'),
    why: 'An include exists because its class does; writing it is update. Lock, activation, metadata and transport are the container class’s.',
  },
  localTypes: {
    factory: (c) => c.getLocalTypes(),
    config: { className: 'ZCL_GUARD', localTypesCode: 'TYPES ty_x TYPE i.' },
    capabilities: allBut('creatable'),
    why: 'As localTestClass.',
  },
  localDefinitions: {
    factory: (c) => c.getLocalDefinitions(),
    config: {
      className: 'ZCL_GUARD',
      definitionsCode: 'CLASS lcl DEFINITION.',
    },
    capabilities: allBut('creatable'),
    why: 'As localTestClass.',
  },
  localMacros: {
    factory: (c) => c.getLocalMacros(),
    config: { className: 'ZCL_GUARD', macrosCode: 'DEFINE mac.' },
    capabilities: allBut('creatable'),
    why: 'As localTestClass.',
  },

  // ── Objects that are not source, and not shaped like it ──────────────────
  messageClass: {
    factory: (c) => c.getMessageClass(),
    config: { name: 'ZGUARD_MSG', packageName: '$TMP', description: 'guard' },
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
    factory: (c) => c.getMessageClassMessage(),
    config: { className: 'ZGUARD_MSG', msgno: '001', msgtext: 'guard' },
    capabilities: ['creatable', 'readable', 'updatable', 'deletable'],
    why: 'A message is created, read, changed and removed through its class’s XML, and is nothing else in its own right.',
  },
  transport: {
    factory: (c) => c.getRequest(),
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
    factory: (c) => c.getUnitTest(),
    config: {
      className: 'ZCL_GUARD_TESTS',
      packageName: '$TMP',
      description: 'guard',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
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
    factory: (c) => c.getCdsUnitTest(),
    config: {
      className: 'ZCL_GUARD_CDS_TESTS',
      packageName: '$TMP',
      description: 'guard',
      cdsViewName: 'ZGUARD_VIEW',
      testClassSource: 'CLASS ltcl DEFINITION FOR TESTING.',
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
};

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
