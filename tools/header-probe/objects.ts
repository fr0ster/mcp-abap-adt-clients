/**
 * The object types the probe runs its cycle on: how each is reached, named,
 * configured and written.
 */

import type { AdtClient } from '../../src/clients/AdtClient';

/** What a spec needs to build a config. */
export interface ISpecContext {
  packageName: string;
  transportRequest: string;
  /** The dependency's name: the function group, or the DDL source. */
  parent?: string;
}

/** A handler as the probe calls it: every member by name. */
export type IProbeable = Record<
  string,
  ((...args: unknown[]) => Promise<unknown>) | undefined
>;

export interface IObjectSpec {
  /** The report's object type, and the `--only` key. */
  type: string;
  /** The handler column of MIGRATION-36. */
  handler: string;
  /** Two letters that keep the probe's names apart across types. */
  code: string;
  /** Function modules must start with `Z_`. */
  functionModule?: boolean;
  /** Created first, deleted last. */
  needs?: 'functionGroup' | 'ddl';
  handle(client: AdtClient): IProbeable;
  config(name: string, context: ISpecContext): Record<string, unknown>;
  /**
   * How the update phase writes: `update` with a source, `updateMetadata` with
   * the metadata document read back as it is.
   */
  write: 'source' | 'metadata';
  /** The source to write; without one the source read is written back unchanged. */
  source?(name: string, context: ISpecContext): string;
}

const as = (handler: unknown): IProbeable => handler as IProbeable;

const LABEL = "@EndUserText.label: 'Header probe'";

const base = (context: ISpecContext, description = 'Header probe') => ({
  packageName: context.packageName,
  transportRequest: context.transportRequest,
  description,
});

export const OBJECT_SPECS: readonly IObjectSpec[] = [
  {
    type: 'class',
    handler: 'getClass()',
    code: 'CL',
    handle: (client) => as(client.getClass()),
    config: (name, context) => ({ className: name, ...base(context) }),
    write: 'source',
  },
  {
    type: 'interface',
    handler: 'getInterface()',
    code: 'IF',
    handle: (client) => as(client.getInterface()),
    config: (name, context) => ({ interfaceName: name, ...base(context) }),
    write: 'source',
  },
  {
    type: 'program',
    handler: 'getProgram()',
    code: 'PR',
    handle: (client) => as(client.getProgram()),
    config: (name, context) => ({
      programName: name,
      programType: 'executable',
      ...base(context),
    }),
    write: 'source',
  },
  {
    type: 'include',
    handler: 'getInclude()',
    code: 'IN',
    handle: (client) => as(client.getInclude()),
    config: (name, context) => ({ includeName: name, ...base(context) }),
    write: 'source',
    source: () => '* Header probe',
  },
  {
    type: 'domain',
    handler: 'getDomain()',
    code: 'DO',
    handle: (client) => as(client.getDomain()),
    config: (name, context) => ({ domainName: name, ...base(context) }),
    write: 'metadata',
  },
  {
    type: 'dataElement',
    handler: 'getDataElement()',
    code: 'DE',
    handle: (client) => as(client.getDataElement()),
    config: (name, context) => ({
      dataElementName: name,
      typeKind: 'predefinedAbapType',
      dataType: 'CHAR',
      length: 10,
      ...base(context),
    }),
    write: 'metadata',
  },
  {
    type: 'structure',
    handler: 'getStructure()',
    code: 'ST',
    handle: (client) => as(client.getStructure()),
    config: (name, context) => ({ structureName: name, ...base(context) }),
    write: 'source',
    source: (name) =>
      `${LABEL}\n@AbapCatalog.enhancement.category: #NOT_EXTENSIBLE\ndefine structure ${name.toLowerCase()} {\n  field1 : abap.char(1);\n}\n`,
  },
  {
    type: 'table',
    handler: 'getTable()',
    code: 'TA',
    handle: (client) => as(client.getTable()),
    config: (name, context) => ({ tableName: name, ...base(context) }),
    write: 'source',
    source: (name) =>
      `${LABEL}\n@AbapCatalog.enhancement.category: #NOT_EXTENSIBLE\n@AbapCatalog.tableCategory: #TRANSPARENT\n@AbapCatalog.deliveryClass: #A\n@AbapCatalog.dataMaintenance: #RESTRICTED\ndefine table ${name.toLowerCase()} {\n  key mandt : abap.clnt not null;\n  key id    : abap.char(10) not null;\n}\n`,
  },
  {
    type: 'tableType',
    handler: 'getTableType()',
    code: 'TT',
    handle: (client) => as(client.getTableType()),
    config: (name, context) => ({ tableTypeName: name, ...base(context) }),
    write: 'metadata',
  },
  {
    type: 'ddl',
    handler: 'getDdl()',
    code: 'DL',
    handle: (client) => as(client.getDdl()),
    config: (name, context) => ({ ddlName: name, ...base(context) }),
    write: 'source',
    source: (name) => ddlSource(name),
  },
  {
    type: 'functionGroup',
    handler: 'getFunctionGroup()',
    code: 'FG',
    handle: (client) => as(client.getFunctionGroup()),
    config: (name, context) => ({ functionGroupName: name, ...base(context) }),
    write: 'metadata',
  },
  {
    type: 'functionModule',
    handler: 'getFunctionModule()',
    code: 'FM',
    functionModule: true,
    needs: 'functionGroup',
    handle: (client) => as(client.getFunctionModule()),
    config: (name, context) => ({
      functionGroupName: context.parent,
      functionModuleName: name,
      ...base(context),
    }),
    write: 'source',
  },
  {
    type: 'messageClass',
    handler: 'getMessageClass()',
    code: 'MC',
    handle: (client) => as(client.getMessageClass()),
    config: (name, context) => ({ name, ...base(context) }),
    write: 'metadata',
  },
  {
    type: 'transformation',
    handler: 'getTransformation()',
    code: 'XT',
    handle: (client) => as(client.getTransformation()),
    config: (name, context) => ({
      transformationName: name,
      transformationType: 'SimpleTransformation',
      ...base(context),
    }),
    write: 'source',
    source: () =>
      '<?sap.transform simple?>\n<tt:transform xmlns:tt="http://www.sap.com/transformation-templates">\n  <tt:root name="ROOT"/>\n  <tt:template>\n    <root>\n      <tt:value ref="ROOT"/>\n    </root>\n  </tt:template>\n</tt:transform>\n',
  },
  {
    type: 'serviceDefinition',
    handler: 'getServiceDefinition()',
    code: 'SD',
    needs: 'ddl',
    handle: (client) => as(client.getServiceDefinition()),
    config: (name, context) => ({
      serviceDefinitionName: name,
      ...base(context),
    }),
    write: 'source',
    source: (name, context) =>
      `${LABEL}\ndefine service ${name} {\n  expose ${context.parent};\n}\n`,
  },
  {
    type: 'accessControl',
    handler: 'getAccessControl()',
    code: 'AC',
    needs: 'ddl',
    handle: (client) => as(client.getAccessControl()),
    config: (name, context) => ({ accessControlName: name, ...base(context) }),
    write: 'source',
    source: (name, context) =>
      `${LABEL}\n@MappingRole: true\ndefine role ${name} {\n  grant select on ${context.parent}\n  where ( ) = aspect pfcg_auth ( 'S_TABU_NAM', ACTVT = '03', TABLE = '${context.parent}' );\n}\n`,
  },
  {
    type: 'metadataExtension',
    handler: 'getMetadataExtension()',
    code: 'MX',
    needs: 'ddl',
    handle: (client) => as(client.getMetadataExtension()),
    config: (name, context) => ({ name, ...base(context) }),
    write: 'source',
    source: (_name, context) =>
      `@Metadata.layer: #CORE\nannotate entity ${context.parent} with\n{\n  @EndUserText.label: 'Client'\n  mandt;\n}\n`,
  },
];

/** The DDL source of a view entity on T000, which every system has. */
export function ddlSource(name: string): string {
  return `${LABEL}\n@AccessControl.authorizationCheck: #NOT_REQUIRED\n@Metadata.allowExtensions: true\ndefine view entity ${name}\n  as select from t000\n{\n  key mandt,\n  mtext\n}\n`;
}

/** The class includes probed under the class's lock. */
export const LOCAL_INCLUDES: readonly {
  type: string;
  handler: string;
  handle(client: AdtClient): IProbeable;
  source(className: string): string;
}[] = [
  {
    type: 'localTypes',
    handler: 'getLocalTypes()',
    handle: (client) => as(client.getLocalTypes()),
    source: () => '* Header probe',
  },
  {
    type: 'localDefinitions',
    handler: 'getLocalDefinitions()',
    handle: (client) => as(client.getLocalDefinitions()),
    source: () => '* Header probe',
  },
  {
    type: 'localMacros',
    handler: 'getLocalMacros()',
    handle: (client) => as(client.getLocalMacros()),
    source: () => '* Header probe',
  },
  {
    type: 'localTestClass',
    handler: 'getLocalTestClass()',
    handle: (client) => as(client.getLocalTestClass()),
    source: () =>
      'CLASS ltc_probe DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.\n  PRIVATE SECTION.\n    METHODS probe FOR TESTING.\nENDCLASS.\n\nCLASS ltc_probe IMPLEMENTATION.\n  METHOD probe.\n  ENDMETHOD.\nENDCLASS.\n',
  },
];

/**
 * What the probe leaves out, and why. Each becomes a `skipped:` row.
 *
 * These need something the cycle cannot make and remove again on its own:
 * a live debuggee, an external repository, a key the server assigns.
 */
export const SKIPPED: readonly {
  type: string;
  member: string;
  reason: string;
}[] = [
  ...[
    'setBreakpoints',
    'getChildVariables',
    'getVariables',
    'syncBreakpoints',
    'setDebuggerSettings',
  ].map((member) => ({
    type: 'debugger',
    member,
    reason: 'skipped: needs a live debugging session attached to a debuggee',
  })),
  {
    type: 'amdpDebugger',
    member: 'getDataPreview',
    reason: 'skipped: needs an AMDP debuggee stopped at a breakpoint',
  },
  ...['link', 'pull', 'checkExternalRepo'].map((member) => ({
    type: 'abapGit',
    member,
    reason: 'skipped: needs an external Git repository to link',
  })),
  ...[
    'create',
    'createTask',
    'addObject',
    'removeObject',
    'moveObjects',
    'changeTaskType',
    'updateMetadata',
    'checkDeletion',
    'delete',
  ].map((member) => ({
    type: 'request',
    member,
    reason:
      'skipped: the server assigns the request number, so a request a refused create made could not be found and removed',
  })),
  {
    type: 'executors',
    member: 'scheduleTrace',
    reason:
      'skipped: the server assigns the trace request id, so a schedule a refused probe made could not be found and removed',
  },
  ...[
    'create',
    'update',
    'updateMetadata',
    'check',
    'activate',
    'checkState',
    'checkDeletion',
    'delete',
  ].map((member) => ({
    type: 'featureToggle',
    member,
    reason:
      'skipped: creating a feature toggle was refused on the measured system (403, MIGRATION-36)',
  })),
];
